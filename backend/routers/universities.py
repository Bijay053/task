from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/universities", tags=["universities"])


@router.get("/", response_model=List[schemas.UniversityOut])
def list_universities(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.University)
    if search:
        q = q.filter(models.University.name.ilike(f"%{search}%"))
    return q.order_by(models.University.name).all()


@router.post("/", response_model=schemas.UniversityOut)
def create_university(data: schemas.UniversityCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.University).filter(
        models.University.name.ilike(data.name.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"A university named '{existing.name}' already exists.")
    uni = models.University(**data.model_dump())
    db.add(uni)
    db.commit()
    db.refresh(uni)
    return uni


@router.put("/{uni_id}", response_model=schemas.UniversityOut)
def update_university(uni_id: int, data: schemas.UniversityUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    uni = db.query(models.University).filter(models.University.id == uni_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")
    if data.name and data.name.strip().lower() != uni.name.lower():
        duplicate = db.query(models.University).filter(
            models.University.name.ilike(data.name.strip()),
            models.University.id != uni_id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"A university named '{duplicate.name}' already exists.")
    for key, val in data.model_dump(exclude_none=True).items():
        setattr(uni, key, val)
    db.commit()
    db.refresh(uni)
    return uni
