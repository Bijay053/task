from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

BASE_ROLES = {"admin", "manager", "team_leader", "agent"}

APPROVED_STATUSES = {"GS approved", "CoE Approved", "Visa Granted"}
REFUSED_STATUSES = {"GS Rejected", "Visa Refused", "Refund Requested"}
PENDING_STATUSES = {
    "GS document pending", "GS onhold", "GS submitted",
    "GS additional document request", "In Review",
    "CoE Requested", "Visa Lodged",
}


def _scoped_query(db: Session, current_user: models.User):
    """Return a base Application query scoped to the current user's visibility."""
    q = db.query(models.Application)
    role = current_user.role

    if role == "admin":
        # Admin sees everything — no filter
        pass
    elif role == "manager":
        # If manager has specific agent mappings, limit to those agents
        mappings = (
            db.query(models.ManagerAgentMapping)
            .filter(models.ManagerAgentMapping.manager_id == current_user.id)
            .all()
        )
        if mappings:
            agent_ids = [m.agent_id for m in mappings]
            q = q.filter(models.Application.agent_id.in_(agent_ids))
    elif role in ("agent", "team_leader"):
        # Only see their own assigned applications
        q = q.filter(models.Application.assigned_to_id == current_user.id)
    else:
        # Custom role — check if they have can_view_all_users in any department.
        # If yes, they see all applications (like a manager without agent restrictions).
        # If no, they only see applications assigned to them.
        has_full_view = (
            db.query(models.RolePermission)
            .filter(
                models.RolePermission.role == role,
                models.RolePermission.can_view_all_users == True,
            )
            .first()
        )
        if not has_full_view:
            q = q.filter(models.Application.assigned_to_id == current_user.id)

    return q


@router.get("/summary", response_model=schemas.DashboardSummary)
def summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    base = _scoped_query(db, current_user)
    total = base.with_entities(func.count(models.Application.id)).scalar()
    pending = base.filter(
        models.Application.application_status.in_(PENDING_STATUSES)
    ).with_entities(func.count(models.Application.id)).scalar()
    approved = base.filter(
        models.Application.application_status.in_(APPROVED_STATUSES)
    ).with_entities(func.count(models.Application.id)).scalar()
    refused = base.filter(
        models.Application.application_status.in_(REFUSED_STATUSES)
    ).with_entities(func.count(models.Application.id)).scalar()
    return {"total": total, "pending": pending, "approved": approved, "refused": refused}


@router.get("/status-count", response_model=List[schemas.StatusCount])
def status_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    base = _scoped_query(db, current_user)
    rows = (
        base.with_entities(models.Application.application_status, func.count(models.Application.id))
        .group_by(models.Application.application_status)
        .all()
    )
    return [
        {
            "status": row[0],
            "count": row[1],
            "color": models.STATUS_COLORS.get(row[0], "#eee"),
        }
        for row in rows
    ]


@router.get("/assignee-count", response_model=List[schemas.AssigneeCount])
def assignee_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # For non-admins, only show their own workload — show their own name + count
    if current_user.role in ("agent", "team_leader"):
        base = _scoped_query(db, current_user)
        count = base.with_entities(func.count(models.Application.id)).scalar()
        return [{"assignee_name": current_user.full_name, "count": count}]

    base = _scoped_query(db, current_user)
    rows = (
        base.join(models.User, models.Application.assigned_to_id == models.User.id)
        .with_entities(models.User.full_name, func.count(models.Application.id))
        .group_by(models.User.full_name)
        .order_by(func.count(models.Application.id).desc())
        .all()
    )
    return [{"assignee_name": row[0], "count": row[1]} for row in rows]


@router.get("/university-count", response_model=List[schemas.UniversityCount])
def university_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    base = _scoped_query(db, current_user)
    rows = (
        base.join(models.University, models.Application.university_id == models.University.id)
        .with_entities(models.University.name, func.count(models.Application.id))
        .group_by(models.University.name)
        .order_by(func.count(models.Application.id).desc())
        .limit(10)
        .all()
    )
    return [{"university_name": row[0], "count": row[1]} for row in rows]
