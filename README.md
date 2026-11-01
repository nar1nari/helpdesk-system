# Helpdesk

A service for submitting and processing client requests.

| Part | Stack |
| --- | --- |
| `backend/` | Node.js 22, Express 5, PostgreSQL (`pg`), Zod, JWT, Jest + Supertest |
| `frontend/` | React 19, Vite, Tailwind CSS + daisyUI |

## How it works

### Request lifecycle

Statuses: `new`, `in_progress`, `pending`, `resolved`, `closed`, `rejected`. Allowed transitions and who may perform them live in `backend/src/policies/transitions.js`:

| From | To (who may do it) |
| --- | --- |
| `new` | `in_progress`, `rejected` (operator, admin) |
| `in_progress` | `pending`, `resolved`, `rejected` (operator, admin) |
| `pending` | `in_progress` (applicant, operator, admin); `rejected` (operator, admin) |
| `resolved` | `closed` (applicant, admin); `in_progress`, i.e. reopened (applicant, operator, admin) |

An operator may only act on requests assigned to them; an applicant only on their own.

`closed` and `rejected` are final and block new comments.

### Visibility and permissions

- Applicants see only their own requests; operators see unassigned requests and those assigned to them; admins see everything. Anything a user may not see answers `404`.
- **Deleting is hiding**: requests, comments and files are soft-deleted (`deleted_at` / `deleted_by`), never removed from the database or disk. Only the author (the applicant for a request, the commenter, the uploader) or an admin may delete. Files uploaded before uploader tracking existed can only be deleted by an admin.
- Where a rule lives: `policies/` (who may), `validators/` (input shape), `models/` (SQL), `controllers/` (orchestration).

### Notifications

When a status changes, or a comment/file is added or deleted, the applicant and the assigned operator are notified, except the person who made the change and deactivated users. Notifications are stored in the `notifications` table; the UI polls every 30 s and shows a bell in the navbar. Creating a notification is best-effort: a failure is logged and never fails the action that caused it.

### API overview

The API is served under `/api` (and also at the root; the dev server and the bundled build both use `/api`). Everything except register/login needs `Authorization: Bearer <token>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Categories | `GET /categories`; admin: `POST`, `PATCH /:id`, `DELETE /:id` |
| Requests | `GET /requests` (filters, search, sorting, paging), `POST /requests`, `GET /requests/:id`, `DELETE /requests/:id` |
| Workflow | `PATCH /requests/:id/status`, `GET /requests/:id/status` (history), `PATCH /requests/:id/assign` |
| Comments | `GET`/`POST /requests/:id/comments`, `DELETE /requests/:id/comments/:commentId` |
| Files | `GET`/`POST /requests/:id/attachments`, `GET /attachments/:id` (download), `DELETE /attachments/:id` |
| Notifications | `GET /notifications` (`unread`, `page`, `limit`), `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Admin | `GET`/`POST /admin/users`, `PATCH /admin/users/:id` |
| Health | `GET /health` |


## Run it locally (dev)

**Prerequisites:** Node.js 22+, PostgreSQL 14+.

```bash
# 1. install dependencies for both projects
npm run install:all

# 2. create a database and configure the backend
createdb helpdesk
cp backend/.env.example backend/.env
# edit backend/.env

# 3. create the tables, the first admin account and the default categories
npm run migrate
npm --prefix backend run seed

# 4. (optional) fill the database with demo users and requests
npm --prefix backend run seed:demo

# 5. start both servers, each in its own terminal
npm run dev:backend
npm run dev:frontend
```

## Tests and lint

```bash
createdb helpdesk_test
psql helpdesk_test -f backend/src/db/schema.sql
cp backend/.env.test.example backend/.env.test

npm test
npm run lint
```

## Build and deploy (prod)

```bash
npm run install:all
npm run build
npm run migrate
npm start
```

`npm start` sets `FRONTEND_DIST=../frontend/dist`. Set `NODE_ENV=prod` in the environment (or `backend/.env`) for production.

### Deployment notes

- **Use HTTPS in production.** The server sends security headers (HSTS, `upgrade-insecure-requests`) that make browsers load every resource over HTTPS. On plain `http://` the page works only on `localhost`; on any other host it will appear blank. Terminate TLS in a reverse proxy or load balancer.
- Behind a reverse proxy set `TRUST_PROXY=1` (number of proxies) so rate limiting sees real client IPs.

## Configuration

All settings are environment variables (`backend/.env` is loaded automatically). See `backend/.env.example`.

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `JWT_SECRET` | yes | | Token signing key, at least 32 characters |
| `NODE_ENV` | no | `dev` | `dev`, `test` or `prod` (affects password hashing cost) |
| `PORT` | no | `3000` | HTTP port |
| `JWT_EXPIRES` | no | `1h` | Token lifetime |
| `UPLOAD_DIR` | no | `uploads/attachments` | Where attachments are stored |
| `UPLOAD_MAX_BYTES` | no | `5242880` | Max upload size (5 MB) |
| `FRONTEND_DIST` | no | | Directory of the built frontend; when set the backend serves it |
| `TRUST_PROXY` | no | | Number of reverse proxies in front of the app |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | for `seed` | `admin` / | First admin account (`npm --prefix backend run seed`) |
