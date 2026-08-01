"""LLM gateway ports (Part 10 — provider-independent interface).

Only the synchronous ``complete`` contract ships in this phase. Streaming,
routing/fallback and token accounting (Part 10.4/10.5) land with the Agent in a
later phase; the port is shaped so they can be added without touching callers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class LLMMessage:
    """One chat-turn message. Roles mirror the OpenAI convention; providers map
    them to their native schema (e.g. Gemini ``system_instruction``)."""

    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    usage: dict[str, int] = field(default_factory=dict)


class LLMProvider(Protocol):
    """Narrow port: complete a prompt synchronously. Returns normalized text.

    Implementations must not raise transport errors directly; the factory fails
    closed (Part 10.3) and callers treat any provider error as an unavailable
    capability (the retrieval query-rewriter degrades gracefully).
    """

    model: str

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> LLMResponse: ...
