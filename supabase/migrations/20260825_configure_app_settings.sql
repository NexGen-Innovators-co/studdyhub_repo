-- =============================================================================
-- Migration: 20260825_configure_app_settings.sql
-- Purpose: Set app.settings required for pg_cron to call edge functions.
--
-- These settings are used by the generate-roadmap-cron schedule.
-- Update the values with your actual Supabase project URL and service role key.
-- =============================================================================

-- IMPORTANT: Replace the placeholder values below with your actual project values!
-- You can find them in: Supabase Dashboard → Settings → API

-- Set the Supabase project URL
ALTER DATABASE postgres SET "app.settings.supabase_url" TO 'https://vykidardmwtxwjtijjap.supabase.co';

-- Set the service role key (get from Supabase Dashboard → Settings → API → service_role)
-- IMPORTANT: Replace this with your actual service_role key!
ALTER DATABASE postgres SET "app.settings.service_role_key" TO 'YOUR_SERVICE_ROLE_KEY_HERE';
