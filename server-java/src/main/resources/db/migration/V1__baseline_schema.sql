-- Baseline schema, reproduced from the schema Sequelize created via sync() in the
-- Node server (table/column names, enum type names, defaults, indexes and FKs are
-- identical), so the Java and Node servers can share one database.
--
-- Existing databases already created by Sequelize are *baselined* at V1 by Flyway
-- (spring.flyway.baseline-on-migrate=true): this script is skipped for them and only
-- later migrations run. Fresh databases execute it.

CREATE TYPE "enum_AlertChannels_type" AS ENUM ('email', 'webhook', 'slack', 'discord');
CREATE TYPE "enum_AlertLogs_status" AS ENUM ('sent', 'failed');
CREATE TYPE "enum_AlertLogs_type" AS ENUM ('down', 'up', 'degraded', 'maintenance');
CREATE TYPE "enum_Incidents_status" AS ENUM ('investigating', 'identified', 'monitoring', 'resolved');
CREATE TYPE "enum_Monitors_method" AS ENUM ('GET', 'POST', 'HEAD', 'PUT', 'PATCH');
CREATE TYPE "enum_Monitors_monitorType" AS ENUM ('http', 'heartbeat');
CREATE TYPE "enum_Monitors_status" AS ENUM ('up', 'down', 'paused', 'pending');
CREATE TYPE "enum_SecurityEvents_eventType" AS ENUM (
    'login_success',
    'login_failure',
    'account_locked',
    'mfa_enabled',
    'mfa_disabled',
    'mfa_challenge_success',
    'mfa_challenge_failure',
    'backup_code_used',
    'backup_codes_regenerated',
    'password_changed',
    'session_revoked',
    'sessions_revoked_all'
);
CREATE TYPE "enum_Users_role" AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE "Organizations" (
    id uuid NOT NULL,
    name varchar(255) NOT NULL,
    slug varchar(255) NOT NULL,
    "logoUrl" varchar(255),
    "brandColor" varchar(255) DEFAULT '#22c55e',
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "Organizations_pkey" PRIMARY KEY (id),
    CONSTRAINT "Organizations_slug_key" UNIQUE (slug)
);

