from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/students", tags=["students"])


@router.get("/", response_model=List[schemas.StudentOut])
def list_students(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Student)
    if search:
        q = q.filter(models.Student.full_name.ilike(f"%{search}%"))
    return q.order_by(models.Student.full_name).all()


@router.post("/", response_model=schemas.StudentOut)
def create_student(data: schemas.StudentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student = models.Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/{student_id}", response_model=schemas.StudentOut)
def update_student(student_id: int, data: schemas.StudentUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for key, val in data.model_dump(exclude_none=True).items():
        setattr(student, key, val)
    db.commit()
    db.refresh(student)
    return student
