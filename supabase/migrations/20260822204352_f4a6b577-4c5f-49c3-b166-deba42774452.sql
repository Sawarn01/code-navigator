-- Re-point the scheduled webhook jobs at the production domain
-- (codespaces.online) instead of the old preview URL. cron.schedule with an
-- existing job name updates that job in place rather than duplicating it,
-- so this supersedes the original schedules from 20260822042830 and
-- 20260822164216.
SELECT cron.schedule(
  'space-weekly-digest',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://codespaces.online/api/public/hooks/weekly-digest',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYmhsaWJ4c29kcWNqb2Zxc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjk1NDIsImV4cCI6MjEwMjkwNTU0Mn0.H7ju0cJlzsMsO8HInD_jVKNT3KH_kf65MHijd4BH2As"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'space-event-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://codespaces.online/api/public/hooks/event-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYmhsaWJ4c29kcWNqb2Zxc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjk1NDIsImV4cCI6MjEwMjkwNTU0Mn0.H7ju0cJlzsMsO8HInD_jVKNT3KH_kf65MHijd4BH2As"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);
