# UptimeMonitor

A full-stack API health monitoring platform with real-time alerts, public status pages, team management, and programmatic API access. Built to monitor the uptime, response time, and health of APIs and websites.

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

### Infrastructure
- **Data Retention** — Automatic cleanup of check records older than 90 days via nightly cron job
- **Docker Ready** — Full Docker Compose setup with PostgreSQL, Node.js server, and Nginx-served React client
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

4. **Create `server/.env`**

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uptime_monitor
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

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

### Docker Deployment

```bash
docker-compose up --build
```

The app will be available at http://localhost with PostgreSQL, the API server, and Nginx all running in containers.

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
| POST | /api/auth/login | Sign in |
| POST | /api/auth/refresh-token | Refresh JWT tokens |
| GET | /api/auth/me | Get current user profile |

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
| POST | /api/public/status/:slug/subscribe | Subscribe to updates |
| GET | /api/public/unsubscribe/:token | Unsubscribe |

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

- **JSONB for assertions and config** — Flexible schema for alert channel configs and monitor assertions without migration headaches
- **Consecutive failure threshold** — 3 failures before marking down to prevent false alarms from network blips
- **SHA-256 hashed API keys** — Keys are only shown once at creation; stored as irreversible hashes
- **node-cron over BullMQ** — Simpler dependency (no Redis required) while still supporting per-monitor intervals
- **Sequelize ORM** — Type-safe database access with automatic migration via sync({ alter: true })
- **Refresh token rotation** — New refresh token issued on each refresh to limit token reuse attacks

## License

MIT