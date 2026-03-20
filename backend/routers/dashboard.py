from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

APPROVED_STATUSES = {"GS approved", "CoE Approved", "Visa Granted"}
REFUSED_STATUSES = {"GS Rejected", "Visa Refused", "Refund Requested"}
PENDING_STATUSES = {
    "GS document pending", "GS onhold", "GS submitted",
    "GS additional document request", "In Review",
    "CoE Requested", "Visa Lodged",
}


@router.get("/summary", response_model=schemas.DashboardSummary)
def summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    total = db.query(func.count(models.Application.id)).scalar()
    pending = db.query(func.count(models.Application.id)).filter(
        models.Application.application_status.in_(PENDING_STATUSES)
    ).scalar()
    approved = db.query(func.count(models.Application.id)).filter(
        models.Application.application_status.in_(APPROVED_STATUSES)
    ).scalar()
    refused = db.query(func.count(models.Application.id)).filter(
        models.Application.application_status.in_(REFUSED_STATUSES)
    ).scalar()
    return {"total": total, "pending": pending, "approved": approved, "refused": refused}


@router.get("/status-count", response_model=List[schemas.StatusCount])
def status_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.Application.application_status, func.count(models.Application.id))
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
    rows = (
        db.query(models.User.full_name, func.count(models.Application.id))
        .join(models.Application, models.Application.assigned_to_id == models.User.id)
        .group_by(models.User.full_name)
        .order_by(func.count(models.Application.id).desc())
        .all()
    )
    return [{"assignee_name": row[0], "count": row[1]} for row in rows]


@router.get("/university-count", response_model=List[schemas.UniversityCount])
def university_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.University.name, func.count(models.Application.id))
        .join(models.Application, models.Application.university_id == models.University.id)
        .group_by(models.University.name)
        .order_by(func.count(models.Application.id).desc())
        .limit(10)
        .all()
    )
    return [{"university_name": row[0], "count": row[1]} for row in rows]
