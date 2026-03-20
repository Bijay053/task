"""
Bulk upload via XLSX for GS and Offer applications.
Expected columns:

GS:   App ID | Student Name | Country | University | Course | Intake | Status | Agent Name | Agent Email | Submitted Date | Verification | Remarks
Offer: App ID | Student Name | University | Course | Intake | Channel | Status | Agent Name | Agent Email | Offer Applied Date | Offer Received Date | Remarks

Agent Name / Agent Email → auto-creates External Agent record if not already in the system.
Assigned To Email → optional internal staff assignment.
"""
import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
from backend.routers.notifications import send_assignment_notification

router = APIRouter(prefix="/bulk-upload", tags=["bulk-upload"])


def _parse_date(val) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        from datetime import datetime
        return datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
    except Exception:
        try:
            from datetime import datetime
            return datetime.strptime(str(val).strip(), "%d/%m/%Y").date()
        except Exception:
            return None


def _find_or_create_student(db: Session, name: str) -> Optional[models.Student]:
    if not name:
        return None
    name = name.strip()
    student = db.query(models.Student).filter(
        models.Student.full_name.ilike(name)
    ).first()
    if not student:
        student = models.Student(full_name=name)
        db.add(student)
        db.flush()
    return student


def _find_university(db: Session, name: str) -> Optional[models.University]:
    if not name:
        return None
    name = name.strip()
    return db.query(models.University).filter(
        models.University.name.ilike(name)
    ).first()


def _find_user_by_email(db: Session, email: str) -> Optional[models.User]:
    if not email:
        return None
    return db.query(models.User).filter(
        models.User.email.ilike(email.strip())
    ).first()


def _find_or_create_agent(
    db: Session,
    name: Optional[str] = None,
    email: Optional[str] = None,
) -> Optional[models.Agent]:
    """
    Find an external Agent by name (preferred) or email.
    Creates a new Agent record if not found.
    Also updates email on an existing record if it was missing.
    Returns None if neither name nor email provided.
    """
    name = name.strip() if name else None
    email = email.strip() if email else None

    if not name and not email:
        return None

    agent: Optional[models.Agent] = None

    # Try name lookup first (most reliable for deduplication)
    if name:
        agent = db.query(models.Agent).filter(
            models.Agent.name.ilike(name)
        ).first()

    # Fall back to email lookup
    if not agent and email:
        agent = db.query(models.Agent).filter(
            models.Agent.email.ilike(email)
        ).first()

    if agent:
        # Patch missing fields without overwriting existing data
        changed = False
        if email and not agent.email:
            agent.email = email
            changed = True
        if name and not agent.name:
            agent.name = name
            changed = True
        if changed:
            db.flush()
    else:
        # Create new external agent
        agent = models.Agent(
            name=name or email,
            email=email,
        )
        db.add(agent)
        db.flush()

    return agent


def _get_statuses(db: Session, department: str):
    statuses = db.query(models.AppStatus).filter(
        models.AppStatus.department == department,
        models.AppStatus.is_active == True,
    ).all()
    return {s.name.lower(): s.name for s in statuses}


@router.post("/{department}")
async def bulk_upload(
    department: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if department not in ("gs", "offer"):
        raise HTTPException(status_code=400, detail="Invalid department")
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted")

    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read XLSX: {e}")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return {"created": 0, "skipped": 0, "errors": ["File is empty or has no data rows"]}

    headers = [str(h).strip().lower() if h else "" for h in rows[0]]

    def col(name: str):
        """Get column index by partial name match."""
        for i, h in enumerate(headers):
            if name.lower() in h:
                return i
        return -1

    def _has_col(name: str) -> bool:
        return col(name) >= 0

    status_map = _get_statuses(db, department)
    default_status = "In Review" if department == "gs" else "On Hold"

    created = 0
    skipped = 0
    errors = []
    # Track assignments to notify after commit
    assignments: list[tuple[models.Application, models.User]] = []

    for row_idx, row in enumerate(rows[1:], start=2):
        def cell(name):
            idx = col(name)
            if idx < 0 or idx >= len(row):
                return None
            v = row[idx]
            return str(v).strip() if v is not None else None

        student_name_val = cell("student")
        if not student_name_val:
            skipped += 1
            errors.append(f"Row {row_idx}: Missing student name — skipped")
            continue

        try:
            student = _find_or_create_student(db, student_name_val)
            uni_name = cell("university")
            university = _find_university(db, uni_name)

            raw_status = cell("status") or default_status
            status = status_map.get(raw_status.lower(), raw_status)

            # ── External Agent: auto-create if not found ───────────────────
            # Look for "Agent Name" column first, then "Agent Email"
            agent_name_val = cell("agent name") or cell("external agent")
            agent_email_val = cell("agent email")
            # If no dedicated "agent name" col, fall back to checking generic "agent" col
            # but ONLY if there is no "agent email" col that already matched above
            if not agent_name_val and not agent_email_val:
                agent_name_val = cell("agent")  # generic fallback

            ext_agent = _find_or_create_agent(db, agent_name_val, agent_email_val)

            # ── Internal staff assignee (optional) ─────────────────────────
            # Looks for "Assigned To Email" / "Handler Email" / "Staff Email" columns
            handler_email = (
                cell("assigned to email")
                or cell("handler email")
                or cell("staff email")
                or cell("assignee email")
            )
            assignee = _find_user_by_email(db, handler_email) if handler_email else None

            app_id_val = (
                cell("app id")
                or cell("app_id")
                or cell("application id")
                or cell("appid")
                or cell("ref")
            )

            app_data: dict = {
                "department": department,
                "app_id": app_id_val or None,
                "student_id": student.id if student else None,
                "student_name": student_name_val,
                "university_id": university.id if university else None,
                "university_name": uni_name,
                "course": cell("course"),
                "intake": cell("intake"),
                "country": cell("country"),
                "remarks": cell("remark") or cell("note"),
                "application_status": status,
                "agent_id": ext_agent.id if ext_agent else None,
                "assigned_to_id": assignee.id if assignee else None,
                "assigned_date": date.today() if assignee else None,
                "created_by_id": current_user.id,
            }

            if department == "gs":
                app_data["submitted_date"] = _parse_date(cell("submitted"))
                app_data["verification"] = cell("verification")
                app_data["priority"] = cell("priority") or "normal"
            else:
                app_data["channel"] = cell("channel")
                app_data["offer_applied_date"] = _parse_date(cell("offer applied") or cell("applied date"))
                app_data["offer_received_date"] = _parse_date(cell("offer received") or cell("received date"))

            if app_id_val and student_name_val and university and db.query(models.Application).filter(
                models.Application.department == department,
                models.Application.app_id == app_id_val,
                models.Application.student_name.ilike(student_name_val),
                models.Application.university_id == university.id,
            ).first():
                skipped += 1
                errors.append(f"Row {row_idx}: Duplicate — same App ID, Student, and University already exists.")
                continue

            app = models.Application(**app_data)
            db.add(app)

            if assignee:
                assignments.append((app, assignee))

            created += 1

        except Exception as e:
            skipped += 1
            errors.append(f"Row {row_idx}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB commit failed: {e}")

    # Send assignment notifications after successful commit
    for app, assignee in assignments:
        try:
            db.refresh(app, attribute_names=["student", "university", "assigned_to"])
            send_assignment_notification(
                db, app, assignee, current_user.full_name
            )
        except Exception:
            pass  # Notification failure must never block the upload response

    return {"created": created, "skipped": skipped, "errors": errors[:20]}
