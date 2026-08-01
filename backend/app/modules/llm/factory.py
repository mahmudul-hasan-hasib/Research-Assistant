"""LLM provider factory (Part 10.3 — provider key → adapter class, fail closed).

New providers register in ``_PROVIDERS``; callers never branch on provider keys
(OCP). Unknown keys raise ``ConfigurationError`` so a typo in configuration can
never silently degrade to a different provider (P7).
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.config import Settings
from app.core.exceptions import ConfigurationError
from app.modules.llm.base import LLMProvider
from app.modules.llm.gemini import GeminiProvider

ProviderFactory = Callable[[Settings], LLMProvider]


def _build_gemini(settings: Settings) -> GeminiProvider:
    return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)


_PROVIDERS: dict[str, ProviderFactory] = {
    "gemini": _build_gemini,
}


def build_llm_provider(settings: Settings) -> LLMProvider:
    """Build the active provider. Fails closed on unknown/misconfigured keys."""
    key = settings.active_llm_provider.strip().lower()
    factory = _PROVIDERS.get(key)
    if factory is None:
        raise ConfigurationError(
            f"Unknown LLM provider {settings.active_llm_provider!r}; "
            f"supported providers: {sorted(_PROVIDERS)}"
        )
    return factory(settings)
