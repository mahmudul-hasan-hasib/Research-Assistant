"""Agent module tests (Part 7): tool schema/registry, planner (LLM + fallback),
executor (dependency DAG, retries, timeouts), task memory, decision trace,
orchestrator end-to-end, and the agent API flow."""

from __future__ import annotations

import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.exceptions import ConfigurationError
from app.main import create_app
from app.modules.agent.decision_trace import DecisionTraceLogger
from app.modules.agent.executor import Executor
from app.modules.agent.memory import AgentMemory
from app.modules.agent.orchestrator import AgentService
from app.modules.agent.planner import Plan, Planner
from app.modules.agent.tools.base import (
    ToolCall,
    ToolContext,
    ToolResult,
    ToolSpec,
    error_result,
    ok_result,
)
from app.modules.agent.tools.registry import ToolRegistry, build_default_registry
from app.modules.llm.fake import FakeLLMProvider
from app.modules.rag.embeddings import HashingEmbedder
from app.modules.rag.models import Document, DocumentChunk, DocumentStatus
from app.modules.rag.retrieval import RetrievalService
from app.modules.rag.vectorstore import InMemoryVectorStore
from app.shared.base import Base
from app.shared.database import build_engine, build_session_factory

CREDENTIALS = {"email": "user@example.com", "password": "correct-horse-battery", "display_name": "Ada"}

QUANTUM_TEXT = (
    "Quantum entanglement is a physical phenomenon where two or more particles "
    "become correlated such that the state of one cannot be described "
    "independently of the others. This correlation persists even when the "
    "particles are separated by large distances. Albert Einstein famously "
    "described entanglement as spooky action at a distance, while modern "
    "experiments continue to probe its role in quantum information science."
)


class _StubRoleRetrieval:
    def retrieve(self, **kwargs):
        raise AssertionError("stub retrieval service must not be called")


@pytest.fixture
def agent_settings(tmp_path) -> Settings:
    return Settings(
        app_name="insight-test",
        app_env="test",
        debug=False,
        log_level="CRITICAL",
        cors_origins=["http://localhost:3000"],
        database_url=f"sqlite:///{tmp_path / 'agent.db'}",
        jwt_secret_key="test-secret-with-at-least-32-characters",
        storage_backend="local",
        storage_local_root=str(tmp_path / "storage"),
        embedding_provider="memory",
        embedding_dimensions=32,
        vector_store_backend="memory",
        rag_splitter="langchain",
    )


@pytest.fixture
def client(agent_settings: Settings) -> TestClient:
    app = create_app(agent_settings)
    assert app.state.container.engine is not None
    Base.metadata.create_all(app.state.container.engine)
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def _make_retrieval_service(agent_settings: Settings, *, seed: bool = False) -> tuple[RetrievalService, uuid.UUID]:
    engine = build_engine(agent_settings.database_url)
    session_factory = build_session_factory(engine)
    Base.metadata.create_all(engine)
    store = InMemoryVectorStore(dims=32)
    embedder = HashingEmbedder(dims=32)
    service = RetrievalService(
        session_factory=session_factory,
        embedder=embedder,
        vector_store=store,
        top_k=5,
        dense_oversample=4,
        dense_weight=0.5,
        lexical_weight=0.5,
    )
    user_id = uuid.uuid4()
    if seed:
        doc_id = uuid.uuid4()
        with session_factory() as session:
            session.add(
                Document(
                    id=doc_id,
                    uploader_id=user_id,
                    name="quantum.txt",
                    mime="text/plain",
                    size_bytes=100,
                    storage_key="uploads/x/q.txt",
                    status=DocumentStatus.READY.value,
                    source_type="upload",
                )
            )
            session.add(DocumentChunk(document_id=doc_id, index=0, content=QUANTUM_TEXT, token_count=50))
            session.commit()
            session.flush()
            from sqlalchemy import select

            chunk_id = session.scalars(select(DocumentChunk.id)).first()
            session.commit()
        vector = embedder.embed([QUANTUM_TEXT])[0]
        store.add([vector], [f"{doc_id}:{chunk_id}"])
    return service, user_id


def _ctx(user_id: uuid.UUID, role: str = "user") -> ToolContext:
    return ToolContext(user_id=user_id, role=role)


def _noop_executor(*, args: dict, ctx: ToolContext) -> ToolResult:
    return ok_result(step_id=ctx.step_id, tool="noop", output="done")


def _register(client: TestClient) -> dict:
    response = client.post("/api/v1/auth/register", json=CREDENTIALS)
    assert response.status_code == 201, response.text
    return response.json()


