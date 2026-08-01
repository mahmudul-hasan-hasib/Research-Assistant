"""Agent API contracts (Part 4.1 — strict Pydantic schemas at every boundary)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

StepStatusType = Literal["ok", "error"]
PlanSourceType = Literal["llm", "fallback"]


class AgentRunRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)


class AgentStepOut(BaseModel):
    step_id: str
    tool: str
    status: StepStatusType
    args: dict[str, Any]
    output: str
    error: str | None = None


class AgentRunResponse(BaseModel):
    query: str
    rationale: str | None = None
    source: PlanSourceType
    steps: list[AgentStepOut]
    final_answer: str
    citations: list[dict[str, Any]]
    trace: list[dict[str, Any]]
