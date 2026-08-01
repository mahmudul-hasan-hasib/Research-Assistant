"""Deterministic in-process LLM provider for tests and local development.

Not registered in the factory — it is injected directly where a fake is wanted
(e.g. the retrieval service query-rewriter in unit tests). ``responses`` lets a
test script an exact sequence of completions; unmatched calls echo the input so
tests fail loudly instead of hanging.
"""

from __future__ import annotations

from collections.abc import Callable

from app.modules.llm.base import LLMMessage, LLMResponse


class FakeLLMProvider:
    def __init__(
        self,
        *,
        responses: list[str] | Callable[[list[LLMMessage]], str] | None = None,
        model: str = "fake",
    ) -> None:
        self.model = model
        self._responses: list[str] = list(responses or [])
        self._callable: Callable[[list[LLMMessage]], str] | None = (
            responses if callable(responses) else None
        )
        self.calls: list[list[LLMMessage]] = []

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> LLMResponse:
        self.calls.append(messages)
        if self._callable is not None:
            content = self._callable(messages)
        elif self._responses:
            content = self._responses.pop(0)
        else:
            content = " ".join(message.content for message in messages if message.role == "user")
        return LLMResponse(content=content, model=self.model)
