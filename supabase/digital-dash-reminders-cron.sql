-- Run once in the Supabase SQL editor AFTER deploying the dash-push function.
-- Replace <PROJECT_REF> and <CRON_SECRET> (the same value you set as the function's CRON_SECRET secret).
-- It calls dash-push every minute so due reminders go out within about a minute.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'digital-dash-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dash-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{"action":"run"}'::jsonb
  );
  $$
);
-- To stop it later: SELECT cron.unschedule('digital-dash-reminders');
