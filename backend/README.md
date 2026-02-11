# UAS Backend API

> **Status:** ✅ Phase 5 — Complete

## Purpose

The backend provides cloud features: authentication, profile storage, install history, and catalog metadata. It supports both a hosted service and self-hosted deployment.

## Architecture

```
backend/
  src/
    config.ts            — Environment-based configuration
    db.ts                — sql.js SQLite database layer
    auth.ts              — JWT + bcrypt authentication
    schemas.ts           — Zod request validation schemas
    app.ts               — Express application factory
    server.ts            — HTTP server entry point
    index.ts             — Public API barrel
    routes/
      auth.ts            — POST register, login; GET me
      profiles.ts        — CRUD for user profiles
      machines.ts        — Register/list/delete machines
      history.ts         — Record and query install history
      health.ts          — Health check endpoint
  tests/
    api.test.ts          — 27 integration tests (supertest)
```

## API Endpoints

| Method | Endpoint                   | Auth | Description          |
| ------ | -------------------------- | ---- | -------------------- |
| GET    | `/api/health`              | No   | Service health check |
| POST   | `/api/auth/register`       | No   | Create account       |
| POST   | `/api/auth/login`          | No   | Login, get JWT       |
| GET    | `/api/auth/me`             | Yes  | Current user info    |
| POST   | `/api/profiles`            | Yes  | Create profile       |
| GET    | `/api/profiles`            | Yes  | List user profiles   |
| GET    | `/api/profiles/:id`        | Yes  | Get profile          |
| PUT    | `/api/profiles/:id`        | Yes  | Update profile       |
| DELETE | `/api/profiles/:id`        | Yes  | Delete profile       |
| POST   | `/api/machines`            | Yes  | Register machine     |
| GET    | `/api/machines`            | Yes  | List machines        |
| GET    | `/api/machines/:id`        | Yes  | Get machine          |
| DELETE | `/api/machines/:id`        | Yes  | Unregister machine   |
| POST   | `/api/history`             | Yes  | Record install event |
| GET    | `/api/history`             | Yes  | List install history |
| GET    | `/api/history/machine/:id` | Yes  | History by machine   |
| GET    | `/api/history/app/:appId`  | Yes  | History by app       |

## Technology

- **Express** — HTTP framework
- **sql.js** — Pure JS SQLite (zero native deps)
- **JWT + bcrypt** — Authentication
- **Zod** — Request validation
- **Helmet + CORS** — Security headers
- **Supertest** — Integration testing

## Scripts

```bash
npm run build    # Compile TypeScript
npm run dev      # Development server (tsx watch)
npm start        # Production server
npm test         # Run 27 tests
```

## Boundaries

- The backend **never** executes installation logic — that runs client-side
- The backend **never** sends executable code to clients
- All API responses are validated client-side against schemas
- HTTPS only in production
