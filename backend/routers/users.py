import os
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user, require_admin, get_password_hash
from backend.email_service import send_welcome_email
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/users", tags=["users"])

AVAILABILITY_CHOICES = {"available", "on_leave", "off_duty"}


@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.User).filter(models.User.is_active == True).all()


@router.post("/", response_model=schemas.UserOut)
def create_user(data: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        password_changed_at=datetime(2000, 1, 1),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    app_url = os.environ.get("APP_URL", "")
    send_welcome_email(to=data.email, full_name=data.full_name, password=data.password, app_url=app_url)
    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.email is not None:
        user.email = data.email
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.availability_status is not None:
        if data.availability_status not in AVAILABILITY_CHOICES:
            raise HTTPException(status_code=400, detail=f"Invalid availability status. Choose: {AVAILABILITY_CHOICES}")
        user.availability_status = data.availability_status
    if data.password is not None:
        user.hashed_password = get_password_hash(data.password)
        # Invalidate existing sessions and clear any lockout
        user.token_version = (getattr(user, "token_version", 0) or 0) + 1
        user.failed_login_attempts = 0
        user.locked_until = None
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


@router.put("/{user_id}/availability", response_model=schemas.UserOut)
def update_availability(
    user_id: int,
    data: schemas.UserAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Team leaders and above can update staff availability status."""
    if current_user.role not in ("admin", "manager", "team_leader"):
        # Also allow self-update
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions to update availability")
    if data.availability_status not in AVAILABILITY_CHOICES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose: {AVAILABILITY_CHOICES}")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.availability_status = data.availability_status
    db.commit()
    db.refresh(user)
    return user
