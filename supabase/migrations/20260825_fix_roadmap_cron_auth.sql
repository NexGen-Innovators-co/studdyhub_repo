-- =============================================================================
-- Migration: 20260825_fix_roadmap_cron_auth.sql
-- Purpose: Fix the generate-roadmap-cron edge function returning 401.
--
-- The cron was calling the edge function WITHOUT the required 'apikey' header.
-- Supabase Edge Functions require both 'apikey' and 'Authorization' headers.
-- Also ensures app.settings are configured for the service role key.
-- =============================================================================

-- Ensure the required app.settings exist
DO $$
BEGIN
    -- Set the service role key as an app setting if not already set
    PERFORM set_config('app.settings.service_role_key', current_setting('app.settings.service_role_key', true), false);
EXCEPTION WHEN OTHERS THEN
    -- Setting may not exist, try to create it
    NULL;
END $$;

-- First, remove any existing broken cron
SELECT cron.unschedule('generate-roadmap-next-week');

-- Re-create the cron with correct auth headers (including apikey!)
SELECT cron.schedule(
    'generate-roadmap-next-week',
    '0 */6 * * *',  -- Every 6 hours
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-roadmap-cron',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
            'apikey', current_setting('app.settings.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);
