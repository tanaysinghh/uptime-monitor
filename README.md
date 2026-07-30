# UptimeMonitor

[![CI](https://github.com/tanaysinghh/uptime-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/tanaysinghh/uptime-monitor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A full-stack API health monitoring platform with real-time alerts, public status pages, team management, and programmatic API access. Built to monitor the uptime, response time, and health of APIs and websites.

## Live Demo

🚀 **[uptime-monitor-client.onrender.com](https://uptime-monitor-client.onrender.com)** — *(URL updated once Render blueprint syncs; free tier cold-starts in ~30s on first hit)*

- **Try it**: register with any email → the first account becomes the org admin
- **Public status page**: `/status/<your-org-slug>` (no login needed)
- **Public status badge**: `GET /api/public/status/<slug>/badge.svg` — embed in your own README

## Screenshots

> Screenshots live in [`docs/screenshots/`](docs/screenshots/). Recording pending.

| Dashboard | Monitor detail | Public status page |
| --- | --- | --- |
| _dashboard.png_ | _monitor-detail.png_ | _status-page.png_ |



## Features

### Core Monitoring
- **HTTP Monitoring** — Monitor URLs with configurable intervals (30s to 15m), HTTP methods, custom headers, and expected status codes
- **Heartbeat / Cron Monitoring** — Dead man's switch pattern: your cron jobs ping UptimeMonitor, and alerts fire if they miss their window
- **Response Body Assertions** — Assert that response bodies contain specific strings, JSON path values match expected results, or response times stay under thresholds
- **SSL Certificate Monitoring** — Automatically detects SSL certificate expiry and warns 14 days before expiration

### Incident Management
- **Auto Incident Detection** — Incidents are created after 3 consecutive failures and auto-resolved when the service recovers
- **Maintenance Windows** — Schedule planned downtime so the system doesn't create false incidents; status page shows maintenance instead of outage
- **Incident Timeline** — Full audit trail of when incidents started, status changes, and resolution with duration tracking

### Alerting
- **Webhook Alerts** — Send JSON payloads to any URL when monitors go down or recover
- **Slack Integration** — Rich formatted messages to Slack channels via incoming webhooks
- **Discord Integration** — Embedded alerts to Discord channels via webhooks
- **Cooldown Periods** — Prevent alert spam during service flapping with configurable cooldown per channel
- **Alert Log** — Full history of every alert sent, including failures

### Analytics
- **Dashboard Stats** — Total monitors, uptime percentage, check counts, and active incidents at a glance
- **Latency Percentiles** — p95 and p99 response time calculations alongside averages
- **Response Time Charts** — Interactive time-series charts with 24h, 7d, 30d, and 90d views
- **Per-Monitor Analytics** — Detailed stats per monitor including min/max/avg response times and incident counts

### Public Status Page
- **Branded Status Page** — Each organization gets a unique URL showing current status of all monitors
- **90-Day Uptime Bars** — GitHub-style uptime visualization with color-coded daily bars and hover tooltips
- **Overall Status Indicator** — Automatically computed: "All Systems Operational", "Partial Outage", or "Major Outage"
- **Subscriber Notifications** — Visitors can subscribe via email to receive incident notifications
- **Past Incidents** — Shows resolved incidents with duration for transparency

### Team & Access
- **Team Management** — Invite members via email, assign roles (admin/editor/viewer)
- **Role-Based Access Control** — Admins manage team and settings, editors manage monitors, viewers read-only
- **Audit Log** — Every team action is logged: who did what, when, with full details
- **API Key System** — Generate API keys with granular permissions (read/write/admin) for programmatic access
- **Key Security** — API keys are SHA-256 hashed at rest; only shown once at creation

### Real-Time
- **Socket.IO Live Updates** — Dashboard updates instantly when monitor status changes
- **Toast Notifications** — Real-time browser notifications for incidents and recoveries
- **Auto-Refresh** — Dashboard and status pages poll for updates at regular intervals

### Authentication & Account Security
- **TOTP Multi-Factor Authentication** — Optional per user, standard RFC 6238 TOTP (works with 1Password, Authy, Google Authenticator, Bitwarden). Secrets are AES-256-GCM encrypted at rest with a key kept out of the database.
- **10 single-use backup codes** — SHA-256 hashed at rest, constant-time compare on redeem, human-readable `xxxx-xxxx` format from a base32 alphabet minus the confusable characters (0, O, 1, I, L). Users can regenerate them at any time (requires a live TOTP).
- **Two-step login** — When MFA is enabled the login endpoint issues a short-lived, single-use `mfaChallengeToken` instead of session tokens. A dedicated `/mfa/challenge` endpoint accepts either a TOTP or a backup code before real tokens are minted.
- **Account lockout** — 5 consecutive failed logins lock the account for 15 minutes; response stays a generic `401 Invalid credentials` in every failure mode, so lockout state is not leaked to attackers (no user enumeration). Lockouts land in the SecurityEvent log.
- **Server-side session store** — Every refresh token corresponds to a `Session` row (device, IP, last-used, expiresAt). Refresh **rotates** the stored hash + a fresh `jti` on every call — replaying a prior refresh token is detected and rejected.
- **Real session revocation** — `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all-devices`. Password change and MFA disable auto-revoke every other active session.
- **Password policy via zxcvbn** — Registration and password change reject scores below 2, feed the user's own inputs (email, name) into zxcvbn so passwords derived from them are rejected too. Client shows a directional strength meter as they type.
- **Per-user security event log** — `SecurityEvent` records login success/failure, account lock, MFA enable/disable, backup code use, password change, and every session revocation with IP + user agent. Users see their own events in Settings → Security; there's no way to view another user's events.

### Security & Reliability
- **Fail-fast env validation** — Server refuses to boot if required vars are missing or placeholder/short JWT secrets are used in production; `MFA_ENCRYPTION_KEY` must be a 32-byte hex string
- **Rate limiting** — Per-route limiters on login (10/15min/IP), register (5/hr), refresh (20/15min), MFA challenge/verify (10/5min), heartbeat (60/min/token), subscribe (5/hr) — layered with the account lockout so brute-force needs to beat both
- **SSRF guard** — Monitor URLs are validated against RFC1918 / loopback / link-local / CGNAT ranges and DNS-resolved before the scheduler is allowed to fetch them
- **Role-based access control** — `admin` / `editor` / `viewer` enforced on every write route via middleware, not per-controller checks
- **Input validation** — express-validator schemas on every endpoint; consistent 400 responses with per-field errors
- **Sanitized errors** — 5xx responses return generic messages in production; every response carries an `X-Request-Id` for correlation
- **Graceful shutdown** — SIGTERM drains the HTTP server, closes Socket.IO, stops cron jobs, and closes the DB pool within 15s
- **DB-checked /health** — 503 when Postgres is unreachable, so load balancers and Render probe correctly

### Infrastructure
- **Data Retention** — Automatic cleanup of check records older than 90 days via nightly cron job
- **Indexed hot paths** — Every dashboard/status/scheduler query hits an index (Checks(monitorId, checkedAt), Monitors(orgId, status), etc.)
- **Docker Ready** — Multi-stage build, non-root user, tini as PID 1, HEALTHCHECK baked in
- **CI on every push** — GitHub Actions runs 56 Jest tests + client lint + Vite build
- **One-click deploy** — `render.yaml` blueprint provisions the server, managed Postgres, and static client
- **JWT Authentication** — Access tokens with 15m expiry, refresh tokens with 7d expiry, automatic token rotation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Recharts, Framer Motion, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO, node-cron |
| Database | PostgreSQL 16, Sequelize ORM |
| Auth | JWT (access + refresh tokens), bcrypt, API key (SHA-256) |
| Alerting | Axios (webhook/Slack/Discord dispatch) |
| Deployment | Docker, Docker Compose, Nginx |

## Project Structure

```
uptime-monitor/
├── server/
│   └── src/
│       ├── config/          # Database configuration
│       ├── controllers/     # Route handlers
│       │   ├── authController.js
│       │   ├── monitorController.js
│       │   ├── statsController.js
│       │   ├── publicController.js
│       │   ├── alertController.js
│       │   ├── teamController.js
│       │   ├── apiKeyController.js
│       │   ├── subscriberController.js
│       │   └── maintenanceController.js
│       ├── middlewares/     # Auth & API key middleware
│       ├── models/          # Sequelize models (9 models)
│       ├── routes/          # Express route definitions
│       ├── services/        # Business logic
│       │   ├── healthCheckService.js
│       │   ├── heartbeatService.js
│       │   ├── alertService.js
│       │   ├── socketService.js
│       │   ├── scheduler.js
│       │   └── dataCleanup.js
│       ├── utils/           # Helpers (JWT, assertions)
│       ├── app.js
│       └── server.js
├── client/
│   └── src/
│       ├── api/             # Axios instance with interceptors
│       ├── components/      # Layout, ProtectedRoute, UI components
│       ├── context/         # Auth context provider
│       ├── hooks/           # useSocket hook
│       ├── lib/             # Utility functions
│       └── pages/           # All page components
│           ├── Landing.jsx
│           ├── Dashboard.jsx
│           ├── Monitors.jsx
│           ├── MonitorDetail.jsx
│           ├── Alerts.jsx
│           ├── Team.jsx
│           ├── Settings.jsx
│           └── StatusPage.jsx
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL 16+
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/uptime-monitor.git
cd uptime-monitor
```

2. **Set up the server**

```bash
cd server
npm install
```

3. **Create the database**

```bash
psql -U postgres -c "CREATE DATABASE uptime_monitor;"
```

4. **Create `.env` at the repo root**

```bash
cp .env.example .env
# then fill in real values — generate JWT secrets with:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server validates env on boot and will refuse to start with placeholder or missing values in production.

5. **Start the server**

```bash
npm run dev
```

6. **Set up the client** (new terminal)

```bash
cd client
npm install
npm run dev
```

7. **Open the app** at http://localhost:5173

### Running Tests

```bash
cd server
npm test
```

56 tests, no live DB required (models are mocked). Runs in ~2s.

### Docker Deployment

```bash
docker compose up --build
```

The app will be available at http://localhost with PostgreSQL, the API server, and Nginx all running in containers. Postgres has a healthcheck; the server waits for it before starting.

### Cloud Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render blueprint one-click deploy, Docker Compose self-host, and Vercel + Render split deploy.

## Database Schema

The application uses 9 Sequelize models:

- **User** — Authentication, roles (admin/editor/viewer), org membership
- **Organization** — Multi-tenant orgs with slug, branding
- **Monitor** — HTTP and heartbeat monitors with assertions, maintenance config
- **Check** — Individual health check results with status code, response time
- **Incident** — Auto-created/resolved incidents with duration tracking
- **AlertChannel** — Webhook/Slack/Discord configurations per org
- **AlertLog** — Record of every alert sent or failed
- **AuditLog** — Team action history with user, action, resource, details
- **Subscriber** — Status page email subscribers per org
- **ApiKey** — Hashed API keys with permissions and expiry

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account with organization |
| POST | /api/auth/login | Sign in; returns `{ requiresMfa, mfaChallengeToken }` when MFA is on |
| POST | /api/auth/mfa/challenge | Complete MFA with TOTP or backup code |
| POST | /api/auth/refresh-token | Rotate refresh token (single-use hash + jti) |
| POST | /api/auth/password | Change password (revokes other sessions) |
| GET | /api/auth/me | Get current user profile |
| GET | /api/auth/sessions | List caller's active sessions |
| DELETE | /api/auth/sessions/:id | Revoke a session |
| POST | /api/auth/logout-all-devices | Revoke every session for caller |
| POST | /api/auth/mfa/setup | Start MFA enrollment (returns QR + secret) |
| POST | /api/auth/mfa/verify | Confirm first TOTP code; returns 10 backup codes ONCE |
| POST | /api/auth/mfa/disable | Requires current password + valid TOTP |
| POST | /api/auth/mfa/backup-codes/regenerate | Replace backup codes (requires TOTP) |

### Security
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/security/events | Caller's own security events (login, MFA, sessions, password) |

### Monitors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/monitors | List all monitors |
| POST | /api/monitors | Create HTTP monitor |
| GET | /api/monitors/:id | Get monitor details |
| PUT | /api/monitors/:id | Update monitor |
| DELETE | /api/monitors/:id | Delete monitor and related data |
| GET | /api/monitors/:id/checks | Get check history (with period filter) |
| GET | /api/monitors/:id/incidents | Get monitor incidents |

### Heartbeat Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/heartbeat/monitors | Create heartbeat monitor |
| GET/POST | /api/heartbeat/:token | Send heartbeat ping |

### Maintenance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/maintenance/monitors/:id/enable | Enable maintenance window |
| POST | /api/maintenance/monitors/:id/disable | Disable maintenance |

### Stats & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats/dashboard | Dashboard overview with p95/p99 |
| GET | /api/stats/monitors/:id | Per-monitor analytics |

### Alert Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/alerts/channels | List alert channels |
| POST | /api/alerts/channels | Create channel |
| PUT | /api/alerts/channels/:id | Update channel |
| DELETE | /api/alerts/channels/:id | Delete channel |
| POST | /api/alerts/channels/:id/test | Send test alert |
| GET | /api/alerts/logs | View alert history |

### Team Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/team/members | List team members |
| POST | /api/team/members | Invite member |
| PUT | /api/team/members/:id/role | Change member role |
| DELETE | /api/team/members/:id | Remove member |
| GET | /api/team/audit-log | View audit log |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/api-keys | List API keys |
| POST | /api/api-keys | Create API key |
| PUT | /api/api-keys/:id/revoke | Revoke API key |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/public/status/:slug | Public status page data |
| GET | /api/public/status/:slug/badge.svg | Embeddable status badge (SVG) |
| GET | /api/public/status/:slug/uptime.svg | Embeddable uptime % badge (`?period=7d\|30d\|90d`) |
| POST | /api/public/status/:slug/subscribe | Subscribe to updates |
| GET | /api/public/unsubscribe/:token | Unsubscribe |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Liveness + DB readiness; 503 when DB is unreachable |

## Architecture

```
                    ┌─────────────────────────┐
                    │   React Client (Vite)   │
                    │   - Dashboard           │
                    │   - Monitors            │
                    │   - Alerts              │
                    │   - Team Management     │
                    │   - Settings            │
                    │   - Public Status Page  │
                    └──────────┬──────────────┘
                               │ HTTP + WebSocket
                    ┌──────────┴──────────────┐
                    │   Express API Server    │
                    │   - REST API (11 route  │
                    │     groups)             │
                    │   - Socket.IO           │
                    │   - JWT + API Key Auth  │
                    └──────────┬──────────────┘
                               │ Sequelize ORM
                    ┌──────────┴──────────────┐
                    │   PostgreSQL Database   │
                    │   - 10 tables           │
                    │   - JSONB for flexible  │
                    │     config storage      │
                    └─────────────────────────┘

    Background Services:
    ├── Health Check Scheduler (every 30s)
    ├── Heartbeat Monitor Checker (every 30s)
    ├── Data Cleanup (daily at 3 AM)
    └── Alert Dispatch (on status change)
```

## Key Engineering Decisions

- **JSONB for assertions and config** — Flexible schema for alert-channel configs and monitor assertions without migration churn
- **Consecutive failure threshold** — 3 failures before marking down to filter network blips; single miss for heartbeats since those are already coarse
- **SHA-256 hashed API keys** — Keys shown once at creation; only the hash is stored, so a DB dump can't be replayed
- **node-cron over BullMQ** — Same dev machine can run everything (no Redis) and 30s tick loops are simpler to reason about than a queue at this scale
- **Sequelize `sync({ alter: true })` in dev only** — Fast iteration locally; production uses plain `sync()` and the "at scale" section below covers the real migration story
- **Refresh token rotation** — A new refresh token is issued on every refresh, shortening the useful lifetime of a stolen one
- **Rate limits scoped per surface** — Auth (10/15min), register (5/hr), heartbeat (60/min/token), subscribe (5/hr) — each tuned for its abuse case
- **SSRF guard runs before any outbound axios call** — DNS resolution + private-range check happens on monitor create/update, not just at check time
- **Central error middleware, not per-controller `error.message` leaks** — Every 5xx in production returns `{ error: "Internal server error", requestId }`; the real error is logged with the request ID so triage still works

## What I'd Do Differently at Scale

Interviewer question I'm ready for: *"This works for a demo. What breaks first?"*

- **Tokens in `localStorage`** — Vulnerable to XSS. Real fix: httpOnly, SameSite=Lax cookies for both access and refresh, with a `/csrf-token` endpoint issuing a double-submit token. Wasn't done here because it turns "one commit" into a rework of the axios interceptor, socket auth, and the entire dev/prod cookie config.
- **MFA_ENCRYPTION_KEY in an env var** — Fine for a single-node deploy; at scale I'd move it to a KMS (AWS KMS, GCP Cloud KMS, HashiCorp Vault) with envelope encryption per user, so a single compromised env var doesn't disclose every enrolled TOTP secret.
- **In-memory rate-limit store** — `express-rate-limit` defaults to memory, so limits reset per process. Multi-instance deploys need a Redis store to share counters; MFA and login limiters especially need shared state or an attacker can hop instances.
- **`sequelize.sync({ alter: true })` in dev** — Fast now, dangerous later. Move to `sequelize-cli` migrations with a proper up/down file per schema change so production deploys are reviewable and reversible.
- **Sequential scheduler loop** — `checkAllMonitors` awaits monitors one at a time; at ~500 monitors a 30s tick can't keep up. Fix: bounded `Promise.allSettled` batches (say 25 in flight), then move to a real queue (BullMQ + Redis) when checks need retries, backoff, or worker distribution across processes.
- **Alert dedupe is per-channel cooldown, not per-incident** — Two down->up flaps in the cooldown window swallow the second alert. Better: alert per incident state transition, with a "flap detected" grouping.
- **Public status page fires N daily-stat queries** — Fine at ~20 monitors, poor at 500. Would collapse into a single `GROUP BY monitorId, DATE(checkedAt)` and add a materialized view refreshed every few minutes.
- **No metrics endpoint** — `/metrics` in Prometheus format (request counts, latency histograms, check outcomes, scheduler lag) would let this thing monitor itself.
- **Frontend accessibility** — Nav has no `aria-current`, no skip link. Contrast is fine (gray-100 on gray-950) but the app hasn't been tested with a screen reader end-to-end.

## License

MIT