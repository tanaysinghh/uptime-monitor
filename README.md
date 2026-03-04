# UptimeMonitor

A full-stack API health monitoring platform with real-time alerts and public status pages. Built to monitor the uptime, response time, and health of APIs and websites.

## Features

- **Monitor Management** — Add URLs to monitor with configurable intervals, HTTP methods, expected status codes, and timeout thresholds
- **Health Check Engine** — Automated background scheduler pings all monitors at their configured intervals
- **Incident Detection** — Auto-creates incidents after consecutive failures, auto-resolves when service recovers
- **Public Status Page** — Shareable, branded status page showing 90-day uptime bars, current status, and incident history
- **Real-Time Updates** — Socket.IO powered live dashboard with instant status change notifications
- **SSL Monitoring** — Detects SSL certificate expiry and warns 14 days before expiration
- **Dashboard Analytics** — Uptime percentages, average/min/max response times, check history charts
- **Data Retention** — Automatic cleanup of check data older than 90 days
- **JWT Authentication** — Secure auth with access tokens, refresh tokens, and role-based access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, Recharts, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL, Sequelize ORM |
| Auth | JWT (access + refresh tokens), bcrypt |
| Scheduling | node-cron |
| Deployment | Docker, Docker Compose, Nginx |

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL
- Git

### Installation

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/uptime-monitor.git
cd uptime-monitor
```

2. Set up the server
```bash
cd server
npm install
```

3. Create `server/.env`
```
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

4. Create the database
```bash
psql -U postgres -c "CREATE DATABASE uptime_monitor;"
```

5. Start the server
```bash
npm run dev
```

6. Set up the client (new terminal)
```bash
cd client
npm install
npm run dev
```

7. Open http://localhost:5173

### Docker Deployment
```bash
docker-compose up --build
```

The app will be available at http://localhost

## Architecture
```
Client (React + Vite)
  ↕ HTTP + WebSocket
Server (Express + Socket.IO)
  ↕ Sequelize ORM
PostgreSQL

Background Services:
  - Health Check Scheduler (every 30s)
  - Data Cleanup (daily at 3 AM)
  - SSL Certificate Checker
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `POST /api/auth/refresh-token` — Refresh JWT
- `GET /api/auth/me` — Get current user

### Monitors
- `GET /api/monitors` — List all monitors
- `POST /api/monitors` — Create monitor
- `GET /api/monitors/:id` — Get monitor details
- `PUT /api/monitors/:id` — Update monitor
- `DELETE /api/monitors/:id` — Delete monitor
- `GET /api/monitors/:id/checks` — Get check history
- `GET /api/monitors/:id/incidents` — Get incidents

### Stats
- `GET /api/stats/dashboard` — Dashboard overview
- `GET /api/stats/monitors/:id` — Monitor analytics

### Public
- `GET /api/public/status/:slug` — Public status page data

## License

MIT