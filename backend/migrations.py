"""
Startup migrations: safely add new columns to existing tables.
Each ALTER TABLE is wrapped in a try/except so it's a no-op if the column exists.
"""
from backend.database import engine
import sqlalchemy as sa


def _add_column(conn, table: str, col_name: str, col_def: str):
    try:
        conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
        conn.commit()
        print(f"[migration] Added {table}.{col_name}")
    except Exception:
        conn.rollback()


def run_migrations():
    with engine.connect() as conn:
        # task_applications — existing columns
        for col_name, col_def in [
            ("department",          "VARCHAR(20) NOT NULL DEFAULT 'gs'"),
            ("submitted_date",      "DATE"),
            ("verification",        "VARCHAR(255)"),
            ("channel",             "VARCHAR(100)"),
            ("offer_applied_date",  "DATE"),
            ("offer_received_date", "DATE"),
            # New: allow nullable student_id and raw name fields
            ("student_name",        "VARCHAR(255)"),
            ("university_name",     "VARCHAR(255)"),
        ]:
            _add_column(conn, "task_applications", col_name, col_def)

        # Make student_id nullable (PostgreSQL)
        try:
            conn.execute(sa.text(
                "ALTER TABLE task_applications ALTER COLUMN student_id DROP NOT NULL"
            ))
            conn.commit()
            print("[migration] student_id is now nullable")
        except Exception:
            conn.rollback()

        # task_app_statuses — created via SQLAlchemy metadata but ensure it exists
        try:
            conn.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS task_app_statuses (
                    id SERIAL PRIMARY KEY,
                    department VARCHAR(20) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    text_color VARCHAR(20) DEFAULT '#000000',
                    bg_color VARCHAR(20) DEFAULT '#f1f5f9',
                    sort_order INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT uq_dept_status_name UNIQUE (department, name)
                )
            """))
            conn.commit()
        except Exception:
            conn.rollback()

        # task_user_dept_permissions
        try:
            conn.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS task_user_dept_permissions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES task_users(id),
                    department VARCHAR(20) NOT NULL,
                    can_view BOOLEAN DEFAULT TRUE,
                    can_edit BOOLEAN DEFAULT FALSE,
                    can_delete BOOLEAN DEFAULT FALSE,
                    CONSTRAINT uq_user_dept_perm UNIQUE (user_id, department)
                )
            """))
            conn.commit()
        except Exception:
            conn.rollback()
