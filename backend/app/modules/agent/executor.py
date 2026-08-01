"""Executor (Part 7.1) — schedules and runs a plan's tool steps.

Steps form a DAG via ``depends_on``. The executor runs waves: every step whose
dependencies have finished executes in one batch (independent steps stay
parallel-in-intent; concurrent scheduling arrives with streaming in a later
phase), and dependent steps wait for their batch. Per-step retries and optional
wall-clock timeouts come from the ``ToolSpec``. Every attempt is recorded in the
decision trace and every outcome lands in the agent's task scratchpad (memory),
so later steps — and a future synthesizer — can consume prior observations.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass

from app.core.exceptions import ConfigurationError
from app.modules.agent.decision_trace import DecisionTraceLogger
from app.modules.agent.memory import AgentMemory
from app.modules.agent.planner import Plan
from app.modules.agent.tools.base import (
    ToolCall,
    ToolContext,
    ToolResult,
    ToolSpec,
    error_result,
)
from app.modules.agent.tools.registry import ToolRegistry


@dataclass
class Executor:
    registry: ToolRegistry

    def execute(
        self,
        *,
        plan: Plan,
        ctx: ToolContext,
        memory: AgentMemory,
        logger: DecisionTraceLogger,
    ) -> dict[str, ToolResult]:
        step_map = _index_steps(plan)
        results: dict[str, ToolResult] = {}
        remaining = set(step_map)
        satisfied = {step_id: set(step.depends_on) for step_id, step in step_map.items()}

        while remaining:
            ready = [
                step_id
                for step_id in plan_order(plan, remaining)
                if not (satisfied[step_id] & remaining)
            ]
            if not ready:
                raise ConfigurationError(
                    detail="Agent plan contains a dependency cycle; cannot execute"
                )
            for step_id in ready:
                step = step_map[step_id]
                results[step_id] = self._run_step(
                    step=step,
                    spec=self.registry.get(step.tool),
                    ctx=ctx,
                    memory=memory,
                    logger=logger,
                )
                remaining.discard(step_id)
        return results

    def _run_step(
        self,
        *,
        step,
        spec: ToolSpec | None,
        ctx: ToolContext,
        memory: AgentMemory,
        logger: DecisionTraceLogger,
    ) -> ToolResult:
        step_ctx = ToolContext(user_id=ctx.user_id, role=ctx.role, step_id=step.step_id)
        if spec is None or not spec.visible_to_role(ctx.role):
            logger.record(
                "step_skipped",
                step_id=step.step_id,
                tool=step.tool,
                reason="tool unavailable or not visible to role",
            )
            result = error_result(
                step_id=step.step_id,
                tool=step.tool,
                message=f"Tool {step.tool!r} is not available or not visible to this role",
            )
            memory.remember(step.step_id, result)
            return result

        logger.record("step_started", step_id=step.step_id, tool=step.tool, args=step.args)
        result: ToolResult | None = None
        for attempt in range(1, spec.retries + 2):
            result = self._invoke(spec=spec, args=step.args, ctx=step_ctx, step=step)
            if result.status == "ok" or attempt > spec.retries:
                break
            logger.record(
                "step_retrying",
                step_id=step.step_id,
                tool=step.tool,
                attempt=attempt,
                error=result.error,
            )
        if result is None:
            result = error_result(
                step_id=step.step_id, tool=step.tool, message="Tool returned no result"
            )
        memory.remember(step.step_id, result)
        logger.record(
            "step_finished",
            step_id=step.step_id,
            tool=step.tool,
            status=result.status,
            error=result.error,
        )
        return result

    def _invoke(self, *, spec: ToolSpec, args: dict, ctx: ToolContext, step) -> ToolResult:
        try:
            if spec.timeout_seconds > 0:
                result = self._invoke_with_timeout(spec, args, ctx, step)
            else:
                result = spec.executor(args=args, ctx=ctx)
        except Exception as exc:  # noqa: BLE001 — fold any tool failure into a structured result
            return error_result(
                step_id=step.step_id,
                tool=spec.name,
                message=f"{type(exc).__name__}: {exc}",
                data={"code": "tool_execution_error"},
            )
        if not isinstance(result, ToolResult):
            return error_result(
                step_id=step.step_id,
                tool=spec.name,
                message=f"tool {spec.name!r} returned a non-ToolResult value",
            )
        result.step_id = step.step_id
        result.tool = spec.name
        return result

    def _invoke_with_timeout(
        self, spec: ToolSpec, args: dict, ctx: ToolContext, step
    ) -> ToolResult:
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(spec.executor, args=args, ctx=ctx)
        try:
            result = future.result(timeout=spec.timeout_seconds)
        except FutureTimeout:
            pool.shutdown(wait=False, cancel_futures=True)
            raise TimeoutError(f"tool {spec.name!r} exceeded {spec.timeout_seconds}s")
        else:
            pool.shutdown(wait=False)
        return result


def _index_steps(plan: Plan) -> dict[str, ToolCall]:
    indexed: dict[str, ToolCall] = {}
    for step in plan.steps:
        if step.step_id in indexed:
            raise ConfigurationError(detail=f"Duplicate step id {step.step_id!r} in agent plan")
        indexed[step.step_id] = step
    return indexed


def plan_order(plan: Plan, remaining: set[str]) -> list[str]:
    """Stable plan order for scheduling: declaration order within remaining."""
    return [step.step_id for step in plan.steps if step.step_id in remaining]
