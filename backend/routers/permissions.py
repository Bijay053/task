"""
Department-level permission management per user.
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


@router.get("/user/{user_id}", response_model=List[schemas.UserDeptPermOut])
def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Users can see their own perms; admin/manager can see anyone's
    if current_user.role not in ("admin", "manager") and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(models.UserDeptPermission).filter(
        models.UserDeptPermission.user_id == user_id
    ).all()


@router.put("/user/{user_id}/{department}", response_model=schemas.UserDeptPermOut)
def set_user_permission(
    user_id: int,
    department: str,
    data: schemas.UserDeptPermUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    perm = db.query(models.UserDeptPermission).filter(
        models.UserDeptPermission.user_id == user_id,
        models.UserDeptPermission.department == department,
    ).first()
    if not perm:
        perm = models.UserDeptPermission(user_id=user_id, department=department)
        db.add(perm)
    perm.can_view = data.can_view
    perm.can_edit = data.can_edit
    perm.can_delete = data.can_delete
    perm.can_upload = data.can_upload
    db.commit()
    db.refresh(perm)
    return perm
