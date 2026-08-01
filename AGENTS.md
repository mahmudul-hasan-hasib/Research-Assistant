# AGENTS.md — Insight

Repository: Insight — a multimodal Agentic AI Research Assistant.

## Ground rules

- `docs/ARCHITECTURE.md` is the source of truth. Structural changes require an ADR
  (docs/adr/) and a version bump.
- Foundation phase: structure and placeholders only. No business logic, no AI/RAG/Vision/
  NLP/Agent implementations yet (see roadmap, `docs/ARCHITECTURE.md` Part 14).
- Keep module boundaries (`backend/app/modules/*`), layering (API → service → repository),
  and feature-based frontend structure (`frontend/src/features/*`).
- No hardcoded environment values — all configuration goes through the settings service.
- Do not commit secrets; `*.env*` is gitignored (see `.env.example`).

## Commands

Backend (Phase 1 landed) — run from `backend/` with the repo venv (`chatenv`):

- `python -m ruff check app tests` — lint.
- `python -m pytest` — tests (FastAPI TestClient).
- `python -m uvicorn app.main:app --reload` — dev server.

Frontend lint / typecheck commands land in Phase 3. Infra:

- `make up` / `make down` — bring up infra (PostgreSQL, Redis).
- `docker compose config` — validate compose file.
- `make migrate` / `make healthcheck` — placeholders, implemented in Phase 2.
