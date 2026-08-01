# Insight — Production Architecture

> **Status:** Draft v1.0 — pending review and approval
> **Owner:** Platform Architecture Team
> **Scope:** Full-stack design for the multimodal Agentic AI Research Assistant

---

## 0. Design Principles (applied throughout)

Every decision in this document is justified against these principles. If a later decision
appears to conflict with an earlier one, revisit the earlier one — do not silently diverge.

| # | Principle | Why |
|---|-----------|-----|
| P1 | **Explicit module boundaries** | A team of 20 engineers needs ownership areas. Modules own their internals and expose interfaces (ports). |
| P2 | **Provider-agnostic AI core** | LLMs, vector stores, object storage, model registries are *providers behind ports* — switchable via configuration, never via code changes. |
| P3 | **API-first, event-driven internal flows** | FastAPI is the only client-facing surface. Long-running work (RAG ingestion, model inference) is asynchronous via Celery, never blocking the HTTP layer. |
| P4 | **Clean/layered architecture per module** | API → Service → Repository layering with dependency injection so every layer is unit-testable in isolation. |
| P5 | **Feature-based frontend** | Frontend is organized by business capability (chat, documents, workspace) not by file type. |
| P6 | **Everything observable** | Every request, agent step, tool call, model call, and pipeline stage is logged and/or traced. Nothing "just happens". |
| P7 | **Fail closed for security** | Deny by default: unknown file types, oversized payloads, unknown providers, unauthenticated access. |
| P8 | **Configuration is data, not code** | All environment-specific values live in config (`.env`/settings service); code has zero hardcoded environment knowledge. |
| P9 | **Async where I/O-bound, worker for CPU-bound** | Inference, embeddings, and vision are CPU/GPU-heavy → Celery workers. Web/DB/Redis I/O → asyncio in FastAPI. |
| P10 | **Migration-first data layer** | All schema changes are Alembic migrations. Never hand-edit schema. |

---

## 1. Part 1 — High-Level Architecture Diagram

### 1.1 Topology

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                        CLIENT                            │
                    │   Next.js 16 SPA (Browser) — React 19 / TS / Tailwind    │
                    └───────────────────────────┬──────────────────────────────┘
                                                │ HTTPS (WSS for streaming)
                                                ▼
                                ┌───────────────────────────────┐
                                │           Nginx               │
                                │  TLS termination · reverse    │
                                │  proxy · rate limit · gzip    │
                                └───────────────┬───────────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              │                                 │                                 │
              ▼                                 ▼                                 ▼
   ┌────────────────────┐            ┌────────────────────┐            ┌────────────────────┐
   │  FastAPI Backend   │            │  Next.js SSR/      │            │  MLflow UI (ops)   │
   │  (API Gateway)     │            │  Edge runtime      │            │  Experiment        │
   │  auth · agents ·   │            │  renders pages     │            │  tracking UI       │
   │  chat · docs · RAG │            └─────────┬──────────┘            └─────────┬──────────┘
   └──────┬─────────────┘                      │                                │
          │ sync calls                         │                                │
          ▼                                    ▼                                │
   ┌────────────────────┐            ┌────────────────────┐                      │
   │  PostgreSQL        │            │     Redis          │                      │
   │  metadata · users  │            │  cache · sessions  │                      │
   │  chat · docs · log │            │  pub/sub · rate    │                      │
   └────────────────────┘            │  limits · Celery   │                      │
                                     │  broker+backend    │                      │
                                     └─────────┬──────────┘                      │
                                               │                                  │
┌──────────────────────────────────────────────┼──────────────────────────────────┼───────────────────────────┐
│                     ASYNC WORKER PLANE                                        │                          │
│                                               ▼                                │                          │
│                                    ┌────────────────────┐                      │                          │
│                                    │  Celery Worker(s)  │                      │                          │
│                                    │  RAG ingest ·      │                      │                          │
│                                    │  embeddings ·       │                      │                          │
│                                    │  vision · NLP ·     │                      │                          │
│                                    │  summarization      │                      │                          │
│                                    └──────┬───────┬──────┘                      │                          │
│                                           │       │                            │                          │
│                                           ▼       ▼                            ▼                          ▼
│                                 ┌────────────┐  ┌─────────────┐        ┌───────────────┐    ┌──────────────────┐
│                                 │  Vector DB │  │ Object Store│        │  MLflow        │    │  Model Registry  │
│                                 │  FAISS/PG │  │  S3/MinIO   │        │  tracking      │    │  (HF Hub · MLflow│
│                                 │  /Pinecone │  │  uploads·   │        │  server        │    │   · local)       │
│                                 │            │  │  artifacts  │        │                │    │                  │
│                                 └────────────┘  └─────────────┘        └────────────────┘    └──────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                          LLM PROVIDER PLANE (outbound, controlled by gateway)
   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
   │  OpenAI   │  │  Gemini   │  │   Groq    │  │ DeepSeek  │  │  Ollama   │  ── optional GPU host
   └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
            All outbound AI traffic passes through the LLM Gateway / provider abstraction.
