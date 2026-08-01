"""Agent HTTP endpoints (Part 7 — orchestration over user queries).

Mounted at ``settings.api_v1_prefix`` + ``/agent``. ``POST /agent/run`` plans
over the query, executes the tool plan user-scoped, and returns the composed
final answer plus the full decision trace (P6) so the inspector UI can show
exactly why the agent did what it did.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.agent.dependencies import get_agent_service
from app.modules.agent.orchestrator import AgentService
from app.modules.agent.schemas import AgentRunRequest, AgentRunResponse, AgentStepOut
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post(
    "/run",
    response_model=AgentRunResponse,
    summary="Plan and execute the agent over a user query",
)
def run_agent(
    payload: AgentRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[AgentService, Depends(get_agent_service)],
) -> AgentRunResponse:
    result = service.run(
        user_id=current_user.id,
        role=current_user.role,
        query=payload.query,
    )
    return AgentRunResponse(
        query=result.query,
        rationale=result.plan.rationale,
        source=result.plan.source,
        steps=[
            AgentStepOut(
                step_id=step.step_id,
                tool=step.tool,
                status=result.results[step.step_id].status,
                args=step.args,
                output=result.results[step.step_id].output,
                error=result.results[step.step_id].error,
            )
            for step in result.plan.steps
            if step.step_id in result.results
        ],
        final_answer=result.final_answer,
        citations=result.citations,
        trace=result.trace,
    )
