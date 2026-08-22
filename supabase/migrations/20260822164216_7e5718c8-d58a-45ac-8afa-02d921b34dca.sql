-- Hourly check for events starting in ~24h; the reminder route itself
-- dedupes via event_registrations.reminder_sent_at, same apikey-header
-- auth pattern as the existing space-weekly-digest job.
SELECT cron.schedule(
  'space-event-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6a8a41d5-f3a6-4769-a2e5-bd27fa8d98b6.lovable.app/api/public/hooks/event-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYmhsaWJ4c29kcWNqb2Zxc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjk1NDIsImV4cCI6MjEwMjkwNTU0Mn0.H7ju0cJlzsMsO8HInD_jVKNT3KH_kf65MHijd4BH2As"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);
