"""
Role-based permission management — fully manual, no defaults or auto-apply.
Permissions are stored per-role, not per-user.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/permissions", tags=["permissions"])


def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager role required")
    return current_user


@router.get("/my", response_model=List[schemas.RolePermOut])
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return stored permissions for the current user's role."""
    return db.query(models.RolePermission).filter(
        models.RolePermission.role == current_user.role
    ).all()


@router.get("/role/{role}", response_model=List[schemas.RolePermOut])
def get_role_permissions(
    role: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Return stored permissions for a role across all departments."""
    return db.query(models.RolePermission).filter(
        models.RolePermission.role == role
    ).all()


@router.put("/role/{role}/{department}", response_model=schemas.RolePermOut)
def set_role_permission(
    role: str,
    department: str,
    data: schemas.RolePermUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Set permissions for a role in a department. No batch-apply to users."""
    perm = db.query(models.RolePermission).filter(
        models.RolePermission.role == role,
        models.RolePermission.department == department,
    ).first()
    if not perm:
        perm = models.RolePermission(role=role, department=department)
        db.add(perm)
    perm.can_view = data.can_view
    perm.can_edit = data.can_edit
    perm.can_delete = data.can_delete
    perm.can_upload = data.can_upload
    perm.can_view_all_users = data.can_view_all_users
    db.commit()
    db.refresh(perm)
    return perm
