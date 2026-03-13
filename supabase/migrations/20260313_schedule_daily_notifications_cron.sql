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
BEGIN
  PERFORM net.http_post(
    url := 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/daily-notifications-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'trigger', 'scheduled',
      'timestamp', now()
    )::text
  );
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
BEGIN
  PERFORM net.http_post(
    url := 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/scheduled-notifications-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'trigger', 'scheduled',
      'timestamp', now()
    )::text
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION invoke_scheduled_notifications_dispatcher() TO postgres;

-- Schedule the dispatcher to run every 5 minutes
-- pg_cron format: '*/5 * * * *' = every 5 minutes
SELECT cron.schedule('scheduled-notifications-dispatcher', '*/5 * * * *', 'SELECT invoke_scheduled_notifications_dispatcher();');
