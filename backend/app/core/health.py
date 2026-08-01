"""Health-check registry (Part 13.5).

``/healthz`` is the liveness probe (no dependencies). ``/readyz`` runs every
registered check. DB/Redis/worker checks are registered by later phases; the
registry is empty until then.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class HealthStatus:
    ok: bool
    detail: str = ""


HealthCheck = Callable[[], HealthStatus]


@dataclass
class HealthRegistry:
    _checks: dict[str, HealthCheck] = field(default_factory=dict)

    def register(self, name: str, check: HealthCheck) -> None:
        self._checks[name] = check

    def check_all(self) -> dict[str, HealthStatus]:
        return {name: check() for name, check in self._checks.items()}
