# Kanban backend

Express + MongoDB API backing the Registration / Login / Task Board features. Replaces the frontend's `mockBackend.js` simulation with a real server.

## Setup

```bash
npm install
cp .env.example .env    # then fill in a real MONGO_URI and JWT_SECRET
npm run dev              # nodemon, http://localhost:5000
```

Needs a MongoDB instance reachable at `MONGO_URI` — either local (`mongod` running on your machine) or an Atlas connection string.

## Tests

```bash
npm test
```

Uses `mongodb-memory-server`, so tests don't touch your real database — a throwaway in-memory Mongo spins up for the run. First run needs internet access once, to download the `mongod` binary; it's cached after that.

29 tests across two files:
- `tests/auth.test.js` — signup validation/duplicates, login (username or email, wrong password, unknown user), session check with missing/invalid/valid tokens.
- `tests/tasks.test.js` — auth-required on every route, create validation + duplicate names (per-user, case-insensitive), listing is scoped per user, update/stage-move/delete all 404 on a task that doesn't exist or belongs to someone else (not 403 — don't let a caller distinguish "not yours" from "doesn't exist").

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | – | |
| GET | `/api/auth/availability?field=username&value=x` | – | used for the debounced check on the signup form |
| POST | `/api/auth/login` | – | accepts username or email |
| GET | `/api/auth/session` | yes | used to restore a session on page refresh |
| POST | `/api/auth/logout` | yes | mostly a no-op — see note in `authController.js` |
| GET | `/api/tasks` | yes | |
| POST | `/api/tasks` | yes | |
| PUT | `/api/tasks/:id` | yes | partial update |
| PATCH | `/api/tasks/:id/stage` | yes | same handler as PUT, just a narrower body |
| DELETE | `/api/tasks/:id` | yes | |

Every error response is `{ success: false, error: { code, message } }` — same shape the frontend's mock already used, so nothing on the client had to change format-wise.

## What's deliberately not here

- Logout doesn't blocklist the JWT server-side. Stateless tokens can't really be revoked without adding a store for that (Redis, a DB collection of invalidated tokens) — felt like scope creep for what this task needed. Worth knowing if a real "log out everywhere" feature is ever needed.
- No rate limiting on login attempts. The PRD mentions this as a nice-to-have; would add `express-rate-limit` on `/api/auth/login` if this went further.
- Profile images are still accepted as base64 strings and stored directly on the user document — this backend doesn't fix that, it just persists the same thing the mock did. A real next step would be `multer` + object storage, returning a URL instead.
