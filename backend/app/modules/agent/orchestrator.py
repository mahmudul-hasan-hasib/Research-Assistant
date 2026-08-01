"""Agent service (Part 7.1) — composes planner → executor over one user query.

``AgentService.run`` is the orchestration entry point: it spins up a fresh task
scratchpad (memory) and decision-trace logger for the run, has the planner turn
the query into a plan, executes it dependency-aware, and composes a final answer
from the plan's last step (a dedicated Synthesizer stage lands in a later
phase). Everything — the plan, every step outcome, every reasoning decision — is
recorded in the returned trace (P6).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from app.modules.agent.decision_trace import DecisionTraceLogger
from app.modules.agent.executor import Executor
from app.modules.agent.memory import AgentMemory
from app.modules.agent.planner import Plan, Planner
from app.modules.agent.tools.base import ToolContext, ToolResult
from app.modules.agent.tools.registry import ToolRegistry


@dataclass
class RunResult:
    query: str
    plan: Plan
    results: dict[str, ToolResult]
    final_answer: str
    citations: list[dict[str, Any]]
    trace: list[dict[str, Any]]


class AgentService:
    def __init__(
        self,
        *,
        planner: Planner,
        executor: Executor,
        registry: ToolRegistry,
    ) -> None:
        self._planner = planner
        self._executor = executor
        self._registry = registry

    def run(self, *, user_id: uuid.UUID, role: str, query: str) -> RunResult:
        logger = DecisionTraceLogger()
        memory = AgentMemory(query=query)
        logger.record("query_received", query=query, role=role)

        plan = self._planner.plan(query=query, role=role)
        logger.record(
            "plan_created",
            source=plan.source,
            rationale=plan.rationale,
            steps=[
                {
                    "id": step.step_id,
                    "tool": step.tool,
                    "args": step.args,
                    "depends_on": list(step.depends_on),
                }
                for step in plan.steps
            ],
        )

        ctx = ToolContext(user_id=user_id, role=role)
        results = self._executor.execute(plan=plan, ctx=ctx, memory=memory, logger=logger)

        final_answer = _compose_answer(plan, results)
        citations = _collect_citations(plan, results)
        logger.record(
            "run_finished",
            final_answer=final_answer,
            step_count=len(results),
        )
        return RunResult(
            query=query,
            plan=plan,
            results=results,
            final_answer=final_answer,
            citations=citations,
            trace=logger.snapshot(),
        )


def _compose_answer(plan: Plan, results: dict[str, ToolResult]) -> str:
    """Final answer = the last step's output, with a note when steps failed.

    Replaces the Part 7.2 Synthesizer until that stage ships; this keeps the
    orchestration honest without inventing summarization logic.
    """
    if not plan.steps:
        return "No tool steps were required to answer this query."
    last = results.get(plan.steps[-1].step_id)
    if last is None:
        return "The agent plan produced no results."
    answer = last.output or f"Step {last.step_id} completed with no output."
    failed = [
        step.step_id
        for step in plan.steps
        if (result := results.get(step.step_id)) is not None and result.status == "error"
    ]
    if failed:
        answer += "\n\nNote: some steps did not complete; see the trace for details."
    return answer


def _collect_citations(plan: Plan, results: dict[str, ToolResult]) -> list[dict[str, Any]]:
    citations: list[dict[str, Any]] = []
    seen: set[str] = set()
    for step in plan.steps:
        result = results.get(step.step_id)
        if result is None or result.tool != "rag_tool" or result.status != "ok":
            continue
        for citation in result.data.get("citations", []):
            chunk_id = citation.get("chunk_id")
            if chunk_id in seen:
                continue
            seen.add(chunk_id)
            citations.append(citation)
    return citations