def _ready_upload(client: TestClient, token: str, *, filename: str, content_type: str, data: bytes) -> dict:
    result = client.post(
        "/api/v1/uploads/presign",
        json={"filename": filename, "content_type": content_type, "size_bytes": len(data)},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.app.state.container.storage.put_bytes(result["storage_key"], data, content_type=content_type)
    response = client.post(
        f"/api/v1/uploads/{result['upload_id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    return result


def _ingest(client: TestClient, token: str, upload_id: str) -> dict:
    response = client.post(
        "/api/v1/rag/documents",
        json={"upload_id": upload_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201, response.text
    return response.json()


# --- tool registry -------------------------------------------------------------


def test_build_default_registry_registers_phase8_tools(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    assert set(registry.names()) == {"rag_tool", "vision_tool", "nlp_tool"}
    assert registry.get("rag_tool") is not None
    assert registry.get("rag_tool").visible_to is None


def test_tool_registry_filters_by_role() -> None:
    registry = ToolRegistry()
    registry.register(
        ToolSpec(
            name="admin_only",
            description="",
            parameters={},
            executor=_noop_executor,
            visible_to=frozenset({"admin"}),
        )
    )
    registry.register(ToolSpec(name="everyone", description="", parameters={}, executor=_noop_executor))
    assert "admin_only" not in registry.names(role="user")
    assert "admin_only" in registry.names(role="admin")
    assert "everyone" in registry.names(role="user")


def test_tool_registry_rejects_duplicates() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="dup", description="", parameters={}, executor=_noop_executor))
    with pytest.raises(ConfigurationError):
        registry.register(ToolSpec(name="dup", description="", parameters={}, executor=_noop_executor))


def test_placeholder_tools_report_not_implemented() -> None:
    registry = build_default_registry(_StubRoleRetrieval())
    for name in ("vision_tool", "nlp_tool"):
        spec = registry.get(name)
        assert spec is not None
        result = spec.executor(args={}, ctx=_ctx(uuid.uuid4()))
        assert result.status == "error"
        assert result.data.get("code") == "not_implemented"
        assert name in result.output


# --- planner -------------------------------------------------------------------


def test_planner_parses_llm_plan(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(
        responses=[
            json.dumps(
                {
                    "rationale": "retrieve the passage, then translate it",
                    "steps": [
                        {"id": "step-1", "tool": "rag_tool", "args": {"query": "quantum entanglement"}},
                        {
                            "id": "step-2",
                            "tool": "nlp_tool",
                            "args": {"text": "x", "operation": "translate", "language": "bn"},
                            "depends_on": ["step-1"],
                        },
                    ],
                }
            )
        ]
    )
    planner = Planner(provider=provider, registry=registry)
    plan = planner.plan(query="Summarize this PDF and translate it into Bangla", role="user")
    assert plan.source == "llm"
    assert plan.rationale == "retrieve the passage, then translate it"
    assert [step.tool for step in plan.steps] == ["rag_tool", "nlp_tool"]
    assert plan.steps[1].depends_on == ("step-1",)
    assert provider.calls[0][0].role == "system"


def test_planner_falls_back_without_provider(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    plan = Planner(provider=None, registry=registry).plan(
        query="what is quantum entanglement", role="user"
    )
    assert plan.source == "fallback"
    assert plan.steps[0].tool == "rag_tool"
    assert plan.steps[0].args == {"query": "what is quantum entanglement"}


def test_planner_falls_back_on_unparseable_output(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(responses=["this is definitely not a json plan"])
    plan = Planner(provider=provider, registry=registry).plan(query="hello", role="user")
    assert plan.source == "fallback"
    assert plan.steps[0].tool == "rag_tool"


def test_planner_drops_unavailable_tool(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(
        responses=[
            json.dumps(
                {
                    "steps": [
                        {"id": "step-1", "tool": "explode_tool", "args": {}},
                        {"id": "step-2", "tool": "rag_tool", "args": {"query": "q"}},
                    ]
                }
            )
        ]
    )
    plan = Planner(provider=provider, registry=registry).plan(query="q", role="user")
    assert plan.source == "llm"
    assert [step.tool for step in plan.steps] == ["rag_tool"]


def test_planner_falls_back_when_all_tools_unavailable(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(
        responses=[json.dumps({"steps": [{"id": "step-1", "tool": "explode_tool", "args": {}}]})]
    )
    plan = Planner(provider=provider, registry=registry).plan(query="q", role="user")
    assert plan.source == "fallback"


def test_planner_caps_step_count(agent_settings: Settings) -> None:
    service, _ = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(
        responses=[
            json.dumps(
                {
                    "steps": [
                        {"id": "step-1", "tool": "rag_tool", "args": {"query": "a"}},
                        {"id": "step-2", "tool": "rag_tool", "args": {"query": "b"}},
                        {"id": "step-3", "tool": "rag_tool", "args": {"query": "c"}},
                    ]
                }
            )
        ]
    )
    plan = Planner(provider=provider, registry=registry, max_steps=2).plan(query="q", role="user")
    assert len(plan.steps) == 2


# --- executor ------------------------------------------------------------------


def test_executor_runs_dependent_steps_in_order(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings, seed=True)
    registry = build_default_registry(service)
    plan = Plan(
        steps=[
            ToolCall(step_id="step-1", tool="rag_tool", args={"query": "quantum entanglement"}),
            ToolCall(
                step_id="step-2",
                tool="nlp_tool",
                args={"text": "x", "operation": "translate", "language": "bn"},
                depends_on=("step-1",),
            ),
        ]
    )
    memory = AgentMemory(query="quantum")
    logger = DecisionTraceLogger()
    results = Executor(registry=registry).execute(plan=plan, ctx=_ctx(user_id), memory=memory, logger=logger)
    assert results["step-1"].status == "ok"
    assert "quantum" in results["step-1"].output.lower()
    assert results["step-2"].status == "error"
    assert list(memory.results()) == ["step-1", "step-2"]
    assert [event["event"] for event in logger.events()] == [
        "step_started",
        "step_finished",
        "step_started",
        "step_finished",
    ]


def test_executor_runs_independent_steps_in_same_wave(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    plan = Plan(
        steps=[
            ToolCall(step_id="step-1", tool="nlp_tool", args={}),
            ToolCall(step_id="step-2", tool="vision_tool", args={}),
        ]
    )
    memory = AgentMemory()
    results = Executor(registry=registry).execute(plan=plan, ctx=_ctx(user_id), memory=memory, logger=DecisionTraceLogger())
    assert set(results) == {"step-1", "step-2"}
    assert results["step-1"].status == "error"
    assert results["step-2"].status == "error"


def test_executor_rejects_dependency_cycle(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    plan = Plan(
        steps=[
            ToolCall(step_id="step-1", tool="rag_tool", args={"query": "q"}, depends_on=("step-2",)),
            ToolCall(step_id="step-2", tool="rag_tool", args={"query": "q"}, depends_on=("step-1",)),
        ]
    )
    with pytest.raises(ConfigurationError):
        Executor(registry=registry).execute(
            plan=plan, ctx=_ctx(user_id), memory=AgentMemory(), logger=DecisionTraceLogger()
        )


def test_executor_handles_missing_tool(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    plan = Plan(steps=[ToolCall(step_id="s1", tool="ghost_tool", args={})])
    results = Executor(registry=registry).execute(
        plan=plan, ctx=_ctx(user_id), memory=AgentMemory(), logger=DecisionTraceLogger()
    )
    assert results["s1"].status == "error"
    assert "not available" in results["s1"].output


def test_executor_retries_then_succeeds() -> None:
    registry = ToolRegistry()
    attempts = {"count": 0}

    def flaky(*, args: dict, ctx: ToolContext) -> ToolResult:
        attempts["count"] += 1
        if attempts["count"] == 1:
            return error_result(step_id=ctx.step_id, tool="flaky", message="transient failure")
        return ok_result(step_id=ctx.step_id, tool="flaky", output="recovered")

    registry.register(
        ToolSpec(name="flaky", description="", parameters={}, executor=flaky, retries=1)
    )
    plan = Plan(steps=[ToolCall(step_id="s1", tool="flaky", args={})])
    logger = DecisionTraceLogger()
    results = Executor(registry=registry).execute(
        plan=plan, ctx=_ctx(uuid.uuid4()), memory=AgentMemory(), logger=logger
    )
    assert results["s1"].status == "ok"
    assert results["s1"].output == "recovered"
    assert attempts["count"] == 2
    assert "step_retrying" in [event["event"] for event in logger.events()]


def test_executor_enforces_timeout() -> None:
    registry = ToolRegistry()

    def slow(*, args: dict, ctx: ToolContext) -> ToolResult:
        time.sleep(0.2)
        return ok_result(step_id=ctx.step_id, tool="slow", output="late")

    registry.register(
        ToolSpec(name="slow", description="", parameters={}, executor=slow, timeout_seconds=0.05)
    )
    plan = Plan(steps=[ToolCall(step_id="s1", tool="slow", args={})])
    results = Executor(registry=registry).execute(
        plan=plan, ctx=_ctx(uuid.uuid4()), memory=AgentMemory(), logger=DecisionTraceLogger()
    )
    assert results["s1"].status == "error"
    assert "exceeded" in results["s1"].output


# --- memory + decision trace ----------------------------------------------------


def test_agent_memory_scratchpad() -> None:
    memory = AgentMemory(query="q")
    memory.remember("a", ok_result(step_id="a", tool="t", output="one"))
    memory.remember("b", ok_result(step_id="b", tool="t", output="two"))
    assert memory.step("a").output == "one"
    assert memory.step("missing") is None
    assert memory.observations() == ["one", "two"]
    assert set(memory.results()) == {"a", "b"}


def test_decision_trace_records_events_in_order() -> None:
    logger = DecisionTraceLogger()
    logger.record("plan_created", steps=[1])
    logger.record("step_finished", step_id="s1", status="ok")
    events = logger.snapshot()
    assert [event["event"] for event in events] == ["plan_created", "step_finished"]
    assert events[0]["at"]
    assert events[0]["steps"] == [1]


# --- orchestrator ----------------------------------------------------------------


def test_agent_run_end_to_end_multi_step(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings, seed=True)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(
        responses=[
            json.dumps(
                {
                    "rationale": "retrieve the passage, then translate it",
                    "steps": [
                        {"id": "step-1", "tool": "rag_tool", "args": {"query": "quantum entanglement"}},
                        {
                            "id": "step-2",
                            "tool": "nlp_tool",
                            "args": {"text": "x", "operation": "translate", "language": "bn"},
                            "depends_on": ["step-1"],
                        },
                    ],
                }
            )
        ]
    )
    agent = AgentService(
        planner=Planner(provider=provider, registry=registry),
        executor=Executor(registry=registry),
        registry=registry,
    )
    result = agent.run(
        user_id=user_id,
        role="user",
        query="Summarize this PDF and translate it into Bangla",
    )
    assert result.plan.source == "llm"
    assert len(result.results) == 2
    assert result.results["step-1"].status == "ok"
    assert result.results["step-2"].status == "error"
    assert "not implemented" in result.results["step-2"].output
    assert "Note:" in result.final_answer
    assert result.citations
    events = [event["event"] for event in result.trace]
    assert {"query_received", "plan_created", "step_started", "step_finished", "run_finished"} <= set(events)


def test_agent_run_falls_back_to_rag_without_llm(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings, seed=True)
    registry = build_default_registry(service)
    agent = AgentService(
        planner=Planner(provider=None, registry=registry),
        executor=Executor(registry=registry),
        registry=registry,
    )
    result = agent.run(user_id=user_id, role="user", query="quantum entanglement")
    assert result.plan.source == "fallback"
    assert result.results["step-1"].status == "ok"
    assert "Retrieved" in result.final_answer
    assert result.citations


def test_agent_run_empty_plan(agent_settings: Settings) -> None:
    service, user_id = _make_retrieval_service(agent_settings)
    registry = build_default_registry(service)
    provider = FakeLLMProvider(responses=[json.dumps({"steps": []})])
    agent = AgentService(
        planner=Planner(provider=provider, registry=registry),
        executor=Executor(registry=registry),
        registry=registry,
    )
    result = agent.run(user_id=user_id, role="user", query="hello there")
    assert result.plan.source == "llm"
    assert result.results == {}
    assert result.final_answer == "No tool steps were required to answer this query."


# --- API flow -------------------------------------------------------------------


def test_agent_run_requires_auth(client: TestClient) -> None:
    assert client.post("/api/v1/agent/run", json={"query": "x"}).status_code == 401


def test_agent_run_api_flow(client: TestClient) -> None:
    token = _register(client)["access_token"]
    upload = _ready_upload(
        client, token, filename="quantum.txt", content_type="text/plain", data=QUANTUM_TEXT.encode()
    )
    _ingest(client, token, upload["upload_id"])

    response = client.post(
        "/api/v1/agent/run",
        json={"query": "quantum entanglement"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "fallback"
    assert body["steps"][0]["tool"] == "rag_tool"
    assert body["steps"][0]["status"] == "ok"
    assert body["final_answer"]
    assert body["citations"]
    events = {event["event"] for event in body["trace"]}
    assert {"query_received", "plan_created", "step_started", "step_finished", "run_finished"} <= events


def test_agent_run_rejects_empty_query(client: TestClient) -> None:
    token = _register(client)["access_token"]
    response = client.post(
        "/api/v1/agent/run",
        json={"query": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
