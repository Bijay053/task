"""
Performance reports for management — per-staff statistics.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/reports", tags=["reports"])


def require_manager(current_user: models.User = Depends(get_current_user)):
    from fastapi import HTTPException
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Manager role required")
    return current_user


@router.get("/performance", response_model=List[schemas.StaffPerformance])
def performance_report(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    users = db.query(models.User).filter(models.User.is_active == True).all()
    result = []
    for user in users:
        q = db.query(models.Application).filter(
            models.Application.assigned_to_id == user.id
        )
        if department:
            q = q.filter(models.Application.department == department)

        apps = q.all()

        gs_count = sum(1 for a in apps if a.department == "gs")
        offer_count = sum(1 for a in apps if a.department == "offer")

        # Status breakdown
        breakdown: dict = {}
        for app in apps:
            breakdown[app.application_status] = breakdown.get(app.application_status, 0) + 1

        result.append(schemas.StaffPerformance(
            user_id=user.id,
            full_name=user.full_name,
            role=user.role,
            total_assigned=len(apps),
            gs_count=gs_count,
            offer_count=offer_count,
            status_breakdown=breakdown,
        ))

    return sorted(result, key=lambda x: x.total_assigned, reverse=True)
