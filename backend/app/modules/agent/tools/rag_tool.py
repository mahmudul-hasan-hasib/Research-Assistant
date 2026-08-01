"""``rag_tool`` (Part 7.1) — hybrid retrieval over the user's ingested documents.

Wraps ``RetrievalService`` so the agent can ground answers in uploaded research.
The tool stays user-scoped: the user id comes from ``ToolContext``, never from
planner-supplied args. The result's ``data`` carries structured hits + citations
so later stages (trace, a future synthesizer) can project them into API schemas.
"""

from __future__ import annotations

from typing import Any

from app.modules.agent.tools.base import ToolContext, ToolResult, ok_result
from app.modules.rag.retrieval import RetrievalService

_RAG_TOOL_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "The search question to ground in the user's documents.",
        },
        "top_k": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "default": 8,
            "description": "Maximum number of passages to return.",
        },
    },
    "required": ["query"],
}


class RagTool:
    def __init__(self, retrieval_service: RetrievalService) -> None:
        self._retrieval = retrieval_service

    def execute(self, *, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
        query = str(args.get("query") or "").strip()
        if not query:
            raise ValueError("rag_tool requires a non-empty 'query' argument")
        top_k = args.get("top_k")
        result = self._retrieval.retrieve(
            user_id=ctx.user_id,
            query=query,
            top_k=int(top_k) if top_k else None,
        )
        output = _format_hits(result.hits, result.citations)
        return ok_result(
            step_id="",
            tool="rag_tool",
            output=output,
            data={
                "query": result.query,
                "rewritten_query": result.rewritten_query,
                "hits": [_hit_data(hit) for hit in result.hits],
                "citations": [_citation_data(citation) for citation in result.citations],
            },
        )


def _hit_data(hit) -> dict[str, Any]:
    return {
        "chunk_id": str(hit.chunk_id),
        "document_id": str(hit.document_id),
        "document_name": hit.document_name,
        "score": hit.score,
        "page": hit.page,
        "heading": hit.heading,
    }


def _citation_data(citation) -> dict[str, Any]:
    return {
        "index": citation.index,
        "chunk_id": str(citation.chunk_id),
        "document_id": str(citation.document_id),
        "document_name": citation.document_name,
        "page": citation.page,
        "heading": citation.heading,
        "snippet": citation.snippet,
        "score": citation.score,
    }


def _format_hits(hits, citations) -> str:
    if not hits:
        return "No relevant passages were found in the user's documents."
    lines: list[str] = [f"Retrieved {len(hits)} passage(s):"]
    by_chunk = {str(citation.chunk_id): citation for citation in citations}
    for position, hit in enumerate(hits, start=1):
        citation = by_chunk.get(str(hit.chunk_id))
        source = citation.document_name if citation is not None else hit.document_name
        if citation is not None and citation.page is not None:
            source = f"{source} (p. {citation.page})"
        snippet = " ".join(hit.content.split())[:200]
        lines.append(f"[{position}] {source}: {snippet}")
    return "\n".join(lines)


def build_rag_tool(retrieval_service: RetrievalService):
    from app.modules.agent.tools.base import ToolSpec

    tool = RagTool(retrieval_service)
    return ToolSpec(
        name="rag_tool",
        description=(
            "Search the user's ingested documents and return the most relevant "
            "passages (hybrid dense + lexical retrieval). Use for questions "
            "grounded in uploaded research documents."
        ),
        parameters=_RAG_TOOL_PARAMETERS,
        executor=tool.execute,
        latency_class="high",
    )
