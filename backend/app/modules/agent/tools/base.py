"""Tool contracts (Part 7.1 — ``ToolSpec`` registry entries and call shapes).

A tool is a named, declaratively-registered capability: a JSON-Schema
``parameters`` block the planner can read, an ``executor`` callable the executor
invokes with validated ``args`` plus a user-scoped ``ToolContext``, and
operational metadata (role visibility, cost/latency class, retry/timeout
policy). Placeholder tools (Vision/NLP) ship in this phase as real registry
entries whose executors answer "not implemented" — orchestration must not care
whether a step is backed by real logic yet.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.modules.auth.tokens import now_utc

ToolStatus = str  # "ok" | "error"


class ToolError(Exception):
    """Raised by an executor for a hard tool failure.

    The executor catches it and folds it into a structured error ``ToolResult``
    so the run and its trace survive individual tool failures (P6).
    """


@dataclass(frozen=True)
class ToolContext:
    """Per-step identity handed to every tool so tools stay user-scoped."""

    user_id: uuid.UUID
    role: str
    step_id: str = ""


@dataclass
class ToolResult:
    """What a tool produces after execution.

    ``output`` is the human-readable observation (what a synthesizer would
    consume); ``data`` is a machine-readable payload (e.g. citations for a
    retrieval step) that later stages can project into API schemas.
    """

    step_id: str
    tool: str
    status: ToolStatus
    output: str
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass(frozen=True)
class ToolCall:
    """One planned step: which tool, with which args, and what it depends on.

    ``depends_on`` references sibling ``step_id`` values, forming the plan DAG
    the executor schedules (Part 7.1 — parallel when independent).
    """

    step_id: str
    tool: str
    args: dict[str, Any]
    depends_on: tuple[str, ...] = ()


class ToolExecutor(Protocol):
    def __call__(self, *, args: dict[str, Any], ctx: ToolContext) -> ToolResult: ...


@dataclass(frozen=True)
class ToolSpec:
    """Registry entry (Part 7.1 — schema + executor + visibility + cost/latency).

    ``visible_to`` is a set of role names (``user``, ``admin``); ``None`` means
    visible to every authenticated role. ``parameters`` follows JSON-Schema so
    the planner can emit compliant ``args`` and a later validator can check them.
    """

    name: str
    description: str
    parameters: dict[str, Any]
    executor: ToolExecutor
    visible_to: frozenset[str] | None = None
    cost_class: str = "standard"
    latency_class: str = "standard"
    retries: int = 0
    timeout_seconds: float = 0.0

    def visible_to_role(self, role: str) -> bool:
        return self.visible_to is None or role in self.visible_to


def ok_result(*, step_id: str, tool: str, output: str, data: dict[str, Any] | None = None) -> ToolResult:
    return ToolResult(step_id=step_id, tool=tool, status="ok", output=output, data=data or {})


def error_result(
    *, step_id: str, tool: str, message: str, data: dict[str, Any] | None = None
) -> ToolResult:
    return ToolResult(
        step_id=step_id,
        tool=tool,
        status="error",
        output=message,
        data=data or {},
        error=message,
    )


def not_implemented_result(*, step_id: str, tool: str) -> ToolResult:
    return error_result(
        step_id=step_id,
        tool=tool,
        message=f"{tool} is not implemented in this phase; orchestration only",
        data={"code": "not_implemented"},
    )


def tool_timestamp() -> str:
    return now_utc().isoformat()
