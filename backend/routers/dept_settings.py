"""
Department-level settings (e.g., per-department Google Chat webhook URLs).
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/dept-settings", tags=["dept-settings"])


def _require_admin(current_user: models.User):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager required")


@router.get("/{department}", response_model=List[schemas.DeptSettingOut])
def get_dept_settings(
    department: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.query(models.DeptSetting).filter(
        models.DeptSetting.department == department
    ).all()


@router.put("/{department}/{key}", response_model=schemas.DeptSettingOut)
def set_dept_setting(
    department: str,
    key: str,
    data: schemas.DeptSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_admin(current_user)
    setting = db.query(models.DeptSetting).filter_by(
        department=department, key=key
    ).first()
    if setting:
        setting.value = data.value
    else:
        setting = models.DeptSetting(department=department, key=key, value=data.value)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.get("/")
def get_all_dept_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """Return all settings grouped by department."""
    settings = db.query(models.DeptSetting).all()
    result: dict = {}
    for s in settings:
        if s.department not in result:
            result[s.department] = {}
        result[s.department][s.key] = s.value
    return result
