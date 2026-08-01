"""Text splitters (Part 6.2 — recursive character splitter, LlamaIndex alternative).

Both frameworks are behind the narrow ``TextSplitter`` port so the chunk manager
never depends on a specific library. LangChain's ``RecursiveCharacterTextSplitter``
is the default; LlamaIndex's ``SentenceSplitter`` is the alternative selected via
``RAG_SPLITTER``. The LlamaIndex splitter is given an explicit sentence tokenizer
so NLTK is never imported (it would trip Python's import-security guard when the
repo venv lives under the project root).
"""

from __future__ import annotations

import re
from typing import Protocol

from app.core.config import Settings
from app.core.exceptions import ConfigurationError

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")


def estimate_tokens(text: str) -> int:
    """Cheap deterministic token estimate (≈ 4 chars/token, BPE-ballpark).

    Good enough for the ``token_count`` column and the context-budget guard;
    exact tokenization is a provider-side concern.
    """
    return max(1, (len(text) + 3) // 4)


class TextSplitter(Protocol):
    def split(self, text: str, *, chunk_size: int, chunk_overlap: int) -> list[str]: ...


class LangChainTextSplitter:
    """Recursive character splitter (tunable chunk_size/overlap per Part 6.2)."""

    def split(self, text: str, *, chunk_size: int, chunk_overlap: int) -> list[str]:
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            add_start_index=False,
        )
        return splitter.split_text(text)


class LlamaIndexTextSplitter:
    """SentenceSplitter from llama-index-core with a regex sentence tokenizer.

    ``chunk_size``/``chunk_overlap`` are interpreted by LlamaIndex as tokens; the
    custom ``chunking_tokenizer_fn`` avoids the NLTK punkt dependency entirely."""

    def split(self, text: str, *, chunk_size: int, chunk_overlap: int) -> list[str]:
        from llama_index.core.node_parser import SentenceSplitter

        splitter = SentenceSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            chunking_tokenizer_fn=_sentence_tokenize,
        )
        return splitter.split_text(text)


def _sentence_tokenize(text: str) -> list[str]:
    return [part.strip() for part in _SENTENCE_SPLIT_RE.split(text) if part.strip()]


def build_splitter(settings: Settings) -> TextSplitter:
    key = settings.rag_splitter.strip().lower()
    if key == "langchain":
        return LangChainTextSplitter()
    if key == "llamaindex":
        return LlamaIndexTextSplitter()
    raise ConfigurationError(
        f"Unknown RAG splitter {settings.rag_splitter!r}; expected 'langchain' or 'llamaindex'"
    )
