"""Planner (Part 7.1) — parses user intent into an ordered, dependency-aware
plan of tool calls.

The planner asks the LLM for a JSON plan (``rationale`` + ordered ``steps`` with
``id``/``tool``/``args``/``depends_on``), then validates it against the tool
registry and the caller's role. Any failure — no provider configured, provider
error, unparseable output, unknown/unvisible tools — degrades to a deterministic
single-step ``rag_tool`` plan (fails open, mirroring ``LLMQueryRewriter``) so
the agent always has a path to an answer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Literal

from app.core.exceptions import ConfigurationError
from app.modules.agent.tools.base import ToolCall
from app.modules.agent.tools.registry import ToolRegistry
from app.modules.llm.base import LLMMessage, LLMProvider

PlanSource = Literal["llm", "fallback"]


@dataclass(frozen=True)
class Plan:
    steps: list[ToolCall] = field(default_factory=list)
    rationale: str | None = None
    source: PlanSource = "fallback"


class Planner:
    def __init__(
        self,
        *,
        provider: LLMProvider | None,
        registry: ToolRegistry,
        max_steps: int = 5,
        instruction: str | None = None,
    ) -> None:
        self._provider = provider
        self._registry = registry
        self._max_steps = max(1, max_steps)
        self._instruction = instruction or DEFAULT_PLANNER_INSTRUCTION

    def plan(self, *, query: str, role: str) -> Plan:
        if not query.strip():
            raise ConfigurationError(detail="Agent query must not be empty")
        if self._provider is None:
            return self._fallback(query, "No LLM provider is configured for planning")
        try:
            response = self._provider.complete(
                [
                    LLMMessage(role="system", content=self._system_prompt(role)),
                    LLMMessage(role="user", content=query),
                ],
                max_tokens=600,
                temperature=0.0,
            )
        except Exception as exc:  # noqa: BLE001 — planning must never hard-fail
            return self._fallback(query, f"LLM planning failed: {type(exc).__name__}: {exc}")

        data = _extract_json(response.content)
        if data is None:
            return self._fallback(query, "LLM planner output was not valid JSON")

        steps = _parse_steps(data, self._registry, role, self._max_steps)
        if steps is None:
            return self._fallback(query, "LLM planner produced no valid tool steps")
        rationale = data.get("rationale")
        if isinstance(rationale, str) and rationale.strip():
            rationale = rationale.strip()
        else:
            rationale = None
        return Plan(steps=steps, rationale=rationale, source="llm")

    def _fallback(self, query: str, reason: str) -> Plan:
        return Plan(
            steps=[
                ToolCall(
                    step_id="step-1",
                    tool="rag_tool",
                    args={"query": query},
                )
            ],
            rationale=reason,
            source="fallback",
        )

    def _system_prompt(self, role: str) -> str:
        visible = self._registry.list(role=role)
        if not visible:
            return self._instruction + "\n\nNo tools are available for this role."
        lines = ["You are the planner of a multimodal research agent.", self._instruction]
        lines.append("\nAvailable tools:")
        for spec in visible:
            lines.append(f"- {spec.name}: {spec.description}")
            lines.append(f"  schema: {json.dumps(spec.parameters, sort_keys=True)}")
        lines.append(
            "\nRespond with ONLY a JSON object of the form: "
            '{"rationale": "why", "steps": ['
            '{"id": "step-1", "tool": "rag_tool", "args": {...}, "depends_on": ["step-0"]}]}'
        )
        lines.append(
            "- 'id' must be unique (step-1, step-2, ...). "
            "- 'depends_on' lists step ids that must finish first; omit it for independent steps. "
            f"- Emit at most {self._max_steps} steps. "
            "- 'args' must satisfy the tool's JSON schema. "
            '- If no tool is needed, respond with "steps": [].'
        )
        return "\n".join(lines)


DEFAULT_PLANNER_INSTRUCTION = (
    "Decompose the user's request into an ordered list of tool steps. Only use "
    "the tools listed below. Prefer the smallest number of steps that satisfies "
    "the request; chain steps with 'depends_on' when one step needs another's "
    "result (for example: retrieve a passage with rag_tool, then transform it "
    "with nlp_tool)."
)


def _extract_json(text: str) -> dict[str, Any] | None:
    """Parse a JSON object out of an LLM response, tolerating markdown fences
    and trailing prose."""
    candidate = text.strip()
    if candidate.startswith("```"):
        lines = candidate.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        candidate = "\n".join(lines).strip()
    try:
        data = json.loads(candidate)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    start = candidate.find("{")
    if start != -1:
        depth = 0
        for index in range(start, len(candidate)):
            if candidate[index] == "{":
                depth += 1
            elif candidate[index] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        data = json.loads(candidate[start : index + 1])
                        return data if isinstance(data, dict) else None
                    except json.JSONDecodeError:
                        return None
    return None


def _parse_steps(
    data: dict[str, Any], registry: ToolRegistry, role: str, max_steps: int
) -> list[ToolCall] | None:
    """Validate LLM steps against the registry + role.

    Returns ``None`` when the plan is unusable (caller falls back); otherwise a
    filtered list (invalid steps dropped). An empty list is a valid plan meaning
    "no tools required".
    """
    raw_steps = data.get("steps")
    if not isinstance(raw_steps, list):
        return None

    known_ids = {
        item.get("id")
        for item in raw_steps
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("id")
    }
    steps: list[ToolCall] = []
    for item in raw_steps[:max_steps]:
        if not isinstance(item, dict):
            continue
        step_id = item.get("id")
        tool = item.get("tool")
        if not isinstance(step_id, str) or not step_id:
            continue
        if not isinstance(tool, str):
            continue
        spec = registry.get(tool)
        if spec is None or not spec.visible_to_role(role):
            continue
        args = item.get("args")
        if not isinstance(args, dict):
            continue
        depends_raw = item.get("depends_on")
        depends: list[str] = []
        if isinstance(depends_raw, list):
            depends = [
                value
                for value in depends_raw
                if isinstance(value, str) and value in known_ids and value != step_id
            ]
        steps.append(
            ToolCall(
                step_id=step_id,
                tool=tool,
                args=args,
                depends_on=tuple(depends),
            )
        )
    if raw_steps and not steps:
        return None
    return steps
