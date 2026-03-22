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
            ("student_name",        "VARCHAR(255)"),
            ("university_name",     "VARCHAR(255)"),
            ("agent_id",            "INTEGER REFERENCES task_agents(id)"),
        ]:
            _add_column(conn, "task_applications", col_name, col_def)

        # task_users — availability_status
        _add_column(conn, "task_users", "availability_status", "VARCHAR(50) DEFAULT 'available' NOT NULL")

        # Make student_id nullable (PostgreSQL)
        try:
            conn.execute(sa.text(
                "ALTER TABLE task_applications ALTER COLUMN student_id DROP NOT NULL"
            ))
            conn.commit()
            print("[migration] student_id is now nullable")
        except Exception:
            conn.rollback()

        # task_agents
        try:
            conn.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS task_agents (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    company_name VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(100),
                    country VARCHAR(100),
                    notes TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.commit()
        except Exception:
            conn.rollback()

        # task_manager_agent_mappings
        try:
            conn.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS task_manager_agent_mappings (
                    id SERIAL PRIMARY KEY,
                    manager_id INTEGER REFERENCES task_users(id),
                    agent_id INTEGER REFERENCES task_agents(id),
                    created_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT uq_manager_agent UNIQUE (manager_id, agent_id)
                )
            """))
            conn.commit()
        except Exception:
            conn.rollback()

        # task_dept_settings
        try:
            conn.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS task_dept_settings (
                    id SERIAL PRIMARY KEY,
                    department VARCHAR(20) NOT NULL,
                    key VARCHAR(100) NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT uq_dept_setting UNIQUE (department, key)
                )
            """))
            conn.commit()
        except Exception:
            conn.rollback()

        # task_app_statuses
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

        # can_upload permission column
        _add_column(conn, "task_user_dept_permissions", "can_upload", "BOOLEAN DEFAULT FALSE")

        # Security columns for account lockout and token invalidation
        _add_column(conn, "task_users", "token_version",          "INTEGER NOT NULL DEFAULT 0")
        _add_column(conn, "task_users", "failed_login_attempts",  "INTEGER NOT NULL DEFAULT 0")
        _add_column(conn, "task_users", "locked_until",           "TIMESTAMP")

        # Manager FK on task_users (MY TEAM feature)
        _add_column(conn, "task_users", "manager_id",
                    "INTEGER REFERENCES task_users(id) ON DELETE SET NULL")

        # Permission columns on task_role_permissions
        _add_column(conn, "task_role_permissions", "can_view_all_users",    "BOOLEAN DEFAULT FALSE")
        _add_column(conn, "task_role_permissions", "can_view_mapped_users", "BOOLEAN DEFAULT FALSE")

        # User agent column for audit logs
        _add_column(conn, "task_system_audit_logs", "user_agent", "TEXT")

        # Work schedule columns on task_users
        _add_column(conn, "task_users", "work_days",       "VARCHAR(100)")
        _add_column(conn, "task_users", "work_start_time", "VARCHAR(10)")
        _add_column(conn, "task_users", "work_end_time",   "VARCHAR(10)")
