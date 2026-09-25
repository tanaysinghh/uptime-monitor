-- Sequelize's sync({ alter: true }) re-adds every UNIQUE constraint on each boot
-- without dropping the old one, so long-lived dev databases accumulate
-- "Users_email_key1" .. "Users_email_keyN" (and the same for Organizations.slug and
-- Monitors.heartbeatToken). Each duplicate is a redundant index that slows writes.
-- Keep the canonical "<Table>_<column>_key" constraint and drop the numbered copies.
-- A no-op on fresh databases created from V1.

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
