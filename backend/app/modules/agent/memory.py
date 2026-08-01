"""Agent memory (Part 7.1) — the per-run task scratchpad.

This phase ships the task scratchpad: every tool outcome is stored keyed by
``step_id`` so dependent steps and a future synthesizer can read earlier
observations. Conversation memory (rolling context) and long-term memory
(episodic RAG) are later phases; the class is shaped so those can be added
without touching callers.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.modules.agent.tools.base import ToolResult


@dataclass
class AgentMemory:
    query: str = ""
    _scratchpad: dict[str, ToolResult] = field(default_factory=dict, init=False)

    def remember(self, step_id: str, result: ToolResult) -> None:
        self._scratchpad[step_id] = result

    def step(self, step_id: str) -> ToolResult | None:
        return self._scratchpad.get(step_id)

    def results(self) -> dict[str, ToolResult]:
        return dict(self._scratchpad)

    def observations(self) -> list[str]:
        return [result.output for result in self._scratchpad.values()]
