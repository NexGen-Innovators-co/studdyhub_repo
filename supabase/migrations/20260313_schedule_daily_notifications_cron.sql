-- Schedule daily notifications engine to run at 6 AM UTC every day
-- Uses PostgreSQL pg_cron extension with a wrapper function

-- Enable pg_cron extension (must be enabled on Supabase project)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to invoke the daily notifications edge function
CREATE OR REPLACE FUNCTION invoke_daily_notifications_engine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_url text := 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/daily-notifications-engine';
  payload text := jsonb_build_object('trigger', 'scheduled', 'timestamp', now())::text;
  headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
  );
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='net' AND p.proname='http_post') THEN
    PERFORM net.http_post(target_url, headers, payload);
  ELSIF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE p.proname='http_post') THEN
    PERFORM http_post(target_url, payload, 'application/json');
  ELSE
    RAISE NOTICE 'No pg_net/http_post function found - cannot invoke daily-notifications-engine';
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION invoke_daily_notifications_engine() TO postgres;

-- Schedule the function to run at 6 AM UTC daily
-- Standard pg_cron format: minute (0-59), hour (0-23), day of month, month, day of week
SELECT cron.schedule('daily-notifications-engine', '0 6 * * *', 'SELECT invoke_daily_notifications_engine();');

-- ============================================================================
-- Scheduled Notifications Dispatcher (NEW)
-- ============================================================================
-- Create a function to invoke the dispatcher which sends due notifications every 5 minutes

CREATE OR REPLACE FUNCTION invoke_scheduled_notifications_dispatcher()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_url text := 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/scheduled-notifications-dispatcher';
  payload text := jsonb_build_object('trigger', 'scheduled', 'timestamp', now())::text;
  headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
  );
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='net' AND p.proname='http_post') THEN
    PERFORM net.http_post(target_url, headers, payload);
  ELSIF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE p.proname='http_post') THEN
    PERFORM http_post(target_url, payload, 'application/json');
  ELSE
    RAISE NOTICE 'No pg_net/http_post function found - cannot invoke scheduled-notifications-dispatcher';
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION invoke_scheduled_notifications_dispatcher() TO postgres;

-- Schedule the dispatcher to run every 5 minutes
-- pg_cron format: '*/5 * * * *' = every 5 minutes
SELECT cron.schedule('scheduled-notifications-dispatcher', '*/5 * * * *', 'SELECT invoke_scheduled_notifications_dispatcher();');
