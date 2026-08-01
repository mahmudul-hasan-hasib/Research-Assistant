"""Tool registry (Part 7.1 — name → ``ToolSpec``, declarative registration).

Tools register with a decorator (for dependency-free executors) or via
``register`` for executors that need injected services (e.g. ``rag_tool`` wraps
``RetrievalService``). The registry owns visibility: ``list`` only yields specs
the caller's role may invoke, so the planner can never be steered toward tools a
user must not reach (Part 11 RBAC).
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any

from app.core.exceptions import ConfigurationError
from app.modules.agent.tools.base import ToolContext, ToolResult, ToolSpec


@dataclass
class ToolRegistry:
    _specs: dict[str, ToolSpec] = field(default_factory=dict)

    def register(self, spec: ToolSpec) -> None:
        if not spec.name:
            raise ConfigurationError(detail="Tool name must not be empty")
        if spec.name in self._specs:
            raise ConfigurationError(detail=f"Tool {spec.name!r} is already registered")
        self._specs[spec.name] = spec

    def decorator(
        self,
        *,
        name: str,
        description: str,
        parameters: dict[str, Any] | None = None,
        visible_to: Iterable[str] | None = None,
        retries: int = 0,
        timeout_seconds: float = 0.0,
    ) -> Callable[[Callable[..., ToolResult]], ToolResult]:
        """Register a dependency-free executor function as a tool."""

        def wrapper(fn: Callable[..., ToolResult]) -> ToolResult:
            spec = ToolSpec(
                name=name,
                description=description,
                parameters=parameters or {},
                executor=_FunctionExecutor(fn),
                visible_to=frozenset(visible_to) if visible_to is not None else None,
                retries=retries,
                timeout_seconds=timeout_seconds,
            )
            self.register(spec)
            return fn  # type: ignore[return-value]

        return wrapper

    def get(self, name: str) -> ToolSpec | None:
        return self._specs.get(name)

    def list(self, *, role: str | None = None) -> list[ToolSpec]:
        specs = list(self._specs.values())
        if role is None:
            return specs
        return [spec for spec in specs if spec.visible_to_role(role)]

    def names(self, *, role: str | None = None) -> list[str]:
        return [spec.name for spec in self.list(role=role)]


@dataclass(frozen=True)
class _FunctionExecutor:
    fn: Callable[..., ToolResult]

    def __call__(self, *, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
        return self.fn(args=args, ctx=ctx)


def build_default_registry(retrieval_service) -> ToolRegistry:
    """Assemble the phase-8 tool set (RAG + Vision/NLP placeholders).

    ``rag_tool`` needs the wired ``RetrievalService``; the placeholder tools are
    dependency-free. Called by the container once retrieval is built.
    """
    from app.modules.agent.tools.placeholders import build_placeholder_tools
    from app.modules.agent.tools.rag_tool import build_rag_tool

    registry = ToolRegistry()
    registry.register(build_rag_tool(retrieval_service))
    for spec in build_placeholder_tools():
        registry.register(spec)
    return registry
