from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/students", tags=["students"])


@router.get("/summary")
def students_summary(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[Any]:
    """Returns students enriched with their linked applications (app IDs, agents, universities)."""
    q = db.query(models.Student)
    if search:
        q = q.filter(models.Student.full_name.ilike(f"%{search}%"))
    students = q.order_by(models.Student.full_name).all()

    result = []
    for s in students:
        apps = (
            db.query(models.Application)
            .options(
                joinedload(models.Application.agent),
                joinedload(models.Application.university),
            )
            .filter(models.Application.student_id == s.id)
            .all()
        )
        universities = []
        seen_unis = set()
        for app in apps:
            uni_name = app.university.name if app.university else app.university_name
            if uni_name and uni_name not in seen_unis:
                universities.append(uni_name)
                seen_unis.add(uni_name)

        agents = []
        seen_agents = set()
        for app in apps:
            agent_name = app.agent.name if app.agent else None
            if agent_name and agent_name not in seen_agents:
                agents.append(agent_name)
                seen_agents.add(agent_name)

        result.append({
            "id": s.id,
            "full_name": s.full_name,
            "app_ids": [app.id for app in apps],
            "agents": agents,
            "universities": universities,
        })
    return result


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