```

### 1.2 Data flow arrows (who talks to whom)

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Browser | Nginx | HTTPS/WSS | All user traffic; streaming chat via WebSocket or SSE |
| Nginx | FastAPI | HTTP | Reverse-proxied API calls |
| Nginx | Next.js | HTTP | SSR/edge page render, public assets |
| Nginx | MLflow UI | HTTP | Ops-only experiment browsing (VPN/IP-allowlisted) |
| FastAPI | PostgreSQL | TCP (psycopg) | CRUD for users, chats, messages, documents, logs |
| FastAPI | Redis | TCP (redis-py) | Cache, sessions, rate-limit counters, pub/sub events |
| FastAPI | Celery broker (Redis) | TCP | Enqueue long tasks (ingestion, inference) |
| FastAPI | LLM gateway | TCP | Synchronous/gated LLM calls used by the Agent runtime |
| Celery | Object Store | S3 SDK | Read uploads, write artifacts/preprocessed media |
| Celery | Vector DB | SDK | Write chunks/embeddings, delete stale vectors |
| Celery | MLflow | HTTP | Log metrics/params/models for experiments & eval |
| Celery | Model Registry | HTTP | Load versioned models (transformers cache / registry) |
| Celery | LLM gateway | TCP | Batch inference (summaries, translations, evaluations) |
| Celery | PostgreSQL | TCP | Persist task results, agent logs, eval outcomes |
| Next.js | FastAPI | HTTP/SSE | Fetch page data and consume streaming responses |

### 1.3 Deployment boundary

All boxes left of the dashed line run in Docker Compose on a single EC2 (Phase 9 → ECS/EKS).
All LLM providers are external SaaS except Ollama, which may run on a dedicated GPU host.

---

## 2. Part 2 — Repository Structure

A monorepo with independent deployable units. Ownership is mapped to folders so sub-teams
can own areas without merge conflicts. Code moves in only one direction:
`ml ← backend ← frontend ← deployment` (leaf packages never import upward).

```
Insight/
├── frontend/                  # Next.js 16 app — see Part 3
├── backend/                   # FastAPI monolith-as-modules — see Part 4
│   ├── app/
│   │   ├── api/               # HTTP layer (routers, schemas, dependencies)
│   │   ├── core/              # config, logging, exceptions, DI container
│   │   ├── modules/           # one package per module (auth, chat, vision, ...)
│   │   ├── workers/           # Celery app, task entrypoints, beat schedule
│   │   └── shared/            # cross-module helpers, db session, storage clients
│   ├── alembic/               # migrations
│   ├── tests/                 # unit + integration + e2e
│   └── pyproject.toml         # single source of dependency truth (uv/poetry)
├── ml/                        # training/eval/research code, model configs
│   ├── datasets/              # dataset versioning, loaders, preprocessing
│   ├── training/              # fine-tuning scripts (vision, sentiment, ...)
│   ├── evaluation/            # offline eval harness (benchmarks, metrics)
│   ├── registry/              # model card YAML + registry sync scripts
│   └── notebooks/             # ad-hoc research, kept off the critical path
├── deployment/                # infra as code
│   ├── docker/                # Dockerfiles per service
│   ├── compose/               # docker-compose overlays (dev, prod)
│   ├── nginx/                 # conf.d snippets
│   ├── terraform/             # AWS resources (EC2, RDS, S3, VPC)
│   └── k8s/                   # (future) helm manifests
├── docs/                      # architecture (this file), ADRs, runbooks, API refs
├── scripts/                   # bootstrap, migrate, seed, backup, healthcheck
├── experiments/               # MLflow-adjacent scratch — experiment tracking metadata
├── datasets/                  # (root-level cache; gitignored) source data for eval
├── .github/workflows/         # CI/CD pipelines — see Part 13
├── .env.example               # documented, secret-free env template
├── docker-compose.yml         # root orchestration entrypoint
├── Makefile                   # common dev commands (make up, make migrate, ...)
└── AGENTS.md                  # agent/LLM coding conventions (lint, test commands)
```

### 2.1 Folder purposes

| Folder | Purpose | Owned by |
|--------|---------|----------|
| `frontend/` | Next.js app; deploys as a static/SSR bundle | Frontend |
| `backend/` | API + workers; the only service with AI module code | Backend |
| `ml/` | Offline training/eval research; produces artifacts consumed by `backend` | ML |
| `deployment/` | Dockerfiles, compose overlays, nginx, Terraform, k8s | DevOps |
| `docs/` | Architecture, ADRs (Architecture Decision Records), runbooks, API contract | Platform |
| `scripts/` | Human-run ops: bootstrap, migrate, seed, backup, healthcheck | DevOps |
| `experiments/` | MLflow experiment pointers and notes (artifacts live in MLflow server) | ML |
| `datasets/` | Git-ignored source datasets for evals (never committed) | ML |
| `.github/workflows/` | CI/CD: lint, typecheck, test, build, deploy | DevOps |
| `Makefile` | Single entrypoint for common commands across sub-teams | Platform |

### 2.2 Why monorepo instead of microservices (yet)

- **Decision:** monorepo + modular monolith backend (one FastAPI app, many modules),
  designed so any module *can* be extracted into a service later.
- **Why not microservices now:** RAG/agent workloads share state (document → chunks →
  embeddings → chat) and would pay a heavy IPC tax for no operational need at team
  scale. The layered modules + Celery workers give us horizontal scaling of the hot path
  without the coordination overhead. Extraction boundaries are already seams (ports + DI).

### 2.3 Dependency rule

- `frontend` never imports `backend` code — communicates only via OpenAPI contract.
- `backend/modules` may import `backend/shared` and `backend/core`, never `backend/api`.
- `ml` never imports `backend`; it produces versioned artifacts + model cards.
- `deployment` references every other folder's artifacts but nothing imports it.

---

## 3. Part 3 — Frontend Architecture

### 3.1 Feature-based structure

```
frontend/
├── src/
│   ├── app/                     # Next.js App Router (routes = pages, layout, loading, error)
│   │   ├── (auth)/              # route group: login, signup, forgot-password
│   │   ├── (app)/               # route group: authenticated shell (sidebar, header)
│   │   │   ├── dashboard/
│   │   │   ├── chat/[chatId]/
│   │   │   ├── documents/
│   │   │   └── settings/
│   │   └── api/                 # optional BFF route handlers (only if needed)
│   ├── features/                # ★ one folder per business capability
│   │   ├── auth/                # login/signup logic, tokens
│   │   ├── chat/                # chat UI + streaming
│   │   ├── documents/           # upload, list, delete
│   │   ├── agent/               # tool-call inspector / step-by-step trace viewer
│   │   └── workspace/           # cross-cutting "app shell" (sidebar, provider switch)
│   ├── components/              # ★ shared, feature-agnostic UI primitives (shadcn/ui)
│   ├── services/                # ★ thin API client (fetch/axios wrapper, SSE)
│   ├── hooks/                   # ★ shared React hooks (debounce, auth, SSE, files)
│   ├── stores/                  # ★ Zustand stores (session, ui, chat draft state)
│   ├── types/                   # ★ TS types mirroring backend OpenAPI schemas
│   ├── utils/                   # ★ pure helpers (formatting, validation, math)
│   ├── lib/                     # non-UI singletons: query client, ws manager, logger
│   └── styles/                  # global css, tailwind config tokens
```

### 3.2 Why feature-based over folder-by-type

| Approach | Problem | Our choice |
|----------|---------|-----------|
| `components/` + `hooks/` + `services/` flat folders | A chat feature touches 4 scattered folders; refactors cross ownership | Each feature owns its UI+logic; only truly shared code lives in global folders |
| `pages/` only | Route-driven bloat; logic leaks into pages | App Router thin pages compose feature components |

Rule: a component used by exactly one feature lives in that feature. It "graduates" to
`components/` only when a second feature needs it (the "rule of two").

### 3.3 Shared primitives (`components/`)

Built on shadcn/ui: `Button`, `Input`, `Dialog`, `DropdownMenu`, `Toast`, `Skeleton`,
`Tooltip`, `ScrollArea`, `Tabs`. All are presentational; they accept props, never read stores.

### 3.4 Data flow

```
React Component  →  feature hook (useChat)  →  React Query mutation  →  services/apiClient
                                                                              │
   UI state (Zustand) ◄── optimistic update ◄─────────────────────────────────┘
                                                                              │ SSE stream
   chat messages ◄── onMessage handler ◄── services/streamClient (EventSource) │
   React Query cache = server state          Zustand = ephemeral UI state
