"""
Dynamic status management: admin can add, edit, reorder, and deactivate statuses.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/statuses", tags=["statuses"])


def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager role required")
    return current_user


@router.get("/", response_model=List[schemas.AppStatusOut])
def list_statuses(
    department: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = db.query(models.AppStatus)
    if department:
        q = q.filter(models.AppStatus.department == department)
    if not include_inactive:
        q = q.filter(models.AppStatus.is_active == True)
    return q.order_by(models.AppStatus.sort_order.asc(), models.AppStatus.id.asc()).all()


@router.post("/", response_model=schemas.AppStatusOut)
def create_status(
    data: schemas.AppStatusCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    # Check duplicate
    existing = db.query(models.AppStatus).filter(
        models.AppStatus.department == data.department,
        models.AppStatus.name == data.name,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Status with this name already exists")

    # Assign sort_order = max + 1
    max_order = db.query(models.AppStatus).filter(
        models.AppStatus.department == data.department
    ).count()

    status = models.AppStatus(
        department=data.department,
        name=data.name,
        text_color=data.text_color or "#000000",
        bg_color=data.bg_color or "#f1f5f9",
        sort_order=max_order + 1,
    )
    db.add(status)
    db.commit()
    db.refresh(status)
    return status


@router.put("/{status_id}", response_model=schemas.AppStatusOut)
def update_status(
    status_id: int,
    data: schemas.AppStatusUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    status = db.query(models.AppStatus).filter(models.AppStatus.id == status_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(status, k, v)
    db.commit()
    db.refresh(status)
    return status


@router.delete("/{status_id}")
def delete_status(
    status_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    status = db.query(models.AppStatus).filter(models.AppStatus.id == status_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    db.delete(status)
    db.commit()
    return {"message": "Deleted"}


@router.post("/reorder")
def reorder_statuses(
    data: schemas.AppStatusReorder,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    for i, sid in enumerate(data.ordered_ids):
        db.query(models.AppStatus).filter(models.AppStatus.id == sid).update(
            {"sort_order": i + 1}
        )
    db.commit()
    return {"message": "Reordered"}
