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
# GS pipeline: In Review → GS submitted → … → CoE → Visa

GS_COMPLETED_STATUSES = {
    "GS approved", "GS Rejected",
    "CoE Approved", "Visa Granted", "Visa Refused",
    "Withdrawn",
}
GS_ACTIVE_STATUSES = {
    "In Review", "GS submitted", "GS onhold",
    "GS document pending", "GS additional document request",
    "Refund Requested",
    "CoE Requested", "Visa Lodged",
}
GS_ALL_STATUSES = GS_ACTIVE_STATUSES | GS_COMPLETED_STATUSES

# Weighted workload tiers: GS-core stage = heavy (×3), CoE/Visa = medium (×2), Offer = light (×1)
GS_WEIGHT3_STATUSES = {
    "In Review", "GS submitted", "GS onhold",
    "GS document pending", "GS additional document request",
    "Refund Requested",
}
GS_WEIGHT2_STATUSES = {"CoE Requested", "Visa Lodged"}

# Offer pipeline
OFFER_COMPLETED_STATUSES = {"Offer Received", "Offer Rejected", "Not Eligible"}
OFFER_ACTIVE_STATUSES    = {"Document Requested", "On Hold", "Offer Request", "Enquiries"}
OFFER_ALL_STATUSES       = OFFER_ACTIVE_STATUSES | OFFER_COMPLETED_STATUSES


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

        # gs_count: ALL GS statuses (active + completed)
        gs_count = sum(
            1 for a in apps
            if a.department == "gs" and a.application_status in GS_ALL_STATUSES
        )
        # offer_count: ALL Offer statuses (active + completed)
        offer_count = sum(
            1 for a in apps
            if a.department == "offer" and a.application_status in OFFER_ALL_STATUSES
        )

        # active_count: only ACTIVE (non-completed) statuses — used for real workload
        active_count = sum(
            1 for a in apps
            if (a.department == "gs" and a.application_status in GS_ACTIVE_STATUSES)
            or (a.department == "offer" and a.application_status in OFFER_ACTIVE_STATUSES)
        )
        # completed_count: final/completed statuses
        completed_count = sum(
            1 for a in apps
            if (a.department == "gs" and a.application_status in GS_COMPLETED_STATUSES)
            or (a.department == "offer" and a.application_status in OFFER_COMPLETED_STATUSES)
        )

        # weighted_workload: GS core (×3) + CoE/Visa (×2) + Offer active (×1)
        weighted_workload = sum(
            3 if a.application_status in GS_WEIGHT3_STATUSES else
            2 if a.application_status in GS_WEIGHT2_STATUSES else
            1  # Offer active
            for a in apps
            if (a.department == "gs" and a.application_status in GS_ACTIVE_STATUSES)
            or (a.department == "offer" and a.application_status in OFFER_ACTIVE_STATUSES)
        )

        breakdown: dict = {}
        for app in apps:
            breakdown[app.application_status] = breakdown.get(app.application_status, 0) + 1

        result.append(schemas.StaffPerformance(
            user_id=user.id,
            full_name=user.full_name,
            role=user.role,
            total_assigned=len(apps),
            active_count=active_count,
            completed_count=completed_count,
            gs_count=gs_count,
            offer_count=offer_count,
            status_breakdown=breakdown,
            weighted_workload=weighted_workload,
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
    Per-staff GS or Offer stage handling time.

    GS scope (GS stage ONLY — CoE/Visa statuses excluded):
      Total      = GS pending + GS completed
      Completed  = GS Approved + GS Rejected   (timer stops here)
      Pending    = In Review + GS submitted + GS onhold + GS document pending
                   + GS additional document request
      Avg Handling Time = AVG(decision_date - assigned_date) for completed ONLY
      Avg First Action  = AVG(first_status_change - assigned_date) for all

    Offer scope (same principle):
      Completed  = Offer Received + Offer Rejected + Not Eligible
      Pending    = the rest
    """
    now = datetime.utcnow()
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    dept = department if department in ("gs", "offer") else "gs"

    # ── Scope: GS timing only covers the GS stage itself ──────────────────────
    if dept == "gs":
        # Completed = decision made at GS stage — timer stops
        timing_completed = {"GS approved", "GS Rejected"}
        # Pending = still in GS stage (CoE/Visa statuses intentionally excluded)
        timing_pending = {
            "In Review", "GS submitted", "GS onhold",
            "GS document pending", "GS additional document request",
        }
        timing_all = timing_pending | timing_completed
    else:
        timing_completed = {"Offer Received", "Offer Rejected", "Not Eligible"}
        timing_pending = {"Enquiries", "Document Requested", "On Hold", "Offer Request"}
        timing_all = timing_pending | timing_completed

    users = db.query(models.User).filter(models.User.is_active == True).all()
    result = []

    for user in users:
        q = db.query(models.Application).filter(
            models.Application.assigned_to_id == user.id,
            models.Application.department == dept,
            models.Application.application_status.in_(list(timing_all)),
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

        # ── Metrics accumulators ───────────────────────────────────────────────
        # Avg Handling = ALL apps: completed → decision_date - assigned;
        #                          pending   → now - assigned
        handling_days_list = []
        # Avg Completion = ONLY completed apps: decision_date - assigned_date
        completion_days_list = []
        # Avg First Action = first status change - assigned_date (all apps with logs)
        first_action_days_list = []
        # SLA: cases where handling_days > SLA_TARGET_DAYS are "delayed"
        SLA_TARGET_DAYS = 2.0
        OUTLIER_MIN_DAYS = 5 / (60 * 24)   # 5 minutes — below this → data artifact
        OUTLIER_MAX_DAYS = 30.0              # 30 days   — above this → flag but keep
        sla_breach_count = 0

        stage_days: dict = {}
        pending_count = 0
        completed_count = 0

        def ref_datetime(app):
            """Return assigned date (or created_at) as a datetime."""
            if app.assigned_date:
                return datetime.combine(app.assigned_date, datetime.min.time())
            return app.created_at

        for app in apps:
            is_completed = app.application_status in timing_completed
            if is_completed:
                completed_count += 1
            else:
                pending_count += 1

            app_logs = logs_by_app.get(app.id, [])
            ref_dt = ref_datetime(app)

            # ── Avg Handling Time (ALL apps) ──────────────────────────────────
            # Completed: use actual decision timestamp
            # Pending:   use now (measures current workload pressure)
            if is_completed:
                decision_log = None
                for log in reversed(app_logs):
                    if log.new_value in timing_completed:
                        decision_log = log
                        break
                if decision_log:
                    h_days = (decision_log.changed_at - ref_dt).total_seconds() / 86400
                    h_days = max(0, h_days)
                    if h_days >= OUTLIER_MIN_DAYS:   # exclude sub-5-min artifacts
                        handling_days_list.append(h_days)
                        if h_days > SLA_TARGET_DAYS:
                            sla_breach_count += 1
                        # ── Avg Completion (only for confirmed completed) ─────
                        completion_days_list.append(h_days)
            else:
                # Pending: ongoing timer
                h_days = (now - ref_dt).total_seconds() / 86400
                h_days = max(0, h_days)
                if h_days >= OUTLIER_MIN_DAYS:
                    handling_days_list.append(h_days)
                    if h_days > SLA_TARGET_DAYS:
                        sla_breach_count += 1

            # ── Avg First Action (all apps that have at least one log) ────────
            if app_logs:
                first_log = app_logs[0]
                fa_days = (first_log.changed_at - ref_dt).total_seconds() / 86400
                fa_days = max(0, fa_days)
                if fa_days >= OUTLIER_MIN_DAYS:
                    first_action_days_list.append(fa_days)

            # ── Stage duration breakdown ───────────────────────────────────────
            logs = app_logs
            if logs:
                init_status = logs[0].old_value
                if init_status and init_status in timing_all:
                    init_days = (logs[0].changed_at - app.created_at).total_seconds() / 86400
                    stage_days.setdefault(init_status, []).append(max(0, init_days))

                for i in range(len(logs) - 1):
                    from_status = logs[i].new_value
                    if from_status and from_status in timing_all:
                        days_in = (logs[i + 1].changed_at - logs[i].changed_at).total_seconds() / 86400
                        stage_days.setdefault(from_status, []).append(max(0, days_in))

                current_status = logs[-1].new_value
                if current_status and current_status in timing_pending:
                    days_in = (now - logs[-1].changed_at).total_seconds() / 86400
                    stage_days.setdefault(current_status, []).append(max(0, days_in))
            else:
                if app.application_status in timing_pending:
                    days = (now - app.created_at).total_seconds() / 86400
                    stage_days.setdefault(app.application_status, []).append(max(0, days))

        def avg(lst): return round(sum(lst) / len(lst), 1) if lst else None

        avg_stage = {s: round(sum(d) / len(d), 1) for s, d in stage_days.items()} if stage_days else None

        result.append(schemas.StaffTimingReport(
            user_id=user.id,
            full_name=user.full_name,
            role=user.role,
            total_gs=len(apps),
            pending_gs=pending_count,
            completed_gs=completed_count,
            avg_handling_days=avg(handling_days_list),       # all cases (workload pressure)
            avg_completion_days=avg(completion_days_list),   # completed only (performance)
            avg_first_action_days=avg(first_action_days_list),
            avg_stage_days=avg_stage,
            sla_breach_count=sla_breach_count,
            sla_target_days=SLA_TARGET_DAYS,
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
    Stage-wise time analysis.

    KEY DISTINCTION:
      • ACTIVE STAGES  = process steps where apps can still be "currently here"
      • OUTCOME STATUSES = final results (app has left the active pipeline)

    GS active stages:   In Review, GS submitted, GS onhold,
                        GS document pending, GS additional document request
    GS outcomes:        GS approved, GS Rejected

    Offer active stages: Enquiries, Document Requested, On Hold, Offer Request
    Offer outcomes:      Offer Received, Offer Rejected, Not Eligible

    "Currently Here" count = only apps whose current status is an active stage.
    "Avg Time in Stage"    = exit_time - entry_time for apps that left the stage,
                             + (now - entry_time) for apps still in an active stage.
                             Outcomes only record the time spent before reaching them
                             (no ongoing timer after decision).
    Bottleneck             = highest avg_days among ACTIVE stages only.
    """
    now = datetime.utcnow()
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    dept = department if department in ("gs", "offer") else "gs"

    # ── Stage/outcome split ────────────────────────────────────────────────────
    if dept == "gs":
        active_stages = {
            "In Review", "GS submitted", "GS onhold",
            "GS document pending", "GS additional document request",
        }
        outcome_statuses = {"GS approved", "GS Rejected"}
    else:
        active_stages = {"Enquiries", "Document Requested", "On Hold", "Offer Request"}
        outcome_statuses = {"Offer Received", "Offer Rejected", "Not Eligible"}

    all_relevant = active_stages | outcome_statuses

    # ── Query ALL department apps (so we capture full traversal history) ───────
    q = db.query(models.Application).filter(
        models.Application.department == dept,
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

    # stage_durations[status] = list of days spent in that status
    stage_durations: dict = {}
    # transitions[status] = count of apps that passed through (or are in) that status
    transitions: dict = {}
    # currently_here[status] = count of apps currently in that active stage
    currently_here: dict = {}

    for app in apps:
        logs = logs_by_app.get(app.id, [])
        current_status = app.application_status

        # Count "currently here" only for active stages
        if current_status in active_stages:
            currently_here[current_status] = currently_here.get(current_status, 0) + 1

        if logs:
            # ── Stage 0: initial status before first logged change ─────────────
            init_status = logs[0].old_value
            if init_status and init_status in all_relevant:
                duration = (logs[0].changed_at - app.created_at).total_seconds() / 86400
                stage_durations.setdefault(init_status, []).append(max(0, duration))
                transitions[init_status] = transitions.get(init_status, 0) + 1

            # ── Middle stages: exited stages (clean exit → entry time known) ───
            for i in range(len(logs) - 1):
                from_status = logs[i].new_value
                if from_status and from_status in all_relevant:
                    duration = (logs[i + 1].changed_at - logs[i].changed_at).total_seconds() / 86400
                    stage_durations.setdefault(from_status, []).append(max(0, duration))
                    transitions[from_status] = transitions.get(from_status, 0) + 1

            # ── Current (last) stage ───────────────────────────────────────────
            current_log_status = logs[-1].new_value
            if current_log_status and current_log_status in all_relevant:
                if current_log_status in active_stages:
                    # Still active: timer is ongoing → use now
                    duration = (now - logs[-1].changed_at).total_seconds() / 86400
                    stage_durations.setdefault(current_log_status, []).append(max(0, duration))
                else:
                    # Outcome reached: timer stopped when this status was set
                    # The last logs[i+1] loop above already recorded the time;
                    # but the very last log (the outcome) has no exit event.
                    # Record it as 0 (instantaneous outcome — no "time in outcome")
                    pass
                transitions[current_log_status] = transitions.get(current_log_status, 0) + 1
        else:
            # No logs yet — app is sitting in its initial status
            if current_status in active_stages:
                duration = (now - app.created_at).total_seconds() / 86400
                stage_durations.setdefault(current_status, []).append(max(0, duration))
                transitions[current_status] = transitions.get(current_status, 0) + 1

    # ── Build ordered list: active stages first, then outcomes ─────────────────
    ordered_stages = list(active_stages) + list(outcome_statuses)

    result = []
    for status in ordered_stages:
        durations = stage_durations.get(status, [])
        is_active = status in active_stages
        result.append(schemas.StageReport(
            status=status,
            department=dept,
            is_active_stage=is_active,
            total_transitions=transitions.get(status, 0),
            avg_days=round(sum(durations) / len(durations), 1) if durations else None,
            min_days=round(min(durations), 1) if durations else None,
            max_days=round(max(durations), 1) if durations else None,
            currently_in_stage=currently_here.get(status, 0),
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