```

- **Server state** (chats, documents, messages history): TanStack Query — caching,
  dedup, retries, refetch-on-focus. Never duplicated into Zustand.
- **Client/ephemeral state** (draft text, panel open/close, streaming buffer):
  Zustand. The streaming buffer is the one place messages are held transiently before
  they land in the Query cache.

### 3.5 State management decision

| Tool | Responsibility |
|------|----------------|
| TanStack Query | Server-state cache + mutations, polling fallback |
| Zustand | Small, fast client state; provider selector, streaming buffer, UI flags |
| Framer Motion | Animation only — never used to store state |

No Redux: the state is mostly server state; Redux would duplicate the Query cache and add
boilerplate with no benefit at this scale.

### 3.6 Routing

- App Router route groups `(auth)` and `(app)`:
  - `(auth)` renders bare (no sidebar), enforces `redirect('/login')` for authed users.
  - `(app)` wraps everything in the authenticated shell; its `layout.tsx` runs an
    `AuthProvider` guard and renders `Sidebar` + `Header`.
- URL model: `/chat/[chatId]` is the canonical chat URL so it is shareable/bookmarkable.

### 3.7 Authentication flow

```
1. User submits credentials on /login
2. services/apiClient POST /api/v1/auth/login  →  { access_token, refresh_token, user }
3. Zustand auth store caches user profile
4. access_token stored in memory (and cookie if `httpOnly`-cookie mode) — NOT localStorage
   → avoids XSS token theft; refresh flow renews on 401 via queryClient interceptor
5. Every apiClient request attaches `Authorization: Bearer <token>`
6. On 401 → single-flight refresh → retry once → else redirect to /login
```

### 3.8 File upload flow

```
1. User drops file → feature hook validates type/size client-side (allowed types,
   ≤ 100 MB) against the same constants the backend enforces
2. apiClient POST /api/v1/uploads/presign  → { upload_id, presigned_url }
   (S3 presigned PUT; avoids proxying large bytes through FastAPI)
3. Browser PUTs bytes directly to object store
4. apiClient POST /api/v1/uploads/{upload_id}/complete → backend validates + parses file
5. Backend enqueues ingestion task → task status polled via React Query `useQuery` with
   refetchInterval, and pushed via SSE "task:{id}" channel
6. Upload row in documents list flips status: pending → processing → ready/failed
```

### 3.9 Streaming chat flow

```
1. useChat sends POST /api/v1/chat/{id}/messages { content }  → returns stream_id
2. services/streamClient opens Server-Sent Events at /api/v1/streams/{stream_id}
   (SSE chosen over WebSocket: one-way server push, auto-reconnect, works through Nginx
   and proxies; chat is fundamentally a unidirectional event stream)
