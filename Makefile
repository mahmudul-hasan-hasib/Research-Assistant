# Insight — developer entrypoints (see docs/ARCHITECTURE.md Part 2).
# Windows/macOS without `make`: run the equivalent `docker compose` / scripts/ commands.

.PHONY: up down logs build migrate seed backup healthcheck

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

migrate:
	@echo "Not implemented — Phase 2 (Alembic)."

seed:
	@echo "Not implemented — Phase 2."

backup:
	@echo "Not implemented — Phase 9 (see docs/runbooks/)."

healthcheck:
	@echo "Not implemented — Phase 1."
