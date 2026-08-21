CREATE TABLE public.forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_votes_target_chk CHECK (num_nonnulls(post_id, reply_id) = 1)
);

CREATE UNIQUE INDEX forum_votes_user_post_uidx ON public.forum_votes(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX forum_votes_user_reply_uidx ON public.forum_votes(user_id, reply_id) WHERE reply_id IS NOT NULL;

GRANT SELECT ON public.forum_votes TO anon;
GRANT SELECT, INSERT, DELETE ON public.forum_votes TO authenticated;
GRANT ALL ON public.forum_votes TO service_role;

ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum votes public read" ON public.forum_votes FOR SELECT USING (true);
CREATE POLICY "users insert own votes" ON public.forum_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own votes" ON public.forum_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_forum_vote_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
  v_reply uuid := coalesce(new.reply_id, old.reply_id);
begin
  if v_post is not null then
    update public.forum_posts p
      set upvotes = (select count(*) from public.forum_votes v where v.post_id = p.id)
      where p.id = v_post;
  end if;
  if v_reply is not null then
    update public.forum_replies r
      set upvotes = (select count(*) from public.forum_votes v where v.reply_id = r.id)
      where r.id = v_reply;
  end if;
  return null;
end; $$;

CREATE TRIGGER forum_votes_sync
AFTER INSERT OR DELETE ON public.forum_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_forum_vote_counts();