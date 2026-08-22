-- Accepted-answer marking. Tag filtering needs no schema change — forum_posts
-- already has tags text[]. No new RLS policy needed either: the existing
-- "users update own posts" policy (author-or-staff) already covers writes to
-- this new column since RLS is row-level, not column-level.
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS accepted_reply_id uuid
  REFERENCES public.forum_replies(id) ON DELETE SET NULL;
