-- Per-user theme preference, mirroring the leaderboard_opt_out pattern.
-- 'system' (the default) means "follow the OS/browser preference" and is
-- resolved client-side rather than stored as a resolved light/dark value.
ALTER TABLE public.profiles
  ADD COLUMN theme_preference text NOT NULL DEFAULT 'system'
  CHECK (theme_preference IN ('light', 'dark', 'system'));
