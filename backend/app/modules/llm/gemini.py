"""Gemini provider (Part 10.2 — ``GeminiProvider`` via the google-genai SDK).

Only ``generate_content`` (non-streaming) is exposed. The SDK client is created
lazily inside ``__init__`` so importing this module never requires credentials.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.exceptions import ConfigurationError
from app.modules.llm.base import LLMMessage, LLMResponse


@dataclass(frozen=True)
class GeminiUsage:
    """Advertised completion metadata from Gemini (may be absent)."""

    output_tokens: int = 0
    total_tokens: int = 0


class GeminiProvider:
    """google-genai backed provider for Google Gemini models."""

    def __init__(self, *, api_key: str | None, model: str = "gemini-2.0-flash") -> None:
        if not api_key:
            raise ConfigurationError(
                "GEMINI_API_KEY is not configured; set it before enabling the Gemini provider"
            )
        from google import genai

        self.model = model
        self._client = genai.Client(api_key=api_key)

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> LLMResponse:
        from google.genai import types

        system_instruction = next(
            (message.content for message in messages if message.role == "system"), None
        )
        contents = [
            {
                "role": "model" if message.role == "assistant" else "user",
                "parts": [message.content],
            }
            for message in messages
            if message.role != "system"
        ]
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
            temperature=temperature,
        )
        response = self._client.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )
        text = getattr(response, "text", None) or ""
        usage = getattr(response, "usage_metadata", None)
        return LLMResponse(
            content=text.strip(),
            model=self.model,
            usage={
                "prompt_tokens": int(getattr(usage, "prompt_token_count", 0) or 0),
                "completion_tokens": int(getattr(usage, "candidates_token_count", 0) or 0),
                "total_tokens": int(getattr(usage, "total_token_count", 0) or 0),
            },
        )
