# Admin login (admin / admin) — local setup

Local development uses **SQLite** (no PostgreSQL needed). The admin user is already created.

## Log in

1. **Backend** must be running: from project root run `npm run backend` (or from `backend`: `npm run start:dev`).
2. **Web** must be running: from project root run `npm run web`.
3. Open **http://localhost:5173/login** and sign in with:
   - **Nickname:** `admin`
   - **Password:** `admin`

## What was set up

- **backend/.env** — `DATABASE_URL="file:./dev.db"`, `NODE_ENV=development`, JWT and CORS for local.
- **backend/prisma/schema.prisma** — uses SQLite locally (production/Render still uses `schema.postgres.prisma`).
- **backend/prisma/dev.db** — SQLite database (created by `prisma db push`).
- **Admin user** — created via `POST /auth/bootstrap` (admin / admin).

## If you need to reset

- Delete `backend/prisma/dev.db`, then run from `backend`: `npx prisma db push`.
- Create admin again: `POST http://localhost:3000/auth/bootstrap` with body `{"nickname":"admin","password":"admin"}` (or log in with admin/admin once; in dev with 0 users the first admin login creates the user).

## Production (Render)

Render copies `schema.postgres.prisma` over `schema.prisma` before build and uses PostgreSQL. This file and SQLite are for local only.
