"""Seed initial data: admin user + sample data for both departments"""
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
        # Always seed statuses and roles (idempotent)
        seed_statuses(db)
        seed_roles(db)
        # Always ensure primary admin exists
        seed_admin_user(db)

        if db.query(models.User).count() > 1:
            print("Database already seeded, skipping.")
            return

        admin = models.User(
            email="admin@taskportal.com",
            full_name="Admin User",
            hashed_password=get_password_hash("admin123"),
            role="admin",
        )
        agent1 = models.User(
            email="agent1@taskportal.com",
            full_name="Sarah Johnson",
            hashed_password=get_password_hash("agent123"),
            role="agent",
        )
        agent2 = models.User(
            email="agent2@taskportal.com",
            full_name="Michael Chen",
            hashed_password=get_password_hash("agent123"),
            role="agent",
        )
        db.add_all([admin, agent1, agent2])
        db.flush()

        uni1 = models.University(name="University of Melbourne", country="Australia")
        uni2 = models.University(name="University of Sydney", country="Australia")
        uni3 = models.University(name="University of Toronto", country="Canada")
        uni4 = models.University(name="University of Auckland", country="New Zealand")
        db.add_all([uni1, uni2, uni3, uni4])
        db.flush()

        s1 = models.Student(full_name="Ahmed Al-Rashid", email="ahmed@example.com", phone="+971501234567", passport_no="A1234567")
        s2 = models.Student(full_name="Priya Sharma", email="priya@example.com", phone="+919876543210", passport_no="P9876543")
        s3 = models.Student(full_name="Liu Wei", email="liu@example.com", phone="+8613912345678", passport_no="G1234567")
        s4 = models.Student(full_name="Maria Santos", email="maria@example.com", phone="+551198765432", passport_no="AB123456")
        s5 = models.Student(full_name="John Smith", email="john@example.com", phone="+447911123456", passport_no="GB123456")
        db.add_all([s1, s2, s3, s4, s5])
        db.flush()

        from datetime import date
        gs_apps = [
            models.Application(
                department="gs",
                student_id=s1.id, university_id=uni1.id,
                assigned_to_id=agent1.id, assigned_date=date.today(),
                application_status="GS submitted",
                intake="Feb 2025", course="Master of Engineering",
                country="Australia", priority="high",
                submitted_date=date(2025, 1, 15), verification="Pending",
                created_by_id=admin.id,
            ),
            models.Application(
                department="gs",
                student_id=s2.id, university_id=uni2.id,
                assigned_to_id=agent1.id, assigned_date=date.today(),
                application_status="GS approved",
                intake="Jul 2025", course="Bachelor of Commerce",
                country="Australia", priority="normal",
                submitted_date=date(2025, 1, 20), verification="Verified",
                created_by_id=admin.id,
            ),
            models.Application(
                department="gs",
                student_id=s3.id, university_id=uni3.id,
                assigned_to_id=agent2.id, assigned_date=date.today(),
                application_status="In Review",
                intake="Sep 2025", course="PhD Computer Science",
                country="Canada", priority="normal",
                created_by_id=admin.id,
            ),
            models.Application(
                department="gs",
                student_id=s4.id, university_id=uni4.id,
                assigned_to_id=agent2.id, assigned_date=date.today(),
                application_status="Visa Granted",
                intake="Feb 2025", course="Master of Business",
                country="New Zealand", priority="high",
                submitted_date=date(2025, 1, 5), verification="Verified",
                created_by_id=admin.id,
            ),
            models.Application(
                department="gs",
                student_id=s5.id, university_id=uni1.id,
                assigned_to_id=agent1.id, assigned_date=date.today(),
                application_status="CoE Approved",
                intake="Jul 2025", course="Bachelor of Science",
                country="Australia", priority="normal",
                submitted_date=date(2025, 1, 10), verification="Verified",
                created_by_id=admin.id,
            ),
            models.Application(
                department="gs",
                student_id=s1.id, university_id=uni3.id,
                assigned_to_id=agent2.id, assigned_date=date.today(),
                application_status="GS document pending",
                intake="Sep 2025", course="Master of Data Science",
                country="Canada", priority="low",
                created_by_id=admin.id,
            ),
            models.Application(
                department="gs",
                student_id=s2.id, university_id=uni4.id,
                application_status="GS Rejected",
                intake="Feb 2025", course="Bachelor of Law",
                country="New Zealand", priority="normal",
                created_by_id=admin.id,
            ),
        ]
        db.add_all(gs_apps)

        offer_apps = [
            models.Application(
                department="offer",
                student_id=s1.id, university_id=uni1.id,
                assigned_to_id=agent1.id, assigned_date=date.today(),
                application_status="Offer Request",
                intake="Feb 2025", course="Master of Engineering",
                country="Australia", channel="Direct",
                offer_applied_date=date(2025, 1, 12),
                remarks="Awaiting offer letter from university",
                created_by_id=admin.id,
            ),
            models.Application(
                department="offer",
                student_id=s3.id, university_id=uni2.id,
                assigned_to_id=agent2.id, assigned_date=date.today(),
                application_status="Offer Received",
                intake="Jul 2025", course="Bachelor of Science",
                country="Australia", channel="Expert",
                offer_applied_date=date(2025, 1, 8),
                offer_received_date=date(2025, 1, 25),
                remarks="Offer received, student reviewing",
                created_by_id=admin.id,
            ),
            models.Application(
                department="offer",
                student_id=s4.id, university_id=uni3.id,
                assigned_to_id=agent1.id, assigned_date=date.today(),
                application_status="Document Requested",
                intake="Sep 2025", course="Master of Business",
                country="Canada", channel="KC overseas",
                offer_applied_date=date(2025, 1, 20),
                remarks="University requested additional transcripts",
                created_by_id=admin.id,
            ),
            models.Application(
                department="offer",
                student_id=s5.id, university_id=uni4.id,
                application_status="On Hold",
                intake="Feb 2026", course="PhD in Economics",
                country="New Zealand", channel="SIUK",
                offer_applied_date=date(2025, 2, 1),
                remarks="Student needs to submit IELTS",
                created_by_id=admin.id,
            ),
            models.Application(
                department="offer",
                student_id=s2.id, university_id=uni1.id,
                assigned_to_id=agent2.id, assigned_date=date.today(),
                application_status="Offer Rejected",
                intake="Jul 2025", course="Bachelor of Commerce",
                country="Australia", channel="Direct",
                offer_applied_date=date(2025, 1, 5),
                offer_received_date=date(2025, 1, 18),
                remarks="Student GPA below requirement",
                created_by_id=admin.id,
            ),
        ]
        db.add_all(offer_apps)
        db.commit()
        print("Database seeded successfully!")
        print("Admin login:  admin@taskportal.com / admin123")
        print("Agent login:  agent1@taskportal.com / agent123")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
