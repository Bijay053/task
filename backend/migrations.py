"""
Startup migrations: safely add new columns to existing tables.
Each ALTER TABLE is wrapped in a try/except so it's a no-op if the column exists.
"""
from backend.database import engine


def run_migrations():
    new_columns = [
        # department identifier
        ("department",          "VARCHAR(20) NOT NULL DEFAULT 'gs'"),
        # GS-specific
        ("submitted_date",      "DATE"),
        ("verification",        "VARCHAR(255)"),
        # Offer-specific
        ("channel",             "VARCHAR(100)"),
        ("offer_applied_date",  "DATE"),
        ("offer_received_date", "DATE"),
    ]

    with engine.connect() as conn:
        for col_name, col_def in new_columns:
            try:
                conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE task_applications ADD COLUMN {col_name} {col_def}"
                    )
                )
                conn.commit()
                print(f"[migration] Added column: {col_name}")
            except Exception:
                # Column already exists — skip silently
                conn.rollback()
