# Task Management Portal

## Overview

A full-stack task management portal for study abroad consultancies, built to replace Google Sheets-based workflows. Manages student visa/university applications with role-based access, status tracking, and dashboard analytics.

## Stack

- **Monorepo tool**: pnpm workspaces (Node.js frontend)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Python FastAPI (separate from Node.js monorepo)
- **Database**: PostgreSQL + SQLAlchemy ORM
- **Auth**: JWT (python-jose + passlib), isolated from any other portals
- **API codegen**: Orval (from OpenAPI spec → React Query hooks)
- **Charts**: Recharts

## Structure

```text
/
├── backend/                    # Python FastAPI backend
│   ├── main.py                 # FastAPI app entry (mounts all routers at /api)
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models.py               # SQLAlchemy ORM models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── auth.py                 # JWT creation/verification, password hashing
│   ├── seed.py                 # Seeds initial admin/agent users + sample data
│   └── routers/
│       ├── auth.py             # POST /api/auth/login, /logout, GET /me
│       ├── users.py            # GET/POST /api/users, PUT /api/users/:id, PUT /api/users/:id/availability
│       ├── agents.py           # CRUD external agents + manager-agent mappings
│       ├── dept_settings.py    # Per-department key-value settings (webhook URLs)
│       ├── students.py         # CRUD /api/students
│       ├── universities.py     # CRUD /api/universities
│       ├── applications.py     # Full CRUD + /my + /status + /assign + /logs; agent-only filter
│       ├── dashboard.py        # /summary, /status-count, /assignee-count, /university-count
│       ├── notifications.py    # /test-email, /test-chat
│       ├── statuses.py         # Dynamic status CRUD + /reorder (admin/manager only)
│       ├── reports.py          # GET /performance — per-staff workload report
│       ├── permissions.py      # GET/PUT /user/{id}/{dept} — dept-level access flags
│       └── bulk_upload.py      # POST /{department} — bulk xlsx import (openpyxl)
├── artifacts/
│   ├── api-server/             # Routes /api/* to Python backend (port 8080)
│   └── task-management-portal/ # React + Vite frontend (port 23380, preview at /)
│       └── src/
│           ├── App.tsx         # Router + setAuthTokenGetter setup
│           ├── hooks/use-auth.tsx
│           ├── pages/          # login, dashboard, applications, offer-applications,
│           │                   # my-tasks, approved, students, universities,
│           │                   # users, settings, reports
│           ├── components/bulk-upload-button.tsx  # Shared Excel upload + result modal
│           └── components/
├── lib/
│   ├── api-spec/openapi.yaml   # Full OpenAPI 3.1 spec for all routes
│   ├── api-client-react/       # Generated React Query hooks
│   └── api-zod/                # Generated Zod schemas
└── requirements.txt            # Python dependencies
```

## Demo Credentials

- **Admin**: `admin@taskportal.com` / `admin123`
- **Agent**: `agent1@taskportal.com` / `agent123`
- **Agent**: `agent2@taskportal.com` / `agent123`

## Key Business Rules

1. **Assigned date preserved**: When task is first assigned, `assigned_date` is set. Only updates on reassignment to a different user.
2. **Dynamic statuses**: Statuses are stored in `task_app_statuses` table (not hardcoded). Admins manage them via Settings → GS/Offer Statuses tab. Each status has bg_color and text_color for badge rendering.
3. **Role-based access**: `admin`/`manager` see all apps, Users, Settings, Reports. `team_leader` can assign apps. `agent` only sees own apps.
4. **Agent vs Assignee separation**: `agent_id` (FK to `task_agents`) = external sub-agent/partner. `assigned_to_id` (FK to `task_users`) = internal staff member. These are separate fields on every application.
5. **Manager-agent access control**: Managers can be mapped to specific external agents (`task_manager_agent_mappings`). If mapped, they only see applications whose `agent_id` is in their assigned agents. No mappings = see all.
6. **Staff availability**: `task_users.availability_status` column ('available'/'on_leave'/'off_duty'). Team leaders and above can toggle it from the Users page Availability column dropdown.
7. **Department-specific webhooks**: `task_dept_settings` table (department, key='google_chat_webhook', value=URL). Configured in Settings → Dept Webhooks. Overrides the global `GOOGLE_CHAT_WEBHOOK` env var for that dept. Managed by `notifications.py::get_webhook_for_dept()`.
8. **Optional student/university**: `student_id` is nullable on Application. `student_name` and `university_name` raw fields are used as fallback when no directory record is linked.
9. **Department permissions**: `task_user_dept_permissions` table controls per-user, per-department can_view/can_edit/can_delete flags. Managed in Users → Department Permissions.
10. **Bulk upload**: POST /api/bulk-upload/{gs|offer} accepts .xlsx; columns matched by partial name. Auto-creates students if not found in directory; stores raw names on applications.
11. **Isolated auth**: Separate `task_users` table, separate JWT secret.

## Roles

- `admin` — Full access to all features
- `manager` — Same as admin (no destructive ops)
- `team_leader` — Can assign applications, limited settings access
- `agent` — Only sees own applications (My Tasks filtered)

## Running the Project

- **Python backend**: `uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload --app-dir /home/runner/workspace`
- **Frontend**: `pnpm --filter @workspace/task-management-portal run dev`
- **Codegen** (after OpenAPI spec changes): `pnpm --filter @workspace/api-spec run codegen`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — JWT signing secret
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Optional email notifications
- `GOOGLE_CHAT_WEBHOOK` — Optional Google Chat webhook URL
