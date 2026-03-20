"""Seed essential production data: statuses, roles, and primary admin user only."""
from backend.database import SessionLocal
from backend.auth import get_password_hash
import backend.models as models


def seed_statuses(db):
    """Seed default statuses if none exist."""
    for department, defaults in [("gs", models.GS_STATUS_DEFAULTS), ("offer", models.OFFER_STATUS_DEFAULTS)]:
        count = db.query(models.AppStatus).filter(models.AppStatus.department == department).count()
        if count == 0:
            for name, text_color, bg_color, sort_order in defaults:
                db.add(models.AppStatus(
                    department=department,
                    name=name,
                    text_color=text_color,
                    bg_color=bg_color,
                    sort_order=sort_order,
                ))
            db.commit()
            print(f"[seed] Seeded {len(defaults)} {department.upper()} statuses")


def seed_roles(db):
    """Seed default roles if none exist."""
    if db.query(models.Role).count() == 0:
        default_roles = ["admin", "manager", "team_leader", "agent"]
        for name in default_roles:
            db.add(models.Role(name=name))
        db.commit()
        print(f"[seed] Seeded {len(default_roles)} default roles")


def seed_admin_user(db):
    """Ensure the primary admin user always exists."""
    existing = db.query(models.User).filter(models.User.email == "au@studyinfocentre.com").first()
    if not existing:
        db.add(models.User(
            email="au@studyinfocentre.com",
            full_name="Admin User",
            hashed_password=get_password_hash("Bijay@y123"),
            role="admin",
            is_active=True,
        ))
        db.commit()
        print("[seed] Created admin user: au@studyinfocentre.com")


def seed():
    db = SessionLocal()
    try:
        seed_statuses(db)
        seed_roles(db)
        seed_admin_user(db)
        print("[seed] Essential seed complete.")
    except Exception as e:
        db.rollback()
        print(f"[seed] Seed failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
