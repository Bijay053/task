from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas
from backend.routers.notifications import send_assignment_notification

router = APIRouter(prefix="/applications", tags=["applications"])


def load_options():
    return (
        joinedload(models.Application.student),
        joinedload(models.Application.university),
        joinedload(models.Application.agent),
        joinedload(models.Application.assigned_to),
        joinedload(models.Application.created_by),
        joinedload(models.Application.followers).joinedload(models.ApplicationFollower.user),
    )


def _sync_followers(db: Session, app_id: int, follower_ids: List[int]):
    """Replace follower list for an application."""
    db.query(models.ApplicationFollower).filter(
        models.ApplicationFollower.application_id == app_id
    ).delete(synchronize_session=False)
    for uid in follower_ids:
        db.add(models.ApplicationFollower(application_id=app_id, user_id=uid))
    db.flush()


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
    return user.role == "agent"


def _ensure_university(db: Session, university_id: Optional[int], university_name: Optional[str]) -> Optional[int]:
    """Look up or auto-create a university by name, returning its ID."""
    if university_id:
        return university_id
    if not university_name or not university_name.strip():
        return None
    name = university_name.strip()
    existing = db.query(models.University).filter(
        models.University.name.ilike(name)
    ).first()
    if existing:
        return existing.id
    new_uni = models.University(name=name)
    db.add(new_uni)
    db.flush()
    return new_uni.id


def _check_duplicate(
    db: Session,
    department: str,
    app_id_val: Optional[str],
    student_name: Optional[str],
    student_id: Optional[int],
    university_id: Optional[int],
    course: Optional[str] = None,
    exclude_id: Optional[int] = None,
) -> bool:
    """Return True if a duplicate application exists (App ID, Student, University, Course all match)."""
    # Need at least one student identifier
    if not student_name and not student_id:
        return False
    # Need at least two of: app_id, university, course to form a meaningful duplicate check
    identifiers = [bool(app_id_val), bool(university_id), bool(course and course.strip())]
    if sum(identifiers) < 1:
        return False
    q = db.query(models.Application).filter(
        models.Application.department == department,
    )
    if app_id_val:
        q = q.filter(models.Application.app_id == app_id_val)
    if university_id:
        q = q.filter(models.Application.university_id == university_id)
    if course and course.strip():
        q = q.filter(models.Application.course.ilike(course.strip()))
    if student_id:
        q = q.filter(models.Application.student_id == student_id)
    else:
        q = q.filter(models.Application.student_name.ilike(student_name))
    if exclude_id:
        q = q.filter(models.Application.id != exclude_id)
    return q.first() is not None


def get_manager_agent_ids(db: Session, manager_id: int) -> Optional[list]:
    """Get agent IDs a manager is responsible for. None = no restriction (see all)."""
    mappings = db.query(models.ManagerAgentMapping).filter(
        models.ManagerAgentMapping.manager_id == manager_id
    ).all()
    if not mappings:
        return None  # No restriction — see all
    return [m.agent_id for m in mappings]


@router.get("/", response_model=List[schemas.ApplicationOut])
def list_applications(
    department: Optional[str] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    agent_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Application).options(*load_options())

    # Role-based access control
    if current_user.role == "agent":
        # Agents only see their own assigned applications
        q = q.filter(models.Application.assigned_to_id == current_user.id)
    elif current_user.role == "manager":
        # Managers are restricted to apps belonging to their mapped agents
        manager_agent_ids = get_manager_agent_ids(db, current_user.id)
        if manager_agent_ids is not None:
            q = q.filter(models.Application.agent_id.in_(manager_agent_ids))
    # admin and team_leader see all applications

    if department:
        q = q.filter(models.Application.department == department)
    if assigned_to_id is not None:
        q = q.filter(models.Application.assigned_to_id == assigned_to_id)
    if agent_id is not None:
        q = q.filter(models.Application.agent_id == agent_id)
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
    """Return applications assigned to current user OR where they are a follower."""
    q = (
        db.query(models.Application)
        .options(*load_options())
        .outerjoin(
            models.ApplicationFollower,
            (models.ApplicationFollower.application_id == models.Application.id) &
            (models.ApplicationFollower.user_id == current_user.id),
        )
        .filter(
            or_(
                models.Application.assigned_to_id == current_user.id,
                models.ApplicationFollower.user_id == current_user.id,
            )
        )
        .distinct()
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
    follower_ids = app_data.pop("follower_ids", []) or []
    app_data["department"] = dept
    app_data["created_by_id"] = current_user.id

    if data.assigned_to_id:
        app_data["assigned_date"] = date.today()

    if not app_data.get("application_status"):
        app_data["application_status"] = default_status(db, dept)

    resolved_uni_id = _ensure_university(db, app_data.get("university_id"), app_data.get("university_name"))
    if resolved_uni_id:
        app_data["university_id"] = resolved_uni_id

    if _check_duplicate(db, dept, app_data.get("app_id"), app_data.get("student_name"), app_data.get("student_id"), app_data.get("university_id"), app_data.get("course")):
        raise HTTPException(
            status_code=409,
            detail="A duplicate application already exists with the same App ID, Student, University, and Course in this department.",
        )

    app = models.Application(**app_data)
    db.add(app)
    db.flush()  # get app.id before adding followers
    _sync_followers(db, app.id, follower_ids)
    db.commit()
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by", "followers"])

    # Notify the assignee if one was set at creation
    if app.assigned_to_id and app.assigned_to:
        try:
            send_assignment_notification(db, app, app.assigned_to, current_user.full_name)
        except Exception:
            pass

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
    follower_ids = update_data.pop("follower_ids", None)

    new_assignee_id = update_data.get("assigned_to_id")
    assignee_changed = new_assignee_id is not None and new_assignee_id != app.assigned_to_id

    if assignee_changed:
        app.assigned_date = date.today()
        db.add(models.ActivityLog(
            application_id=app.id,
            changed_by_id=current_user.id,
            field_name="assigned_to_id",
            old_value=str(app.assigned_to_id),
            new_value=str(new_assignee_id),
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

    resolved_uni_id = _ensure_university(
        db,
        update_data.get("university_id"),
        update_data.get("university_name"),
    )
    if resolved_uni_id:
        update_data["university_id"] = resolved_uni_id

    for key, val in update_data.items():
        setattr(app, key, val)

    if follower_ids is not None:
        _sync_followers(db, app.id, follower_ids)

    db.commit()
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by", "followers"])

    # Notify the new assignee if assignment changed
    if assignee_changed and app.assigned_to:
        try:
            send_assignment_notification(db, app, app.assigned_to, current_user.full_name)
        except Exception:
            pass

    return app


@router.patch("/{app_id}/followers", response_model=schemas.ApplicationOut)
def update_followers(
    app_id: int,
    data: schemas.FollowerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Set the exact follower list for an application."""
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _sync_followers(db, app.id, data.follower_ids)
    db.commit()
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by", "followers"])
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
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by", "followers"])
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
    assignee_changed = data.assigned_to_id != old_assignee
    if assignee_changed:
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
    db.refresh(app, attribute_names=["student", "university", "assigned_to", "created_by", "followers"])

    # Notify the new assignee
    if assignee_changed and app.assigned_to:
        try:
            send_assignment_notification(db, app, app.assigned_to, current_user.full_name)
        except Exception:
            pass

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
