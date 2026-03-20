"""
External agents (sub-agents / agencies / partners) — NOT internal staff.
These are the external entities students belong to.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/", response_model=List[schemas.AgentOut])
def list_agents(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = db.query(models.Agent)
    if search:
        q = q.filter(models.Agent.name.ilike(f"%{search}%"))
    return q.order_by(models.Agent.name).all()


@router.post("/", response_model=schemas.AgentOut)
def create_agent(
    data: schemas.AgentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager required")
    agent = models.Agent(**data.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.put("/{agent_id}", response_model=schemas.AgentOut)
def update_agent(
    agent_id: int,
    data: schemas.AgentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager required")
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(agent, k, v)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()
    return {"message": "Agent deleted"}


# ─── Manager-Agent Mappings ────────────────────────────────────────────────────

@router.get("/manager/{manager_id}/agents", response_model=List[schemas.AgentOut])
def get_manager_agents(
    manager_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get all agents assigned to a manager."""
    if current_user.role not in ("admin", "manager") and current_user.id != manager_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    mappings = db.query(models.ManagerAgentMapping).filter(
        models.ManagerAgentMapping.manager_id == manager_id
    ).all()
    return [m.agent for m in mappings]


@router.post("/manager/{manager_id}/agents/{agent_id}")
def assign_agent_to_manager(
    manager_id: int,
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Assign an agent to a manager's responsibility."""
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager required")
    existing = db.query(models.ManagerAgentMapping).filter_by(
        manager_id=manager_id, agent_id=agent_id
    ).first()
    if existing:
        return {"message": "Already assigned"}
    mapping = models.ManagerAgentMapping(manager_id=manager_id, agent_id=agent_id)
    db.add(mapping)
    db.commit()
    return {"message": "Agent assigned to manager"}


@router.delete("/manager/{manager_id}/agents/{agent_id}")
def unassign_agent_from_manager(
    manager_id: int,
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager required")
    mapping = db.query(models.ManagerAgentMapping).filter_by(
        manager_id=manager_id, agent_id=agent_id
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(mapping)
    db.commit()
    return {"message": "Agent unassigned from manager"}


@router.get("/all-managers-with-agents")
def list_managers_with_agents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns all manager-agent mappings (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    managers = db.query(models.User).filter(
        models.User.role.in_(["admin", "manager"])
    ).all()
    result = []
    for m in managers:
        mappings = db.query(models.ManagerAgentMapping).filter_by(manager_id=m.id).all()
        result.append({
            "manager_id": m.id,
            "manager_name": m.full_name,
            "agents": [{"id": mp.agent.id, "name": mp.agent.name} for mp in mappings],
        })
    return result
