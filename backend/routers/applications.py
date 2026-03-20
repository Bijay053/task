from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/applications", tags=["applications"])


def load_options():
    return (
        joinedload(models.Application.student),
        joinedload(models.Application.university),
        joinedload(models.Application.assigned_to),
        joinedload(models.Application.created_by),
    )


def default_status(db: Session, department: str) -> str:
    """Return first active status for department from DB, or hardcoded fallback."""
    first = db.query(models.AppStatus).filter(
        models.AppStatus.department == department,
        models.AppStatus.is_active == True,
    ).order_by(models.AppStatus.sort_order.asc()).first()
    if first:
        return first.name
    return "In Review" if department == "gs" else "On Hold"


def is_agent_only(user: models.User) -> bool:
    """Returns True if user should only see their own applications."""
    return user.role == "agent"


@router.get("/", response_model=List[schemas.ApplicationOut])
def list_applications(
    department: Optional[str] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Application).options(*load_options())

    # Agents can only see their own assigned applications
    if is_agent_only(current_user):
        q = q.filter(models.Application.assigned_to_id == current_user.id)

    if department:
        q = q.filter(models.Application.department == department)
    if assigned_to_id is not None:
        q = q.filter(models.Application.assigned_to_id == assigned_to_id)
    if status:
        q = q.filter(models.Application.application_status == status)
    if search:
        q = q.outerjoin(models.Student).filter(
            models.Student.full_name.ilike(f"%{search}%") |
            models.Application.student_name.ilike(f"%{search}%")
        )
    return q.order_by(models.Application.created_at.desc()).all()


@router.get("/my", response_model=List[schemas.ApplicationOut])
def my_applications(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Application)
        .options(*load_options())
        .filter(models.Application.assigned_to_id == current_user.id)
    )
    if department:
        q = q.filter(models.Application.department == department)
    return q.order_by(models.Application.updated_at.desc()).all()


@router.post("/", response_model=schemas.ApplicationOut)
def create_application(
    data: schemas.ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    dept = data.department or "gs"
    app_data = data.model_dump()
    app_data["department"] = dept
    app_data["created_by_id"] = current_user.id

    if data.assigned_to_id:
        app_data["assigned_date"] = date.today()

    if not app_data.get("application_status"):
        app_data["application_status"] = default_status(db, dept)

    app = models.Application(**app_data)
    db.add(app)
    db.commit()
    db.refresh(app)
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by"])
    return app


@router.get("/{app_id}", response_model=schemas.ApplicationOut)
def get_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = db.query(models.Application).options(*load_options()).filter(
        models.Application.id == app_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if is_agent_only(current_user) and app.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return app


@router.put("/{app_id}", response_model=schemas.ApplicationOut)
def update_application(
    app_id: int,
    data: schemas.ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    update_data = data.model_dump(exclude_none=True)

    if "assigned_to_id" in update_data and update_data["assigned_to_id"] != app.assigned_to_id:
        app.assigned_date = date.today()
        db.add(models.ActivityLog(
            application_id=app.id,
            changed_by_id=current_user.id,
            field_name="assigned_to_id",
            old_value=str(app.assigned_to_id),
            new_value=str(update_data["assigned_to_id"]),
        ))

    if "application_status" in update_data:
        old_status = app.application_status
        db.add(models.ActivityLog(
            application_id=app.id,
            changed_by_id=current_user.id,
            field_name="application_status",
            old_value=old_status,
            new_value=update_data["application_status"],
        ))

    for key, val in update_data.items():
        setattr(app, key, val)

    db.commit()
    db.refresh(app)
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by"])
    return app


@router.patch("/{app_id}/status", response_model=schemas.ApplicationOut)
def update_status(
    app_id: int,
    data: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    old_status = app.application_status
    app.application_status = data.application_status
    db.add(models.ActivityLog(
        application_id=app.id,
        changed_by_id=current_user.id,
        field_name="application_status",
        old_value=old_status,
        new_value=app.application_status,
    ))
    db.commit()
    db.refresh(app)
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by"])
    return app


@router.patch("/{app_id}/assign", response_model=schemas.ApplicationOut)
def assign_application(
    app_id: int,
    data: schemas.AssignUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Only admin, manager, team_leader can assign
    if current_user.role not in ("admin", "manager", "team_leader"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to assign")
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    old_assignee = app.assigned_to_id
    if data.assigned_to_id != old_assignee:
        app.assigned_to_id = data.assigned_to_id
        app.assigned_date = date.today()
        db.add(models.ActivityLog(
            application_id=app.id,
            changed_by_id=current_user.id,
            field_name="assigned_to_id",
            old_value=str(old_assignee),
            new_value=str(data.assigned_to_id),
        ))
    db.commit()
    db.refresh(app)
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by"])
    return app


@router.delete("/{app_id}")
def delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    # Agents cannot delete
    if current_user.role == "agent":
        raise HTTPException(status_code=403, detail="Agents cannot delete applications")
    db.delete(app)
    db.commit()
    return {"message": "Deleted"}


@router.get("/{app_id}/logs", response_model=List[schemas.ActivityLogOut])
def get_logs(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ActivityLog)
        .options(joinedload(models.ActivityLog.changed_by_user))
        .filter(models.ActivityLog.application_id == app_id)
        .order_by(models.ActivityLog.changed_at.desc())
        .all()
    )
