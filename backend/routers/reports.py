"""
Performance reports for management — per-staff and stage-wise statistics.
"""
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/reports", tags=["reports"])

# ─── Status definitions ───────────────────────────────────────────────────────

GS_ALL_STATUSES      = {"Review", "GS submitted", "GS onhold", "GS approved", "GS Rejected"}
GS_COMPLETED_STATUSES = {"GS approved", "GS Rejected"}
GS_ACTIVE_STATUSES   = {"Review", "GS submitted", "GS onhold"}

OFFER_ALL_STATUSES      = {"Enquiries", "Document Requested", "On Hold", "Offer Requested",
                           "Offer Received", "Offer Rejected", "Not Eligible"}
OFFER_COMPLETED_STATUSES = {"Offer Received", "Offer Rejected", "Not Eligible"}
OFFER_ACTIVE_STATUSES    = {"Enquiries", "Document Requested", "On Hold", "Offer Requested"}


def require_manager(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from fastapi import HTTPException
    if current_user.role in ("admin", "manager"):
        return current_user
    BASE_ROLES = {"admin", "manager", "team_leader", "agent"}
    if current_user.role not in BASE_ROLES:
        perm = db.query(models.RolePermission).filter(
            models.RolePermission.role == current_user.role,
            models.RolePermission.department == "reports",
        ).first()
        if perm and perm.can_view:
            return current_user
    raise HTTPException(status_code=403, detail="Manager role required")


def _parse_date(d: Optional[str]) -> Optional[datetime]:
    if not d:
        return None
    try:
        return datetime.strptime(d, "%Y-%m-%d")
    except Exception:
        return None


@router.get("/performance", response_model=List[schemas.StaffPerformance])
def performance_report(
    department: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    users = db.query(models.User).filter(models.User.is_active == True).all()
    result = []
    for user in users:
        q = db.query(models.Application).filter(
            models.Application.assigned_to_id == user.id
        )
        if department == "gs":
            q = q.filter(
                models.Application.department == "gs",
                models.Application.application_status.in_(list(GS_ALL_STATUSES)),
            )
        elif department == "offer":
            q = q.filter(
                models.Application.department == "offer",
                models.Application.application_status.in_(list(OFFER_ALL_STATUSES)),
            )
        if dt_from:
            q = q.filter(models.Application.created_at >= dt_from)
        if dt_to:
            q = q.filter(models.Application.created_at < datetime(dt_to.year, dt_to.month, dt_to.day, 23, 59, 59))

        apps = q.all()

        # gs_count: apps in GS department with valid GS statuses
        gs_count = sum(
            1 for a in apps
            if a.department == "gs" and a.application_status in GS_ALL_STATUSES
        )
        # offer_count: apps in Offer department with valid Offer statuses
        offer_count = sum(
            1 for a in apps
            if a.department == "offer" and a.application_status in OFFER_ALL_STATUSES
        )

        breakdown: dict = {}
        for app in apps:
            breakdown[app.application_status] = breakdown.get(app.application_status, 0) + 1

        result.append(schemas.StaffPerformance(
            user_id=user.id,
            full_name=user.full_name,
            role=user.role,
            total_assigned=len(apps),
            gs_count=gs_count,
            offer_count=offer_count,
            status_breakdown=breakdown,
        ))

    return sorted(result, key=lambda x: x.total_assigned, reverse=True)


@router.get("/staff-timing", response_model=List[schemas.StaffTimingReport])
def staff_timing_report(
    department: Optional[str] = Query("gs"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    """
    For each staff member, compute average handling time on GS or Offer applications
    using ActivityLog data (status change timestamps).

    GS:
      - Total  = Review + GS submitted + GS onhold + GS approved + GS Rejected
      - Completed = GS approved + GS Rejected
      - Pending   = Review + GS submitted + GS onhold

    Offer:
      - Total  = Enquiries + Document Requested + On Hold + Offer Requested +
                 Offer Received + Offer Rejected + Not Eligible
      - Completed = Offer Received + Offer Rejected + Not Eligible
      - Pending   = Enquiries + Document Requested + On Hold + Offer Requested
    """
    now = datetime.utcnow()
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    dept = department if department in ("gs", "offer") else "gs"

    if dept == "gs":
        all_statuses = GS_ALL_STATUSES
        completed_statuses = GS_COMPLETED_STATUSES
    else:
        all_statuses = OFFER_ALL_STATUSES
        completed_statuses = OFFER_COMPLETED_STATUSES

    users = db.query(models.User).filter(models.User.is_active == True).all()
    result = []

    for user in users:
        q = db.query(models.Application).filter(
            models.Application.assigned_to_id == user.id,
            models.Application.department == dept,
            models.Application.application_status.in_(list(all_statuses)),
        )
        if dt_from:
            q = q.filter(models.Application.created_at >= dt_from)
        if dt_to:
            q = q.filter(models.Application.created_at < datetime(dt_to.year, dt_to.month, dt_to.day, 23, 59, 59))

        apps = q.all()

        if not apps:
            result.append(schemas.StaffTimingReport(
                user_id=user.id, full_name=user.full_name, role=user.role,
                total_gs=0, pending_gs=0, completed_gs=0,
                avg_handling_days=None, avg_completion_days=None,
                avg_first_action_days=None, avg_stage_days=None,
            ))
            continue

        app_ids = [a.id for a in apps]

        status_logs = (
            db.query(models.ActivityLog)
            .filter(
                models.ActivityLog.application_id.in_(app_ids),
                models.ActivityLog.field_name == "application_status",
            )
            .order_by(models.ActivityLog.application_id, models.ActivityLog.changed_at)
            .all()
        )

        logs_by_app: dict = {}
        for log in status_logs:
            logs_by_app.setdefault(log.application_id, []).append(log)

        handling_days_list = []
        completion_days_list = []
        first_action_days_list = []
        stage_days: dict = {}

        pending_count = 0
        completed_count = 0

        for app in apps:
            is_completed = app.application_status in completed_statuses
            if is_completed:
                completed_count += 1
            else:
                pending_count += 1

            app_id_logs = logs_by_app.get(app.id)
            ref = app.assigned_date or app.created_at.date() if hasattr(app, 'assigned_date') and app.assigned_date else None

            # ── Avg Handling Time: include ALL apps (active + completed) ──────
            if ref:
                ref_dt = datetime.combine(ref, datetime.min.time()) if hasattr(ref, 'year') and not hasattr(ref, 'hour') else ref
                if is_completed and app_id_logs:
                    last_log = app_id_logs[-1]
                    days = (last_log.changed_at - ref_dt).total_seconds() / 86400
                else:
                    days = (now - ref_dt).total_seconds() / 86400
                handling_days_list.append(max(0, days))

            # ── Avg Completion Time: only completed apps ───────────────────────
            if is_completed:
                ref_dt_for_comp = (
                    datetime.combine(app.assigned_date, datetime.min.time())
                    if app.assigned_date else app.created_at
                )
                if app_id_logs:
                    last_log = app_id_logs[-1]
                    comp_days = (last_log.changed_at - ref_dt_for_comp).total_seconds() / 86400
                else:
                    # No log — use current time as best estimate
                    comp_days = (now - ref_dt_for_comp).total_seconds() / 86400
                completion_days_list.append(max(0, comp_days))

            # ── Avg First Action ───────────────────────────────────────────────
            if app_id_logs:
                first_log = app_id_logs[0]
                fa_days = (first_log.changed_at - app.created_at).total_seconds() / 86400
                first_action_days_list.append(max(0, fa_days))

            # ── Stage duration breakdown ───────────────────────────────────────
            logs = app_id_logs or []
            if logs:
                init_status = logs[0].old_value
                if init_status:
                    init_days = (logs[0].changed_at - app.created_at).total_seconds() / 86400
                    stage_days.setdefault(init_status, []).append(max(0, init_days))

                for i in range(len(logs) - 1):
                    from_status = logs[i].new_value
                    if from_status:
                        days_in = (logs[i + 1].changed_at - logs[i].changed_at).total_seconds() / 86400
                        stage_days.setdefault(from_status, []).append(max(0, days_in))

                current_status = logs[-1].new_value
                if current_status and not is_completed:
                    days_in = (now - logs[-1].changed_at).total_seconds() / 86400
                    stage_days.setdefault(current_status, []).append(max(0, days_in))

        def avg(lst): return round(sum(lst) / len(lst), 1) if lst else None

        avg_stage = {s: round(sum(d) / len(d), 1) for s, d in stage_days.items()} if stage_days else None

        result.append(schemas.StaffTimingReport(
            user_id=user.id,
            full_name=user.full_name,
            role=user.role,
            total_gs=len(apps),
            pending_gs=pending_count,
            completed_gs=completed_count,
            avg_handling_days=avg(handling_days_list),
            avg_completion_days=avg(completion_days_list),
            avg_first_action_days=avg(first_action_days_list),
            avg_stage_days=avg_stage,
        ))

    return sorted(result, key=lambda x: x.total_gs, reverse=True)


@router.get("/stage-analysis", response_model=List[schemas.StageReport])
def stage_analysis(
    department: str = Query("gs"),
    user_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    """
    Stage-wise time analysis: for each status/stage, compute average, min, max time
    applications spend in that stage, using ActivityLog status change events.
    Optionally filter by assigned staff (user_id) and date range.

    Only statuses relevant to the selected department are included.
    """
    now = datetime.utcnow()
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    valid_statuses = GS_ALL_STATUSES if department == "gs" else OFFER_ALL_STATUSES

    q = db.query(models.Application).filter(
        models.Application.department == department,
        models.Application.application_status.in_(list(valid_statuses)),
    )
    if user_id:
        q = q.filter(models.Application.assigned_to_id == user_id)
    if dt_from:
        q = q.filter(models.Application.created_at >= dt_from)
    if dt_to:
        q = q.filter(models.Application.created_at < datetime(dt_to.year, dt_to.month, dt_to.day, 23, 59, 59))

    apps = q.all()

    if not apps:
        return []

    app_ids = [a.id for a in apps]

    status_logs = (
        db.query(models.ActivityLog)
        .filter(
            models.ActivityLog.application_id.in_(app_ids),
            models.ActivityLog.field_name == "application_status",
        )
        .order_by(models.ActivityLog.application_id, models.ActivityLog.changed_at)
        .all()
    )

    logs_by_app: dict = {}
    for log in status_logs:
        logs_by_app.setdefault(log.application_id, []).append(log)

    stage_durations: dict = {}
    current_stages: dict = {}

    for app in apps:
        logs = logs_by_app.get(app.id, [])

        current_stage = app.application_status
        current_stages[current_stage] = current_stages.get(current_stage, 0) + 1

        if logs:
            init_status = logs[0].old_value
            if init_status and init_status in valid_statuses:
                init_days = (logs[0].changed_at - app.created_at).total_seconds() / 86400
                stage_durations.setdefault(init_status, []).append(max(0, init_days))

            for i in range(len(logs) - 1):
                from_status = logs[i].new_value
                if from_status and from_status in valid_statuses:
                    days_in = (logs[i + 1].changed_at - logs[i].changed_at).total_seconds() / 86400
                    stage_durations.setdefault(from_status, []).append(max(0, days_in))

            current = logs[-1].new_value
            if current and current in valid_statuses:
                days_in = (now - logs[-1].changed_at).total_seconds() / 86400
                stage_durations.setdefault(current, []).append(max(0, days_in))
        else:
            days = (now - app.created_at).total_seconds() / 86400
            stage_durations.setdefault(app.application_status, []).append(max(0, days))

    known_statuses = [
        s.name for s in db.query(models.AppStatus).filter(
            models.AppStatus.department == department,
            models.AppStatus.is_active == True,
        ).order_by(models.AppStatus.sort_order).all()
    ]

    all_statuses = list(dict.fromkeys(known_statuses + list(stage_durations.keys()) + list(current_stages.keys())))
    # Only keep statuses valid for this department
    all_statuses = [s for s in all_statuses if s in valid_statuses]

    result = []
    for status in all_statuses:
        durations = stage_durations.get(status, [])
        result.append(schemas.StageReport(
            status=status,
            department=department,
            total_transitions=len(durations),
            avg_days=round(sum(durations) / len(durations), 1) if durations else None,
            min_days=round(min(durations), 1) if durations else None,
            max_days=round(max(durations), 1) if durations else None,
            currently_in_stage=current_stages.get(status, 0),
        ))

    return result


@router.get("/app-timeline/{app_id}", response_model=schemas.AppTimeline)
def app_timeline(
    app_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    """Full status timeline for a specific application."""
    from fastapi import HTTPException
    from sqlalchemy.orm import joinedload

    app = db.query(models.Application).options(
        joinedload(models.Application.student),
        joinedload(models.Application.assigned_to),
    ).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    logs = (
        db.query(models.ActivityLog)
        .options(joinedload(models.ActivityLog.changed_by_user))
        .filter(
            models.ActivityLog.application_id == app_id,
            models.ActivityLog.field_name == "application_status",
        )
        .order_by(models.ActivityLog.changed_at)
        .all()
    )

    now = datetime.utcnow()
    stages = []

    if logs:
        stages.append({
            "status": logs[0].old_value,
            "entered_at": app.created_at.isoformat(),
            "exited_at": logs[0].changed_at.isoformat(),
            "duration_days": round((logs[0].changed_at - app.created_at).total_seconds() / 86400, 1),
            "changed_by": None,
        })
        for i, log in enumerate(logs):
            exited = logs[i + 1].changed_at if i + 1 < len(logs) else now
            is_current = (i == len(logs) - 1)
            stages.append({
                "status": log.new_value,
                "entered_at": log.changed_at.isoformat(),
                "exited_at": exited.isoformat() if not is_current else None,
                "duration_days": round((exited - log.changed_at).total_seconds() / 86400, 1),
                "changed_by": log.changed_by_user.full_name if log.changed_by_user else None,
            })
    else:
        stages.append({
            "status": app.application_status,
            "entered_at": app.created_at.isoformat(),
            "exited_at": None,
            "duration_days": round((now - app.created_at).total_seconds() / 86400, 1),
            "changed_by": None,
        })

    student_name = (app.student.full_name if app.student else app.student_name) or "Unknown"
    total_days = round((now - app.created_at).total_seconds() / 86400, 1)

    return schemas.AppTimeline(
        application_id=app.id,
        student_name=student_name,
        current_status=app.application_status,
        created_at=app.created_at,
        total_days=total_days,
        assigned_to=app.assigned_to.full_name if app.assigned_to else None,
        stages=stages,
    )
