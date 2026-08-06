# Insight

**Multimodal Agentic AI Research Assistant** — a full-stack platform that ingests documents (PDF/DOCX/TXT/images/video), indexes them into a hybrid retrieval RAG store, and answers research questions through a plan-and-execute agent backed by a provider-agnostic LLM gateway.

- **Architecture:** `docs/ARCHITECTURE.md` (source of truth — Draft v1.0)
- **Stack:** FastAPI · SQLAlchemy · Alembic · PostgreSQL · Redis · Celery (planned) · Next.js (planned) · FAISS · sentence-transformers · Gemini

---

## Development status

> **Overall completion: ~30%.** Backend foundation, auth, uploads, RAG and agent are implemented and tested. Frontend, vision, NLP and deployment are not started. Progress is tracked below and updated in parallel with the code — keep this section in sync with every change.

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Monorepo, FastAPI skeleton, settings/logging, infra compose | ✅ **Complete** |
| 2 — Backend | Auth/RBAC, uploads, DB+migrations, Celery | 🟡 **In progress (~75%)** |
| 3 — Frontend | Next.js app, auth/shell/documents/chat UI | ❌ Scaffold only (0%) |
| 4 — Vision | Loader → preprocess → detect → postprocess → visualize | ❌ Not started |
| 5 — NLP | Classification/sentiment/translation/summarization | ❌ Not started |
| 6 — RAG | Ingestion, hybrid retrieval, citations | 🟡 Implemented ahead of order (~85%) |
| 7 — Agent | Planner, executor, tool registry, LLM gateway | 🟡 Implemented ahead of order (~70%) |
| 8 — Testing & Eval | Unit/integration, eval harness, load tests, e2e | 🟡 Unit tests only |
| 9 — Deployment | Docker hardening, Terraform/AWS, CI/CD, monitoring | ❌ Placeholders only |

> **Note:** RAG and Agent (Phases 6–7) were built before the frontend and before the Celery worker layer, so they run synchronously inside HTTP requests today. See `docs/ARCHITECTURE.md` Part 14 for the roadmap ordering.

### Backend (Phase 2) — detail

| Area | State |
|---|---|
| Auth (register/login, JWT + rotating refresh, Argon2id, RBAC user/admin) | ✅ Complete |
| Uploads (presign → PUT → complete, magic-byte + size validation) | ✅ Complete |
| Database (SQLAlchemy, Alembic `0001`–`0004`, repository pattern) | ✅ Complete |
| Logging (structlog, `trace_id` contextvars), middleware, RFC 7807 errors | ✅ Complete |
| LLM gateway (Gemini only; no streaming/fallback/cost telemetry) | 🟡 Partial |
| RAG (loaders, chunking, FAISS, hybrid retrieval, citations) | 🟡 Sync ingestion — Celery pending |
| Agent (planner, DAG executor, tool registry, decision trace) | 🟡 No critic/synthesizer/streaming |
| Workers (Celery), chat, workspaces, configuration modules | ❌ Empty stubs |
| Vision / NLP modules | ❌ Empty stubs |

### Frontend (Phase 3) — detail

The `frontend/src/` tree (app routes, features, components, stores, services) is scaffolded as empty directories only. Nothing is implemented yet.

### Tests

`108` backend tests pass (`backend/tests/`) covering health, database/repository, auth, uploads, RAG, agent and Alembic migrations. Lint is clean (`ruff`).

---

## Repository structure

```
insight-ai-project/
├── backend/            # FastAPI modular monolith (API → service → repository)
│   ├── app/
│   │   ├── api/routers/     # HTTP layer (health, auth, uploads, rag, agent)
│   │   ├── core/            # config, container (DI), exceptions, logging, middleware
│   │   ├── shared/          # base model, database, repository, object storage
│   │   └── modules/         # auth, uploads, rag, agent, llm, vision*, nlp*, chat*, ...
│   ├── alembic/        # migrations 0001–0004
│   └── tests/          # 108 tests
├── frontend/           # Next.js (planned) — scaffolded, not implemented
├── ml/                 # offline training/eval (planned) — empty
├── deployment/         # Docker/compose/nginx/Terraform — placeholders
├── docs/               # ARCHITECTURE.md (source of truth), ADRs (pending)
├── scripts/            # bootstrap/migrate/seed/backup/healthcheck — placeholders
├── datasets/           # empty
├── experiments/        # empty
├── docker-compose.yml  # PostgreSQL 16 + Redis 7 (MinIO/MLflow commented out)
└── Makefile            # up/down/logs/build implemented; migrate/seed placeholders
```

*`*` — empty module stubs planned for Phases 4/5.*

---

## Getting started

### 1. Infrastructure (PostgreSQL, Redis)

```sh
make up          # docker compose up -d
make down
docker compose config   # validate compose file
```

### 2. Backend

```sh
cd backend
python -m venv .venv && source .venv/bin/activate   # or use the repo venv
pip install -e ".[dev]"

cp .env.example ../.env    # review and fill in secrets (see Configuration)
python -m alembic upgrade head
python -m uvicorn app.main:app --reload             # http://localhost:8000/docs
```

Checks:

```sh
python -m ruff check app tests
python -m pytest
```

### 3. Frontend

Not started (Phase 3). `cd frontend && npm run dev` once the app is scaffolded.

---

## Configuration

All environment values flow through the settings service (`backend/app/core/config.py`) via `.env` — no module reads the environment directly. Start from `.env.example`. Never commit real secrets (`.env*` is gitignored).

Key values: `DATABASE_URL`, `JWT_SECRET_KEY` (≥32 bytes in production), `GEMINI_API_KEY`, `STORAGE_BACKEND` (`local` | `s3`), `UPLOAD_MAX_SIZE_BYTES` (default 100 MB), `EMBEDDING_PROVIDER`, `VECTOR_STORE_BACKEND` (`faiss` | `memory`).

---

## API surface

All routes under `/api/v1`:

- **System:** `GET /healthz`, `GET /readyz`
- **Auth:** `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `GET /auth/me`
- **Uploads:** `POST /uploads/presign`, `POST /uploads/{id}/complete`, `GET /uploads`, `GET /uploads/{id}`, `DELETE /uploads/{id}`
- **RAG:** `POST /rag/documents`, `GET /rag/documents`, `GET /rag/documents/{id}`, `DELETE /rag/documents/{id}`, `POST /rag/retrieve`
- **Agent:** `POST /agent/run`

Interactive docs: `http://localhost:8000/docs` (dev only).

---

## Project tracking

This README is the living record of development progress. Rules for keeping it current:

- Update **`Development status`** whenever a phase/area changes state (new implementation, missing item shipped, test count changed).
- Run `python -m pytest` and `python -m ruff check app tests` in `backend/` before marking anything "complete".
- Structural or architectural changes require an ADR in `docs/adr/` and a version bump of `docs/ARCHITECTURE.md` (see its footer).
- See `docs/ARCHITECTURE.md` Part 14 for the full roadmap and the decision log (Part 15).