3. Event types: { kind: "token"|"tool_start"|"tool_result"|"citation"|"done"|"error", data }
4. token events append to a live buffer (Zustand) rendered progressively
5. tool_start/tool_result events feed the agent trace inspector (Part 7)
6. citation events render numbered source chips linking to document passages
7. done → final message committed via React Query invalidate, buffer cleared
```

### 3.10 API layer (`services/`)

- `apiClient.ts`: typed fetch wrapper; auth header, base URL from `NEXT_PUBLIC_API_URL`,
  error normalization, 401 refresh interceptor.
- `streamClient.ts`: SSE consumer with reconnect + heartbeat timeout.
- `endpoints.ts`: single table of endpoint paths → typed request/response (generated
  from OpenAPI via `openapi-typescript`, kept in `types/`).

---

## 4. Part 4 — Backend Architecture

### 4.1 Layered stack

```
                          ┌────────────────────────────────────────────┐
   Client (HTTP/WSS) ────▶│  API LAYER  (app/api)                     │
                          │  routers · Pydantic schemas · middlewares  │
                          └───────────────────┬────────────────────────┘
                                              │ dependency-injected
                                              ▼
                          ┌────────────────────────────────────────────┐
                          │  SERVICE LAYER (modules/*/services)       │
                          │  business rules · orchestration · AI use   │
                          └───────────────────┬────────────────────────┘
                                              │
                 ┌──────────────┬─────────────┼──────────────┬──────────────────┐
                 ▼              ▼             ▼              ▼                  ▼
   ┌──────────────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────┐
   │ REPOSITORY LAYER │ │ AI MODULES   │ │ AGENT CORE │ │  STORAGE    │ │  WORKERS     │
   │ SQLAlchemy repos │ │ vision · nlp │ │ planner·    │ │ S3/MinIO ·  │ │ Celery tasks │
   │ + DB session     │ │ rag · llm    │ │ executor    │ │ FAISS/PG    │ │ (ingest,     │
   └──────────────────┘ └──────────────┘ └────────────┘ └─────────────┘ │ infer)       │
                                                                        └──────────────┘
```

### 4.2 Why each layer exists

| Layer | Responsibility | Why it exists |
|-------|----------------|---------------|
| API | HTTP concerns only: parse, validate, serialize, status codes, authn/authz guard | Keeps transport mechanics out of business logic; enables contract-first dev with OpenAPI |
| Service | Business rules, use-case orchestration, AI module composition | Unit-testable without HTTP or DB; the "what the product does" |
| Repository | Persistence access (SQLAlchemy queries) | Isolates DB dialect/SQL from services; mockable in tests |
| AI Modules | Pure capability: "given input X return Y" (vision, nlp, rag, llm) | Every model/algorithm is a pluggable capability behind a port (SOLID-D) |
| Storage | Object/vector I/O behind ports | S3/MinIO/FAISS/Pinecone are swappable without touching services |
| Workers | Long-running Celery tasks | HTTP layer must stay fast; CPU/GPU work belongs off-thread |
| Core/Config | Settings, logging, exceptions, DI container, middleware | Single source of truth for cross-cutting concerns |

### 4.3 Request flow (typical authenticated chat message)

```
1. Nginx → POST /api/v1/chat/{id}/messages
2. Middleware chain: RequestID → CORSMiddleware → AuthMiddleware (Bearer) →
   RateLimit → body parse
3. Router validates body via Pydantic schema (Content-Type: application/json only)
4. Dependency injects: current_user, chat_repo, agent_orchestrator
5. Authorizer checks: user owns chat (authorization guard at API layer)
6. Service: loads chat context, builds conversation, calls Agent orchestration
7. Agent planner picks tools (rag/vision/nlp) → executor runs them (some enqueue Celery)
8. Repository persists user message + assistant message + agent trace
9. Response: { message_id, stream_id } → SSE stream pushes tokens
10. Exception path: any failure → core exception handlers map domain exceptions to
    RFC 7807 problem+json responses; RequestID echoed for support
```

### 4.4 Dependency injection

- **Decision:** a lightweight DI container (`app/core/container.py`) that wires
  `Settings → clients (db, redis, storage, llm factory) → repositories → services → routers`.
  No framework magic; explicit composition root in `app/main.py`.
- **Why:** tests inject fakes at the boundary they care about (fake repo for service
  tests, fake LLM for agent tests) with zero monkey-patching. Satisfies SOLID-D and
  ISP: each service depends on narrow ports, not concrete clients.

### 4.5 Exception handling

- Single registry mapping domain exceptions → HTTP status + machine-readable error code:
  `DocumentNotFound(404)`, `InvalidFileType(422)`, `QuotaExceeded(429)`,
  `ProviderTimeout(502)`, `Unauthorized(401)`.
- All responses are RFC 7807 `application/problem+json`:
  `{ "type", "title", "status", "detail", "trace_id", "errors" }`.
- The single unhandled-exception handler logs stack + trace_id and returns a generic 500
  (never leaks internals).

### 4.6 Middleware order (registration order matters)

`RequestID → Logging(access) → CORS → Auth → RateLimit → ResponseTime → GZip`.

### 4.7 Celery workers

- Worker queues: `ingestion` (RAG), `vision`, `nlp`, `agent_heavy`, `default`.
- Task signature contracts are the same "ports" as services; a service may call a
  function that *is* a Celery task via a proxy — callers cannot tell sync vs async.
- Task timeouts, retries (exponential backoff), and dead-letter queue configured centrally.

---

## 5. Part 5 — Database Design

### 5.1 ER Diagram

```
users 1 ──── * workspaces ──── * chats 1 ──── * messages
  │             │                 │                │
  │             │                 │ 1             │ 0..1
  │             *                *                │
  │        documents ────── * document_chunks    │
  │             │            (vectors, vectors_meta)
  │             │
  │             *                            ┌── sessions (agent)
  *        experiments ── * experiment_runs  ─┤
  │                                          └── agent_logs ── * tool_calls
  │
  *        uploads
  *        api_keys
```

### 5.2 Tables

| Table | Key columns | Notes |
|-------|-------------|-------|
| `users` | id, email (unique), password_hash, display_name, role, plan, is_active, created_at | bcrypt/argon2 hash; role ∈ {user, admin} |
| `workspaces` | id, user_id FK, name, default_provider, created_at | Isolation boundary for multi-tenant future |
| `sessions` | id, user_id FK, refresh_token_hash, user_agent, ip, expires_at, revoked_at | Refresh-token rotation target |
| `chats` | id, workspace_id FK, user_id FK, title, agent_config JSONB, created_at | `agent_config` = per-chat planner/llm overrides |
| `messages` | id, chat_id FK, role, content TEXT, status, kind (text/tool/citation), metadata JSONB, created_at | Metadata holds citations, tool results |
| `documents` | id, workspace_id FK, uploader_id FK, name, mime, size, storage_key, status, parser, source_type, created_at | status ∈ {pending,processing,ready,failed} |
| `document_chunks` | id, document_id FK, index, content TEXT, token_count, embedding_id, metadata JSONB | Point of citation generation |
| `embeddings` | id, document_id FK, chunk_id FK, model_name, dimensions, is_deleted | Vectors stored in FAISS/Pinecone; this row is the pointer/version |
| `uploads` | id, user_id FK, storage_key, status, uploaded_at, complete_at | Presigned-upload lifecycle |
| `experiments` | id, name, workspace_id FK, config JSONB, created_at | Eval campaign |
| `experiment_runs` | id, experiment_id FK, metrics JSONB, artifacts JSONB, status, mlflow_run_id, created_at | MLflow mirror |
| `agent_logs` | id, session_id FK, chat_id FK, kind (plan/execute/critic/synth), input JSONB, output JSONB, model, latency_ms, created_at | Decision trace |
| `tool_calls` | id, agent_log_id FK, tool, params JSONB, result JSONB, status, error, latency_ms | Full tool trace |
| `api_keys` | id, user_id FK, name, key_prefix, key_hash, scopes, expires_at, revoked_at | Server-to-server access |
| `model_registry` | id, name, version, provider, endpoint_ref, params JSONB, is_active | Switchable models per module |

### 5.3 Relationships

- One-to-many cascades: workspace→chats, chat→messages (delete cascade).
- `documents → document_chunks → embeddings`: chunk/embedding lifecycle tied to document
  delete (soft delete + async vector purge).
- `messages.metadata` is JSONB to avoid a citation join-table — citations are read-only
  render data; we accept denormalization for UI speed (validated at write time).

### 5.4 Indexes

| Table | Index | Why |
|-------|-------|-----|
| `users` | unique(email) | auth lookup |
| `messages` | (chat_id, created_at) | ordered fetch per chat |
| `messages` | (chat_id, id) where status='running' | streaming resumption |
| `documents` | (workspace_id, created_at) | document list |
| `document_chunks` | (document_id, index) | sequential rebuild |
| `embeddings` | (model_name, document_id) where is_deleted=false | versioned rebuild |
| `agent_logs` | (chat_id, created_at) | trace viewer |
| `agent_logs` | (session_id) | session trace |
| `experiment_runs` | (experiment_id, created_at) | eval dashboards |
| `sessions` | (refresh_token_hash) | token rotation |

Use partial indexes for hot filtered sets; JSONB queries are always covered by
GIN indexes only where actually needed (avoid premature indexing).

### 5.5 Why PostgreSQL + this schema shape

- Relational metadata + JSONB flexibility for AI artifacts (traces, citations, configs)
  — one database, two modeling styles, no polyglot operational cost.
- Alembic migrations guarantee the schema evolves safely with CI-checked migration tests.

---

## 6. Part 6 — RAG Architecture

### 6.1 Pipeline

```
                         INGESTION (Celery worker, queue=ingestion)
┌────────────┐  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐
│ Loader     │→ │ Preprocessor  │→ │ Chunker      │→ │ Embedding     │→ │ Vector Store    │
│ pdf/docx/  │  │ clean · table │  │ recursive    │  │ Generator     │  │ write +         │
│ txt/image/ │  │ extraction    │  │ char split   │  │ (sentence-    │  │ dedupe          │
│ video      │  └───────────────┘  │ w/ overlap   │  │ transformers) │  └─────────────────┘
└────────────┘                     └──────────────┘  └───────────────┘
                                          │                 │                  │
                                          ▼                 ▼                  ▼
                                     metadata:        embed cache           metadata → PG
                                     page#, source,   (Redis, keyed by      (document_chunks)
                                     chunk index      content hash)
                                 RETRIEVAL (in-request path, async)
┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│ Query        │→ │ Retriever      │→ │ Reranker        │→ │ Context Assembler   │
│ preprocessor │  │ (hybrid: dense │  │ (cross-encoder, │  │ dedupe · order ·    │
│ rewrite/     │  │  + sparse)     │  │ optional)       │  │ budget token guard  │
│ embed        │  └────────────────┘  └─────────────────┘  └─────────────────────┘
└──────────────┘                                                      │
                                                                      ▼
                                             ┌──────────────────────────────────────┐
                                             │ Prompt Builder (citations inline)    │
                                             │ → LLM → Answer + citation list       │
                                             └──────────────────────────────────────┘
```

### 6.2 Module decisions (with why)

| Concern | Choice | Why |
|---------|--------|-----|
| Loader | Unstructured / PyMuPDF / python-docx / OpenCV frame sampler per source type | Each source is a distinct adapter behind the `DocumentLoader` port — OCP: new file types add loaders, no core changes |
| Chunker | Recursive character splitter with overlap (tunable `chunk_size=800, overlap=160`), plus semantic boundaries at headings/paragraphs | Balances retrieval granularity vs. context bloat; overlap prevents context loss at boundaries |
| Embeddings | sentence-transformers (e.g., `all-MiniLM-L6-v2` / `bge-large`) locally; OpenAI embeddings optional via provider config | Local = private + free at inference; provider-switchable so cost/quality trade-off is a config change (P2) |
| Vector store | FAISS (local, default) → Pinecone (managed, optional via config) | FAISS: zero-ops for single-node; Pinecone: scale path. Both behind the same `VectorStore` port |
| Retrieval | Hybrid (dense + BM25 sparse) with weighted fusion | Dense catches semantic matches, sparse catches exact terms/IDs; hybrid measurably improves recall |
| Rerank | Optional cross-encoder rerank on top-K | Improves precision; disabled for latency-sensitive tiers (config) |
| Citations | `document_chunks` rows carry page/heading metadata; citation = chunk id + snippet | Citations are structured data, not free text — rendered as chips in UI, verifiable |

### 6.3 Embedding versioning

- `embeddings.model_name` + an in-memory/Redis cache keyed by content hash lets us
  re-embed only changed chunks on model upgrade. A background job migrates embeddings
  (re-embed → write → flag old as `is_deleted`).

### 6.4 Evaluation loop

- RAG eval harness (`ml/evaluation`): synthetic question sets per document, metrics:
  context precision/recall, faithfulness (LLM-as-judge), answer relevance, citation hit rate.
- Runs logged to MLflow; thresholds gate merges to production (Part 9/14).

---

## 7. Part 7 — Agent Architecture

### 7.1 Components

| Component | Responsibility |
|-----------|----------------|
| **Planner** | Parses user intent → ordered plan of tool calls (with dependencies). LLM-driven with a structured output schema (tool name, args, depends_on). |
| **Tool Registry** | `name → ToolSpec { schema, executor, visibility, cost, latency class }`. Registration is declarative (decorator); agents only see tools they are allowed (authz). |
| **Executor** | Runs the plan respecting dependencies (DAG). Runs tools in parallel when independent, sequentially when dependent. Handles retries and per-tool timeouts. |
| **Memory** | (a) Conversation memory — trimmed history from `messages`; (b) task scratchpad — working state passed between steps; (c) long-term — document/workspace context retrieved via RAG. |
| **Reasoning Engine** | Optional ReAct-style loop (Reason → Act → Observe) when planner yields a single uncertain step; used selectively to bound token cost. |
| **Critic (optional)** | Review pass over the final answer: checks citation grounding, contradicting sources, hallucination signals. Produces corrections applied before synthesis. |
| **Synthesizer** | Composes tool results + citations into the final natural-language answer; enforces output format contract (answer, citations[], follow_up[]). |
| **Decision Trace Logger** | Writes every plan/step/observation to `agent_logs` + `tool_calls` and emits SSE `tool_*` events for the UI inspector. |

### 7.2 Sequence diagram (multi-tool question)

```
 User           API            Planner        Executor       Tool Reg.       Vision/NLP/RAG        Critic        Synth.     UI
  │  ask "summarize + sentiment" │               │               │               │                   │             │         │
  │─────────────────────────────▶│               │               │               │                   │             │         │
  │                              │──────────────▶│               │               │                   │             │         │
  │                              │ plan: [rag.summarize, nlp.sentiment]        │                   │             │         │
  │                              │◀──────────────│               │               │                   │             │         │
  │                              │──────────────▶│ step1 rag.summarize          │                   │             │         │
  │                              │               │──────────────▶│─────────────▶│ summarize(document)│             │         │
  │                              │               │◀──────────────│◀─────────────│                   │             │         │
  │                              │  SSE tool_start/tool_result (trace)                              │             │         │
  │                              │──────────────▶│ step2 nlp.sentiment ────────────▶ sentiment(summary)           │         │
  │                              │               │◀──────────────│◀─────────────────────────────── │             │         │
  │                              │               │ (independent steps may run in parallel)         │             │         │
  │                              │──────────────▶│ synthesize(results)                             │             │         │
  │                              │               │────────────────────────────────────────────────│─────────────▶│ answer  │
  │                              │               │ optional: critic review ──▶ corrections        │             │         │
  │                              │  SSE done + citations                                          │             │         │
  │◀─────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
```

### 7.3 Why this agent shape

- **Planner-then-execute (plan-execute) as the default** over pure ReAct:
  token-efficient (one planning pass vs. many reasoning turns), parallelizable,
  and the plan is inspectable/loggable. ReAct is retained as a fallback tool for
  uncertain, multi-hop questions.
- **Structured plan output** (validated JSON) instead of free-form "thinking":
  enables deterministic execution, retries per-step, and honest failure messages.
- **Tool Registry as a port**: adding a tool never touches planner/executor code —
  satisfies OCP and gives per-tenant tool permissions.

### 7.4 Failure handling

- Per-step timeout and retry budget; on step failure the planner receives the error as
  context and may replan; if replan fails, answer clearly states what failed and why
  (no fabricated fallback).

---

## 8. Part 8 — Vision Module

### 8.1 Pipeline

```
                INGEST (Celery, queue=vision)                  INFERENCE (sync or worker)
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Image/Frame │→ │ Preprocess   │→ │ Detect       │→ │ Postprocess  │→ │ Visualize    │→ │ Result       │
│ Loader      │  │ OpenCV:      │  │ YOLOv8       │  │ NMS · filter │  │ bbox overlay │  │ schema +     │
│ (CV2 frame  │  │ resize ·     │  │ (model from  │  │ confidence   │  │ → PNG/SVG    │  │ artifacts    │
│ sampler for │  │ normalize ·  │  │ registry)    │  │ · class map  │  │ artifact →   │  │ → PG + S3    │
│ video)      │  │ denoise      │  └──────────────┘  └──────────────┘  │ object store │  └──────────────┘
└──────────────┘  └──────────────┘                    └──────────────┘
```

### 8.2 Components

| Component | Responsibility | Why |
|-----------|----------------|-----|
| Loader | Accepts image/video; for video samples frames at configurable FPS | Video ≠ image; frame sampling bounds inference cost |
| Preprocessor | OpenCV resize to model input, color conversion, denoise, orientation correction | Consistent input → stable inference; cheap wins |
| Detector | YOLOv8 inference via `ultralytics`; model resolved from Model Registry | Registry lets ops swap/retrain models without code change (P2, Part 5 model_registry) |
| Postprocessor | NMS, confidence threshold, class filtering, tracking across frames (optional) | Raw detections are noisy; NMS + thresholds are mandatory for usable output |
| Visualizer | Draws bounding boxes/classes → overlay artifact stored in S3 | Users want to *see* detections; artifact links returned in answers |
| Answerer | Optionally feeds detection summaries to LLM for "what objects are visible?" natural answer | Vision + LLM composition happens in the Agent, not the module |

### 8.3 Model registry

- Every model has a `model_registry` row: name, version, provider, endpoint_ref,
  params (imgsz, conf), is_active. Module code calls `resolve("yolov8n.pt")` — never
  hardcodes paths. Fine-tuning outputs (Part 9) register new versions here.
- Active model swap is a config change, live-reloadable.

---

## 9. Part 9 — NLP Module

### 9.1 Capabilities

| Capability | Default model family | Port |
|------------|----------------------|------|
| Classification | zero-shot classifier / fine-tuned small model | `Classifier` |
| Sentiment | fine-tuned sentiment model / LLM fallback | `SentimentAnalyzer` |
| Translation | NLLB / M2M100 (or provider API) | `Translator` |
| Summarization | PEGASUS/BART (extractive→abstractive chain) | `Summarizer` |

All four are behind ports; the Agent calls the port, never a concrete model.

### 9.2 Training → Inference → Evaluation loop

```
data/ (datasets) ──▶ ml/training (fine-tune script) ──▶ MLflow run (metrics, model artifact)
                                                          │
                                                          ▼
                                            Model Registry (new version, is_active)
                                                          │
                                          service side: resolve(active_version) ──▶ inference
                                                          │
                                                          ▼
                                           ml/evaluation (held-out set, per-capability metrics)
                                                          │ threshold gate
                                                          ▼
                                          promote version to is_active in production
```

- **Decision:** offline fine-tuning lives in `ml/`, inference loads only registry-approved
  artifacts. Training on GPU hosts, inference on CPU/GPU worker per capacity.
- **Why small local models + LLM fallback:** latency and cost for classification/sentiment
  at scale; LLM fallback only when the local model under-performs (evaluated, config-driven).

---

## 10. Part 10 — LLM Abstraction

### 10.1 Provider-independent design

```
                         ┌──────────────────────────────┐
                         │         LLM Gateway          │  (app/modules/llm)
                         │  factory · routing · fallback│
                         │  streaming · token accounting│
                         └──────┬───────────────────────┘
                                │ builds
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌───────────┐    ┌───────────┐     ┌───────────┐
        │ BaseLLM   │◄───┤ Provider  │     │ Ollama    │
        │ (port)    │    │ OpenAILike│     │ (local)   │
        └───────────┘    └───────────┘     └───────────┘
         interface:
         • complete(messages, params) → TextResponse(usage, trace_id)
         • stream(messages, params) → AsyncIterator[Delta]
         • embed(texts) → EmbeddingResponse
```

### 10.2 Provider set

| Provider | Adapter | Notes |
|----------|---------|-------|
| OpenAI | `OpenAIProvider` | GPT-family, embeddings, direct SDK |
| Gemini | `GeminiProvider` | google-genai SDK, vertex-compatible later |
| Groq | `GroqProvider` | Llama-3 family, very low latency (real-time chat tier) |
| DeepSeek | `DeepSeekProvider` | OpenAILike base class (compatible API) |
| Ollama | `OllamaProvider` | Local/self-hosted, offline/private tier |

**Why a common `OpenAILike` base:** DeepSeek/Groq (and many others) expose OpenAI-compatible
chat endpoints; reusing the transport keeps adapters tiny and new providers ~30 lines.

### 10.3 Factory + configuration

```
LLMProvider = Factory(settings.llm)          # e.g. active=groq, fallback=[deepseek, ollama]
   ├── maps provider key → adapter class     # no if/elif chains in callers (OCP)
   └── raises ConfigurationError on unknown key (fail closed, P7)
```

- Every provider is configured via the settings service (env-driven), including
  `api_key` (loaded from secrets, never logged — Part 11), `base_url`, `model`,
  `max_tokens`, `temperature`, `timeout`.
- Per-chat overrides (`chats.agent_config.llm`) are merged over global config — a chat can
  opt into a more expensive model while default stays cheap.

### 10.4 Streaming support

- All providers expose the same `stream()` contract returning `AsyncIterator[Delta]`
  where `Delta = { content | tool_call, usage? }`. The Gateway normalizes provider-native
  stream formats (SSE vs websocket vs SDK callback) so callers see one shape.
- The gateway emits token accounting events to the logging pipeline (Part 12) for cost
  telemetry.

### 10.5 Routing & fallback

- Configurable strategy: `primary → fallback chain` per call class (chat vs. batch).
- Automatic failover on timeout/429/5xx with exponential backoff; circuit-breaker per
  provider so a degraded provider is skipped early.

---

## 11. Part 11 — Security

| Concern | Design | Why |
|---------|--------|-----|
| Authentication | OAuth2 Password flow at `/api/v1/auth/login`; short-lived JWT access token (15 min) + rotating refresh token (30 days, hashed in DB, revocation list) | Rotation + hash limits stolen-refresh replay |
| Authorization | RBAC: `user` / `admin`. Object-level ownership checks (chat/doc belongs to user) at API layer; agent tool permissions per workspace | API guard prevents IDOR; tool authz prevents privilege escalation via agent |
| Rate limiting | Redis fixed-window + token bucket at Nginx (per-IP) and per-user in FastAPI (per-endpoint buckets) | Protects providers & DB from abuse and runaway agents |
| File validation | Server-side allow-list by extension AND magic-bytes sniff (PDF/docx/txt/png/jpg/mp4…); 100 MB cap; virus-scan hook optional (ClamAV) | Extension spoofing is the #1 upload vector; bytes never lie |
| Input validation | Pydantic v2 strict schemas at every boundary; max prompt length, token budget guard on context assembly | Untrusted input must never reach model/DB raw |
| API keys | Server-to-server keys hashed in `api_keys`; scopes + expiry + audit | Lets integrations authenticate without user passwords |
| Secrets management | `.env` for local; AWS Secrets Manager for prod; `Settings` reads at boot, logs redact all secret keys (`***`); never written to MLflow/artifacts | Secrets in artifacts/logs is a common silent leak |
| CORS | Allow-list exactly the frontend origin(s); credentials + specific headers/methods only; preflight caching | Locked-down CORS prevents cross-origin token abuse |
| TLS | Terminated at Nginx (Let's Encrypt); HSTS; secure/httpOnly cookies for refresh token | Transport + cookie hardening |
| Prompt/tool safety | Agent tool args validated against tool schema; untrusted file content is data, never code (no exec of extracted content); output sanitized for XSS before render | Defense-in-depth against prompt-injection and injection into UI |

---

## 12. Part 12 — Logging

### 12.1 Central logging model

- **Structured JSON logs** (single line, keys: `ts`, `level`, `service`, `trace_id`,
  `user_id`, `chat_id`, `event`, `data`). No free-text logs.
- Every request gets a `trace_id` (middleware, Part 4) propagated to Celery tasks and
  LLM calls so one user action is one searchable trace.

| Stream | Content | Where |
|--------|---------|-------|
| Access logs | request method/path/status/latency/user | stdout (container) → Loki/CloudWatch |
| App logs | business events, service decisions | stdout structured |
| Agent logs | plans, steps, observations (also DB `agent_logs`) | DB + structured stream |
| Audit logs | auth events, key creation, destructive ops | append-only DB table, admin-only |
| MLflow logs | metrics/params/artifacts per run/experiment | MLflow server |
| Error logs | exceptions w/ stack + trace_id | structured stream → alerting |
| LLM telemetry | per-call provider/model/tokens/latency/cost | structured stream + aggregations |

### 12.2 Why this layering

- DB `agent_logs` are *queryable product data* (trace inspector UI); stream logs are
  *ops data*. Keeping them separate means the trace viewer never depends on log shipping,
  and ops never depend on app schema.

### 12.3 Tooling

- Python `structlog` + `logging` bridge; `uvicorn` access middleware replaced with the
  structured one. Alerting on error-rate spike and agent-step failure rate via Prometheus
  `/metrics` (FastAPI + Celery exporters).

---

## 13. Part 13 — Deployment Architecture

### 13.1 Docker topology

```
docker-compose.yml (root)
├── nginx            :80/:443 → fastapi + frontend + mlflow-ui
├── frontend         :3000 (Next.js standalone build)
├── backend          :8000 (FastAPI, uvicorn workers)
├── worker-ingestion : celery -Q ingestion
├── worker-vision    : celery -Q vision
├── worker-nlp       : celery -Q nlp
├── worker-default   : celery -Q agent_heavy,default
├── beat             : celery beat (scheduled cleanups, eval runs)
├── postgres         :5432 (named volume)
├── redis            :6379 (named volume)
└── mlflow           :5000 (sqlite/postgres-backed tracking + artifact store)
    minio (optional) :9000 S3-compatible object store for local dev
```

- Multi-stage Dockerfiles: builder (deps) → runtime (slim, non-root user).
- Healthchecks on every service; `depends_on` with `condition: service_healthy`.

### 13.2 CI/CD (GitHub Actions)

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `ci-backend` | PR | ruff + mypy + pytest (unit, integration w/ testcontainers Postgres+Redis+MinIO) |
| `ci-frontend` | PR | eslint + tsc + vitest + build (next build) |
| `ci-ml` | PR touching `ml/` | lint + eval smoke on tiny dataset |
| `cd-deploy` | push to `main` | build images → push to ECR → compose pull/up on EC2 (rolling) → smoke health checks |

- Contract check: backend publishes OpenAPI; a workflow verifies `frontend/src/types`
  generated types match the published schema (catches breaking contract drift).
- Migration safety: `alembic upgrade head` runs in the deploy job before service restart.

### 13.3 AWS (Terraform)

- Single EC2 (t3.2xlarge → GPU instance when vision/NLP scale) behind ALB; ECR for images;
- RDS PostgreSQL (Multi-AZ in prod); ElastiCache Redis; S3 for uploads/artifacts;
- Secrets Manager for provider keys; VPC with private subnets for DB/cache; public only ALB+Nginx.

### 13.4 Nginx

- TLS termination, HTTP→HTTPS redirect, HSTS; `/api/*` → backend; `/` → frontend;
- SSE passthrough (`proxy_buffering off` for `/api/v1/streams/*`);
- Per-IP rate limiting zone + upload size cap.

### 13.5 Monitoring, health, scaling

- `/healthz` (liveness, no deps) and `/readyz` (checks DB/Redis/worker heartbeat) on backend.
- Prometheus metrics (request rate/latency/errors, queue depths, token cost) + Grafana dashboards.
- Scaling: stateless FastAPI scales horizontally behind ALB; workers scale by queue depth
  (ECS autoscaling later). Beat runs once. Redis/Postgres are the fixed points — RDS and
  ElastiCache scale vertically first, replicas later.
- Backups: nightly Postgres `pg_dump` to S3 (WAL-archiving for RDS), S3 versioning for
  artifacts, restore drill documented in `docs/runbooks/`.

---

## 14. Part 14 — Development Roadmap

Phases are ordered so each phase is deployable and testable. Each phase lists goals,
folders created, implementation order, dependencies, and complexity (S/M/L as a
rough engineer-days estimate at 20-engineer team scale).

### Phase 1 — Foundation
- **Goals:** monorepo skeleton, tooling, CI skeleton, settings/logging skeleton, local dev env.
- **Folders:** root `docker-compose.yml`, `Makefile`, `backend/`, `deployment/`, `docs/`,
  `scripts/`, `.github/workflows`.
- **Order:** (1) repo scaffolding + Makefile → (2) backend FastAPI + healthz/readyz →
  (3) settings/logging → (4) docker compose + nginx → (5) CI lint/typecheck/test stubs.
- **Dependencies:** none (everything below builds on this).
- **Complexity:** M.

### Phase 2 — Backend
- **Goals:** users/workspaces/sessions, auth (JWT+refresh), RBAC, documents/uploads metadata,
  Celery skeleton, PostgreSQL + Alembic.
- **Folders:** `backend/app/modules/{auth,documents,workspaces}`, `backend/alembic`,
  `backend/app/workers`, `backend/tests`.
- **Order:** models+migrations → auth → uploads lifecycle (presign/complete) →
  Celery wiring → tests.
- **Dependencies:** Phase 1.
- **Complexity:** L.

### Phase 3 — Frontend
- **Goals:** Next.js app, auth screens, app shell, documents UI, chat UI (non-AI, mocked
  streaming), Query+Zustand wiring.
- **Folders:** `frontend/src/{app,features,components,services,hooks,stores,types,utils,lib}`.
- **Order:** scaffold+CI → auth feature → shell → documents → chat (mock stream) →
  services/types from OpenAPI.
- **Dependencies:** Phase 1; Phase 2 auth contract.
- **Complexity:** L.

### Phase 4 — Vision
- **Goals:** vision pipeline end-to-end (loader→preprocess→detect→postprocess→visualize),
  model registry, worker queue, artifact storage.
- **Folders:** `backend/app/modules/vision`, `ml/registry`, `ml/evaluation` (vision subset),
  `ml/datasets` (vision).
- **Order:** registry+resolve → loader/preprocess → detection → postprocess → visualize →
  eval harness.
- **Dependencies:** Phase 2 (worker + storage).
- **Complexity:** M.

### Phase 5 — NLP
- **Goals:** classification/sentiment/translation/summarization ports + baseline models +
  MLflow tracking.
- **Folders:** `backend/app/modules/nlp`, `ml/training`, `ml/evaluation` (nlp subset).
- **Order:** ports+interfaces → sentiment (baseline) → summarization → translation →
  classification → MLflow wiring → eval gates.
- **Dependencies:** Phase 2; registry pattern from Phase 4.
- **Complexity:** M.

### Phase 6 — RAG
- **Goals:** ingestion pipeline, hybrid retrieval, citations, embeddings versioning,
  RAG eval harness.
- **Folders:** `backend/app/modules/rag`, `ml/evaluation` (rag subset).
- **Order:** loader/chunker → embeddings+vector store → ingestion task → retrieval+rerank →
  prompt builder+citations → eval harness.
- **Dependencies:** Phase 2 (worker, storage, vectors).
- **Complexity:** L.

### Phase 7 — Agent
- **Goals:** planner, tool registry, executor (DAG), memory, critic, synthesizer,
  decision-trace logger + SSE events; LLM gateway.
- **Folders:** `backend/app/modules/agent`, `backend/app/modules/llm`.
- **Order:** LLM gateway (ports/providers/factory) → tool registry → planner → executor →
  memory → critic → synthesizer → trace logger + UI inspector events.
- **Dependencies:** Phases 4–6 (tools to call), Phase 2 (authz on tools).
- **Complexity:** L.

### Phase 8 — Testing & Evaluation
- **Goals:** raise coverage on critical paths; integration tests with testcontainers;
  RAG/NLP/agent offline eval; LLM-as-judge suite; load test chat streaming.
- **Order:** backend unit/integration → agent eval harness → RAG eval → load test →
  frontend e2e (Playwright).
- **Dependencies:** Phases 2–7.
- **Complexity:** L.

### Phase 9 — Deployment
- **Goals:** hardening, Terraform AWS, ECR + deploy workflow, monitoring/alerting, backups,
  runbooks.
- **Folders:** `deployment/terraform`, `deployment/k8s` (future), `docs/runbooks`.
- **Order:** docker hardening + healthchecks → Nginx/TLS → EC2+RDS+S3+Redis →
  CD pipeline → Prometheus/Grafana → backups + restore drill.
- **Dependencies:** Phase 1–8.
- **Complexity:** M.

### Cross-cutting rule for all phases

Nothing merges to `main` without: lint + typecheck + tests green (CI), OpenAPI contract
check, and for AI features an eval gate (regression in offline metrics blocks merge).

---

## 15. Appendix — Consolidated Decision Log

| # | Decision | Alternative rejected | Rationale |
|---|----------|----------------------|-----------|
| D1 | Modular monolith backend | Microservices now | Scale/state coupling not justified yet; extraction seams retained |
| D2 | Feature-based frontend | Type-based folders | Ownership + refactor safety |
| D3 | TanStack Query + Zustand | Redux | Server-state vs ephemeral-state split; less boilerplate |
| D4 | SSE for streaming | WebSocket | One-way push, proxy-friendly, auto-reconnect |
| D5 | Plan-execute agent (default) | Pure ReAct | Token cost, parallelism, inspectability; ReAct kept as fallback tool |
| D6 | Presigned S3 uploads | Proxy through API | Avoids memory/bandwidth bottleneck in FastAPI |
| D7 | FAISS default, Pinecone optional | Only managed vector DB | Zero-ops default, managed scale path behind one port |
| D8 | Postgres + JSONB | Dedicated graph/noSQL | One operational DB, flexible AI artifact modeling |
| D9 | Local small models + LLM fallback | LLM-only for all NLP | Cost/latency for high-volume classification/sentiment |
| D10 | Structured JSON logs + DB traces | ELK-only | Ops data and product data have different consumers |
| D11 | Provider-agnostic LLM gateway | Hardcoded SDK calls | Switchable config, fallback, uniform streaming, cost telemetry |
| D12 | Offline training in `ml/`, inference via registry | Train/infer in backend | Backend stays thin; registry is the versioned contract |

---

*This document is the source of truth for the Insight architecture. Changes require an
ADR appended to `docs/` and a version bump.*
