"""Per-request trace context.

Every request receives a `trace_id` that is propagated to logs, exceptions and
responses so one user action is one searchable trace (Part 12).
"""

from __future__ import annotations

import contextvars
import uuid

_trace_id: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="")


def new_trace_id() -> str:
    return uuid.uuid4().hex


def get_trace_id() -> str:
    return _trace_id.get()


def set_trace_id(value: str | None = None) -> str:
    trace_id = value or new_trace_id()
    _trace_id.set(trace_id)
    return trace_id
