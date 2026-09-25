-- Flyway callback: runs after every migrate (each Java boot), not versioned.
-- While the Node server is still in use as a fallback, its sync({ alter: true }) keeps
-- re-adding numbered duplicate UNIQUE constraints; this keeps the shared database clean.
-- Same logic as V2.

DO $$
DECLARE
    dup record;
BEGIN
    FOR dup IN
        SELECT rel.relname AS table_name, con.conname AS constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.contype = 'u'
          AND nsp.nspname = current_schema()
          AND rel.relname IN ('Users', 'Organizations', 'Monitors')
          AND con.conname ~ '^(Users_email|Organizations_slug|Monitors_heartbeatToken)_key[0-9]+$'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', dup.table_name, dup.constraint_name);
    END LOOP;
END $$;
