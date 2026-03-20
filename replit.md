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
│       ├── users.py            # GET/POST /api/users, PUT /api/users/:id
│       ├── students.py         # CRUD /api/students
│       ├── universities.py     # CRUD /api/universities
│       ├── applications.py     # Full CRUD + /my + /status + /assign + /logs
│       ├── dashboard.py        # /summary, /status-count, /assignee-count, /university-count
│       └── notifications.py    # /test-email, /test-chat
├── artifacts/
│   ├── api-server/             # Routes /api/* to Python backend (port 8080)
│   └── task-management-portal/ # React + Vite frontend (port 23380, preview at /)
│       └── src/
│           ├── App.tsx         # Router + setAuthTokenGetter setup
│           ├── hooks/use-auth.tsx
│           ├── pages/          # login, dashboard, applications, my-tasks, approved,
│           │                   # students, universities, users, settings
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
2. **Status normalization**: "gs on hold" → "GS onhold", "coe approved" → "CoE Approved" etc. handled in backend.
3. **Role-based access**: `admin`/`manager` see all applications and Users page. `agent` primarily uses My Tasks.
4. **Isolated auth**: Separate `task_users` table, separate JWT secret. Session cookies do NOT cross to other portals.

## Application Statuses & Colors

| Status | Color |
|--------|-------|
| GS Rejected | #F8D7DA |
| GS approved | #D1E7DD |
| GS document pending | #FFF3CD |
| GS onhold | #E2E3E5 |
| GS submitted | #CFE2FF |
| GS additional document request | #FAD7F0 |
| In Review | #E7D9FF |
| Refund Requested | #FCE5CD |
| Visa Refused | #F4CCCC |
| Visa Granted | #D9EAD3 |
| Visa Lodged | #D0E0E3 |
| CoE Requested | #FFF2CC |
| CoE Approved | #D9D2E9 |

## Running the Project

- **Python backend**: `uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload --app-dir /home/runner/workspace`
- **Frontend**: `pnpm --filter @workspace/task-management-portal run dev`
- **Codegen** (after OpenAPI spec changes): `pnpm --filter @workspace/api-spec run codegen`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — JWT signing secret
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Optional email notifications
- `GOOGLE_CHAT_WEBHOOK` — Optional Google Chat webhook URL
