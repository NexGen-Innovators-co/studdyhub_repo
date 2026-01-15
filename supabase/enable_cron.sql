-- Enable the pg_cron extension to schedule jobs
create extension if not exists pg_cron;

-- Schedule the check-schedule-reminders function to run every minute
select
  cron.schedule(
    'check-reminders-every-minute', -- name of the job
    '* * * * *',                    -- every minute
    $$
    select
      net.http_post(
        url:='https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/check-schedule-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- To verify the job is scheduled
select * from cron.job;

-- Note: You must replace YOUR_SERVICE_ROLE_KEY with your actual service role key
-- You can find this in Project Settings > API > service_role (secret)
