"""
Dynamic role management — fully manual, no defaults or auto-apply.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/roles", tags=["roles"])


def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


@router.get("/", response_model=List[schemas.RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.query(models.Role).order_by(models.Role.name).all()


@router.post("/", response_model=schemas.RoleOut)
def create_role(
    data: schemas.RoleCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Role name cannot be empty")
    existing = db.query(models.Role).filter(models.Role.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{name}' already exists")
    role = models.Role(name=name)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=schemas.RoleOut)
def update_role(
    role_id: int,
    data: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    new_name = data.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Role name cannot be empty")
    conflict = db.query(models.Role).filter(
        models.Role.name == new_name, models.Role.id != role_id
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail=f"Role '{new_name}' already exists")
    old_name = role.name
    role.name = new_name
    db.query(models.RolePermission).filter(
        models.RolePermission.role == old_name
    ).update({"role": new_name})
    db.query(models.User).filter(models.User.role == old_name).update({"role": new_name})
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.name == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the admin role")
    user_count = db.query(models.User).filter(models.User.role == role.name).count()
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete '{role.name}' — {user_count} user(s) still have this role. Reassign them first."
        )
    db.query(models.RolePermission).filter(models.RolePermission.role == role.name).delete()
    db.delete(role)
    db.commit()
    return {"ok": True}
