"""Agent FastAPI dependencies: access to the agent service from the container."""

from __future__ import annotations

from fastapi import Request

from app.core.exceptions import ConfigurationError
from app.modules.agent.orchestrator import AgentService


def get_agent_service(request: Request) -> AgentService:
    service: AgentService | None = request.app.state.container.agent_service
    if service is None:
        raise ConfigurationError(
            "The agent module is not configured; set DATABASE_URL to enable it"
        )
    return service
