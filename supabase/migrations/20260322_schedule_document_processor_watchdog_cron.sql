-- Schedule document processor watchdog to run every 5 minutes
-- Uses PostgreSQL pg_cron extension with a wrapper function

-- Enable pg_cron extension (must be enabled on Supabase project)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to invoke the document-processor-watchdog Edge Function
CREATE OR REPLACE FUNCTION invoke_document_processor_watchdog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY_HERE>'
    ),
    body := jsonb_build_object(
      'trigger', 'scheduled',
      'timestamp', now()
    )::text,
    timeout_milliseconds := 1000
  );
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_document_processor_watchdog() TO postgres;

-- Schedule it every 5 minutes
SELECT cron.schedule('document-processor-watchdog', '*/5 * * * *', 'SELECT invoke_document_processor_watchdog();');
