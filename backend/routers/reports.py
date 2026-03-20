"""
Performance reports for management — per-staff and stage-wise statistics.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from backend.database import get_db
from backend.auth import get_current_user
import backend.models as models
import backend.schemas as schemas

router = APIRouter(prefix="/reports", tags=["reports"])


def require_manager(current_user: models.User = Depends(get_current_user)):
    from fastapi import HTTPException
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Manager role required")
    return current_user


@router.get("/performance", response_model=List[schemas.StaffPerformance])
def performance_report(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    users = db.query(models.User).filter(models.User.is_active == True).all()
    result = []
    for user in users:
        q = db.query(models.Application).filter(
            models.Application.assigned_to_id == user.id
        )
        if department:
            q = q.filter(models.Application.department == department)

        apps = q.all()

        gs_count = sum(1 for a in apps if a.department == "gs")
        offer_count = sum(1 for a in apps if a.department == "offer")

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
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    """
    For each staff member, compute average handling time on GS applications
    using ActivityLog data (status change timestamps).
    """
    now = datetime.utcnow()

    # Final statuses for GS (apps considered 'completed')
    FINAL_STATUSES = {"Visa Granted", "Visa Refused", "GS Rejected", "GS approved", "Refund Requested"}

    users = db.query(models.User).filter(models.User.is_active == True).all()
    result = []

    for user in users:
        gs_apps = db.query(models.Application).filter(
            models.Application.assigned_to_id == user.id,
            models.Application.department == "gs",
        ).all()

        if not gs_apps:
            result.append(schemas.StaffTimingReport(
                user_id=user.id, full_name=user.full_name, role=user.role,
                total_gs=0, pending_gs=0, completed_gs=0,
                avg_handling_days=None, avg_completion_days=None,
                avg_first_action_days=None, avg_stage_days=None,
            ))
            continue

        app_ids = [a.id for a in gs_apps]

        # Get all status-change logs for these apps, ordered by time
        status_logs = (
            db.query(models.ActivityLog)
            .filter(
                models.ActivityLog.application_id.in_(app_ids),
                models.ActivityLog.field_name == "application_status",
            )
            .order_by(models.ActivityLog.application_id, models.ActivityLog.changed_at)
            .all()
        )

        # Group logs by application
        logs_by_app: dict = {}
        for log in status_logs:
            logs_by_app.setdefault(log.application_id, []).append(log)

        # Build app map
        app_map = {a.id: a for a in gs_apps}

        handling_days_list = []
        completion_days_list = []
        first_action_days_list = []
        stage_days: dict = {}   # stage -> [days]

        pending_count = 0
        completed_count = 0

        for app in gs_apps:
            is_completed = app.application_status in FINAL_STATUSES
            if is_completed:
                completed_count += 1
            else:
                pending_count += 1

            # Handling days: assigned_date to now (pending) or last log change (completed)
            if app.assigned_date:
                ref = app.assigned_date
                app_id_logs = logs_by_app.get(app.id)
                if is_completed and app_id_logs:
                    last_log = app_id_logs[-1]
                    days = (last_log.changed_at - datetime.combine(ref, datetime.min.time())).total_seconds() / 86400
                else:
                    days = (now - datetime.combine(ref, datetime.min.time())).total_seconds() / 86400
                handling_days_list.append(max(0, days))

            # Completion days: created_at to last log change
            app_id_logs = logs_by_app.get(app.id)
            if is_completed and app_id_logs:
                last_log = app_id_logs[-1]
                comp_days = (last_log.changed_at - app.created_at).total_seconds() / 86400
                completion_days_list.append(max(0, comp_days))

            # First action days: created_at to first status change log
            if app_id_logs:
                first_log = app_id_logs[0]
                fa_days = (first_log.changed_at - app.created_at).total_seconds() / 86400
                first_action_days_list.append(max(0, fa_days))

            # Stage durations from consecutive status changes
            logs = logs_by_app.get(app.id, [])
            if logs:
                # Time before first status change = time in initial status (created status → first change)
                init_status = logs[0].old_value
                if init_status:
                    init_days = (logs[0].changed_at - app.created_at).total_seconds() / 86400
                    stage_days.setdefault(init_status, []).append(max(0, init_days))

                # Time between consecutive changes
                for i in range(len(logs) - 1):
                    from_status = logs[i].new_value
                    if from_status:
                        days_in = (logs[i + 1].changed_at - logs[i].changed_at).total_seconds() / 86400
                        stage_days.setdefault(from_status, []).append(max(0, days_in))

                # Time in current status (from last change to now)
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
            total_gs=len(gs_apps),
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
    db: Session = Depends(get_db),
    _: models.User = Depends(require_manager),
):
    """
    Stage-wise time analysis: for each status/stage, compute average, min, max time
    applications spend in that stage, using ActivityLog status change events.
    """
    now = datetime.utcnow()

    # Get all GS applications
    gs_apps = db.query(models.Application).filter(
        models.Application.department == department
    ).all()

    if not gs_apps:
        return []

    app_ids = [a.id for a in gs_apps]
    app_map = {a.id: a for a in gs_apps}

    # Get all status change logs for GS apps
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

    # Accumulate duration for each stage
    stage_durations: dict = {}  # stage_name -> [days_spent]
    current_stages: dict = {}   # stage_name -> count currently in that stage

    for app in gs_apps:
        logs = logs_by_app.get(app.id, [])

        # Track current stage count
        current_stage = app.application_status
        current_stages[current_stage] = current_stages.get(current_stage, 0) + 1

        if logs:
            # Initial status duration (created_at → first change)
            init_status = logs[0].old_value
            if init_status:
                init_days = (logs[0].changed_at - app.created_at).total_seconds() / 86400
                stage_durations.setdefault(init_status, []).append(max(0, init_days))

            # Intermediate durations
            for i in range(len(logs) - 1):
                from_status = logs[i].new_value
                if from_status:
                    days_in = (logs[i + 1].changed_at - logs[i].changed_at).total_seconds() / 86400
                    stage_durations.setdefault(from_status, []).append(max(0, days_in))

            # Current stage duration (from last change to now)
            current = logs[-1].new_value
            if current:
                days_in = (now - logs[-1].changed_at).total_seconds() / 86400
                stage_durations.setdefault(current, []).append(max(0, days_in))
        else:
            # App has never had a status change — has been in initial status since creation
            days = (now - app.created_at).total_seconds() / 86400
            stage_durations.setdefault(app.application_status, []).append(max(0, days))

    # Get all known statuses for this dept
    known_statuses = [
        s.name for s in db.query(models.AppStatus).filter(
            models.AppStatus.department == department,
            models.AppStatus.is_active == True,
        ).order_by(models.AppStatus.sort_order).all()
    ]

    # Include any statuses from data not in known list
    all_statuses = list(dict.fromkeys(known_statuses + list(stage_durations.keys()) + list(current_stages.keys())))

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
        # First stage: from creation to first log
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
        # No changes — entire life in initial status
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
