"""Decision trace logger (Part 7.1 + P6) — every agent step is observable.

Collects a structured, append-only, timestamped event stream for one run:
query received → plan created (or fallback) → per-step start/finish/retry →
run finished. In this phase the stream is held in memory and returned with the
run result (the inspector UI and the ``agent_logs``/``tool_calls`` persistence
tables from Part 7.2 land with streaming). Events are plain dicts so they
serialize directly to JSON for the trace field and future SSE ``tool_*`` events.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.modules.auth.tokens import now_utc


@dataclass
class DecisionTraceLogger:
    _events: list[dict[str, Any]] = field(default_factory=list, init=False)

    def record(self, event: str, **fields: Any) -> None:
        entry: dict[str, Any] = {"at": now_utc().isoformat(), "event": event}
        entry.update(fields)
        self._events.append(entry)

    def events(self) -> list[dict[str, Any]]:
        return list(self._events)

    def snapshot(self) -> list[dict[str, Any]]:
        return list(self._events)
