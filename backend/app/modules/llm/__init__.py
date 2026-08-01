"""LLM gateway (Part 10) — provider-agnostic abstraction for outbound AI calls.

Ships the port (``base.LLMProvider``), the Gemini adapter, and the fail-closed
factory. Streaming, fallback routing and token accounting are later-phase work
(Part 10.4/10.5); the port shape already accommodates them.
"""

from __future__ import annotations

from app.modules.llm.base import LLMMessage, LLMProvider, LLMResponse
from app.modules.llm.factory import build_llm_provider

__all__ = [
    "LLMMessage",
    "LLMProvider",
    "LLMResponse",
    "build_llm_provider",
]