CREATE TABLE "Users" (
    id uuid NOT NULL,
    email varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    name varchar(255) NOT NULL,
    role "enum_Users_role" DEFAULT 'admin',
    "isVerified" boolean DEFAULT false,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "organizationId" uuid,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp with time zone,
    "passwordChangedAt" timestamp with time zone,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    "mfaBackupCodes" varchar(255)[] DEFAULT (ARRAY[]::varchar[])::varchar(255)[],
    "mfaConfirmedAt" timestamp with time zone,
    CONSTRAINT "Users_pkey" PRIMARY KEY (id),
    CONSTRAINT "Users_email_key" UNIQUE (email),
    CONSTRAINT "Users_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organizations"(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE "Monitors" (
    id uuid NOT NULL,
    name varchar(255) NOT NULL,
    url varchar(255) NOT NULL,
    method "enum_Monitors_method" DEFAULT 'GET',
    headers jsonb DEFAULT '{}'::jsonb,
    body jsonb,
    "intervalSeconds" integer DEFAULT 300,
    "timeoutMs" integer DEFAULT 30000,
    "expectedStatus" integer DEFAULT 200,
    status "enum_Monitors_status" DEFAULT 'pending',
    tags varchar(255)[] DEFAULT (ARRAY[]::varchar[])::varchar(255)[],
    "consecutiveFailures" integer DEFAULT 0,
    "lastCheckedAt" timestamp with time zone,
    "organizationId" uuid NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    assertions jsonb DEFAULT '[]'::jsonb,
    "monitorType" "enum_Monitors_monitorType" DEFAULT 'http',
    "heartbeatInterval" integer,
    "heartbeatToken" varchar(255),
    "lastHeartbeatAt" timestamp with time zone,
    "maintenanceMode" boolean DEFAULT false,
    "maintenanceStartAt" timestamp with time zone,
    "maintenanceEndAt" timestamp with time zone,
    "maintenanceReason" varchar(255),
    CONSTRAINT "Monitors_pkey" PRIMARY KEY (id),
    CONSTRAINT "Monitors_heartbeatToken_key" UNIQUE ("heartbeatToken"),
    CONSTRAINT "Monitors_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organizations"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX monitors_organization_id_status ON "Monitors" ("organizationId", status);
CREATE INDEX monitors_monitor_type_status ON "Monitors" ("monitorType", status);

CREATE TABLE "Checks" (
    id uuid NOT NULL,
    "monitorId" uuid NOT NULL,
    "statusCode" integer,
    "responseTimeMs" integer,
    "isSuccess" boolean NOT NULL,
    "errorMessage" text,
    "checkedAt" timestamp with time zone,
    CONSTRAINT "Checks_pkey" PRIMARY KEY (id),
    CONSTRAINT "Checks_monitorId_fkey" FOREIGN KEY ("monitorId")
        REFERENCES "Monitors"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX checks_monitor_id_checked_at ON "Checks" ("monitorId", "checkedAt");
CREATE INDEX checks_checked_at ON "Checks" ("checkedAt");

CREATE TABLE "Incidents" (
    id uuid NOT NULL,
    "monitorId" uuid NOT NULL,
    status "enum_Incidents_status" DEFAULT 'investigating',
    "startedAt" timestamp with time zone,
    "resolvedAt" timestamp with time zone,
    "durationSeconds" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "Incidents_pkey" PRIMARY KEY (id),
    CONSTRAINT "Incidents_monitorId_fkey" FOREIGN KEY ("monitorId")
        REFERENCES "Monitors"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX incidents_monitor_id_status ON "Incidents" ("monitorId", status);
CREATE INDEX incidents_monitor_id_started_at ON "Incidents" ("monitorId", "startedAt");

CREATE TABLE "AlertChannels" (
    id uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    name varchar(255) NOT NULL,
    type "enum_AlertChannels_type" NOT NULL,
    config jsonb NOT NULL,
    "isActive" boolean DEFAULT true,
    "cooldownMinutes" integer DEFAULT 5,
    "lastAlertedAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "AlertChannels_pkey" PRIMARY KEY (id),
    CONSTRAINT "AlertChannels_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organizations"(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "AlertLogs" (
    id uuid NOT NULL,
    "monitorId" uuid NOT NULL,
    "incidentId" uuid,
    "channelId" uuid NOT NULL,
    type "enum_AlertLogs_type" NOT NULL,
    status "enum_AlertLogs_status" NOT NULL,
    "errorMessage" text,
    "sentAt" timestamp with time zone,
    CONSTRAINT "AlertLogs_pkey" PRIMARY KEY (id),
    CONSTRAINT "AlertLogs_monitorId_fkey" FOREIGN KEY ("monitorId")
        REFERENCES "Monitors"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "AlertLogs_incidentId_fkey" FOREIGN KEY ("incidentId")
        REFERENCES "Incidents"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT "AlertLogs_channelId_fkey" FOREIGN KEY ("channelId")
        REFERENCES "AlertChannels"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX alert_logs_monitor_id_sent_at ON "AlertLogs" ("monitorId", "sentAt");

CREATE TABLE "AuditLogs" (
    id uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    action varchar(255) NOT NULL,
    resource varchar(255) NOT NULL,
    "resourceId" uuid,
    details jsonb DEFAULT '{}'::jsonb,
    "ipAddress" varchar(255),
    "createdAt" timestamp with time zone NOT NULL,
    CONSTRAINT "AuditLogs_pkey" PRIMARY KEY (id),
    CONSTRAINT "AuditLogs_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organizations"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "AuditLogs_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX audit_logs_organization_id_created_at ON "AuditLogs" ("organizationId", "createdAt");

CREATE TABLE "Subscribers" (
    id uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    email varchar(255) NOT NULL,
    confirmed boolean DEFAULT false,
    "confirmToken" varchar(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "Subscribers_pkey" PRIMARY KEY (id),
    CONSTRAINT "Subscribers_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organizations"(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "ApiKeys" (
    id uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name varchar(255) NOT NULL,
    "keyHash" varchar(255) NOT NULL,
    "keyPrefix" varchar(255) NOT NULL,
    permissions varchar(255)[] DEFAULT ARRAY['read'::varchar(255)],
    "lastUsedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "ApiKeys_pkey" PRIMARY KEY (id),
    CONSTRAINT "ApiKeys_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organizations"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "ApiKeys_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX api_keys_key_hash ON "ApiKeys" ("keyHash");
CREATE INDEX api_keys_organization_id ON "ApiKeys" ("organizationId");

CREATE TABLE "SecurityEvents" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "organizationId" uuid,
    "eventType" "enum_SecurityEvents_eventType" NOT NULL,
    "ipAddress" varchar(45),
    "userAgent" varchar(500),
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    CONSTRAINT "SecurityEvents_pkey" PRIMARY KEY (id),
    CONSTRAINT "SecurityEvents_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX security_events_user_id_created_at ON "SecurityEvents" ("userId", "createdAt");

CREATE TABLE "Sessions" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "refreshTokenHash" varchar(64) NOT NULL,
    "userAgent" varchar(500),
    "ipAddress" varchar(45),
    "lastUsedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone NOT NULL,
    "revokedAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    CONSTRAINT "Sessions_pkey" PRIMARY KEY (id),
    CONSTRAINT "Sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX sessions_user_id ON "Sessions" ("userId");
CREATE INDEX sessions_refresh_token_hash ON "Sessions" ("refreshTokenHash");

CREATE TABLE "MfaChallenges" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "usedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone NOT NULL,
    "ipAddress" varchar(45),
    "createdAt" timestamp with time zone NOT NULL,
    CONSTRAINT "MfaChallenges_pkey" PRIMARY KEY (id)
);
CREATE INDEX mfa_challenges_user_id ON "MfaChallenges" ("userId");
