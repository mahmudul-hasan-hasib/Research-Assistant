"""Placeholder tools (Part 7.1) — Vision and NLP capabilities that are not yet
implemented (Milestone 8 is orchestration only).

Each is a real registry entry with a declared schema and executor, but the
executor answers "not implemented" so an agent step that calls them completes
with a structured error in its trace instead of crashing the run.
"""

from __future__ import annotations

from typing import Any

from app.modules.agent.tools.base import (
    ToolContext,
    ToolResult,
    ToolSpec,
    not_implemented_result,
)

VISION_TOOL_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "source": {
            "type": "string",
            "description": "Reference to the image or asset to analyze.",
        },
        "question": {
            "type": "string",
            "description": "Optional visual question to answer about the image.",
        },
    },
    "required": ["source"],
}

NLP_TOOL_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "text": {"type": "string", "description": "The text to transform."},
        "operation": {
            "type": "string",
            "enum": ["translate", "summarize", "extract"],
            "description": "NLP operation to perform on the text.",
        },
        "language": {
            "type": "string",
            "description": "Target language for translation (e.g. 'bn', 'Bangla').",
        },
    },
    "required": ["text", "operation"],
}


def _executor(name: str):
    def execute(*, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
        return not_implemented_result(step_id=ctx.step_id, tool=name)

    return execute


def build_placeholder_tools() -> list[ToolSpec]:
    return [
        ToolSpec(
            name="vision_tool",
            description=(
                "Analyze an image or scanned page — OCR, layout, charts, or "
                "visual question answering. Not implemented in this phase."
            ),
            parameters=VISION_TOOL_PARAMETERS,
            executor=_executor("vision_tool"),
        ),
        ToolSpec(
            name="nlp_tool",
            description=(
                "Text transformations such as translation, summarization, and "
                "entity extraction. Not implemented in this phase."
            ),
            parameters=NLP_TOOL_PARAMETERS,
            executor=_executor("nlp_tool"),
        ),
    ]
