import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowBigUp, ArrowLeft, Trash2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Markdown } from "@/lib/markdown";
import { useAuth } from "@/hooks/useAuth";
import {
  getForumPost,
  getMyVotes,
  toggleVote,
  createForumReply,
  deleteForumPost,
  deleteForumReply,
  updateForumPost,
} from "@/lib/forum.functions";

const postQuery = (postId: string) =>
  queryOptions({
    queryKey: ["forum", "post", postId],
    queryFn: () => getForumPost({ data: { postId } }),
  });

export const Route = createFileRoute("/forum/$postId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(postQuery(params.postId)),
  head: () => ({
    meta: [
      { title: "Discussion — Space Forum" },
      {
        name: "description",
        content: "Read the full discussion and replies from the Space student community.",
      },
      { property: "og:title", content: "Discussion — Space Forum" },
      {
        property: "og:description",
        content: "Read the full discussion and replies from the Space student community.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">This discussion could not load.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">This discussion no longer exists.</p>
    </div>
  ),
  component: ForumPostPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ForumPostPage() {
  const { postId } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(postId));
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const vote = useServerFn(toggleVote);
  const reply = useServerFn(createForumReply);
  const removePost = useServerFn(deleteForumPost);
  const removeReply = useServerFn(deleteForumReply);
  const editPost = useServerFn(updateForumPost);

  const { data: myVotes } = useQuery({
    queryKey: ["forum", "votes", user?.id ?? "anon"],
    queryFn: () => getMyVotes(),
    enabled: isAuthenticated,
  });

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "" });

  const post = data.post;
  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">This discussion no longer exists.</p>
        </div>
      </div>
    );
  }

  const isAuthor = user?.id === post.user_id;
  const votedPost = myVotes?.posts.includes(post.id) ?? false;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["forum"] });
  }

  async function handleVote(target: { postId?: string; replyId?: string }) {
    if (!isAuthenticated) {
      toast.error("Sign in to upvote");
      return;
    }
    try {
      await vote({ data: target });
      await refresh();
    } catch {
      toast.error("Could not register your vote");
    }
  }

  async function handleReply() {
    if (body.trim().length < 2) {
      toast.error("Write a little more before posting");
      return;
    }
    setBusy(true);
    try {
      await reply({ data: { postId: post!.id, body } });
      setBody("");
      await refresh();
      toast.success("Reply posted");
    } catch {
      toast.error("Could not post your reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Link
          to="/forum"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700"
        >
          <ArrowLeft className="size-4" /> Back to forum
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="bento-card mt-5"
        >
          <div className="flex gap-4">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              whileHover={{ y: -2 }}
              onClick={() => handleVote({ postId: post.id })}
              aria-label="Upvote post"
              className={`flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-xl transition-colors ${
                votedPost
                  ? "bg-primary text-primary-foreground"
                  : "surface-tint text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              <ArrowBigUp className="size-5" />
              <span className="text-sm font-bold">{post.upvotes}</span>
            </motion.button>

            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3">
                  <input
                    value={draft.title}
                    maxLength={150}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="w-full rounded-xl border border-input px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  <textarea
                    value={draft.body}
                    maxLength={8000}
                    rows={8}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    className="w-full rounded-xl border border-input px-3 py-2 font-mono text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await editPost({ data: { postId: post.id, ...draft } });
                          setEditing(false);
                          await refresh();
                          toast.success("Post updated");
                        } catch {
                          toast.error("Could not update the post");
                        }
                      }}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-xl border border-input px-4 py-2 text-sm font-semibold text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-900">
                    {post.title}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {post.author?.full_name ?? "A student"} · {formatDate(post.created_at)}
                  </p>
                  <Markdown source={post.body} className="mt-4 text-sm text-foreground/90" />
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full surface-tint px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {isAuthor && (
                      <span className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft({ title: post.title, body: post.body });
                            setEditing(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent"
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await removePost({ data: { postId: post.id } });
                              await refresh();
                              navigate({ to: "/forum" });
                            } catch {
                              toast.error("Could not delete the post");
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-accent"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.article>

        <h2 className="mt-10 font-display text-lg font-semibold text-indigo-900">
          {data.replies.length} repl{data.replies.length === 1 ? "y" : "ies"}
        </h2>

        <div className="mt-4 space-y-4">
          <AnimatePresence initial={false}>
            {data.replies.map((r, index) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2) }}
                className="bento-card flex gap-4"
              >
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleVote({ replyId: r.id })}
                  aria-label="Upvote reply"
                  className={`flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-xl transition-colors ${
                    myVotes?.replies.includes(r.id)
                      ? "bg-primary text-primary-foreground"
                      : "surface-tint text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  <ArrowBigUp className="size-4" />
                  <span className="text-xs font-bold">{r.upvotes}</span>
                </motion.button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {r.author?.full_name ?? "A student"} · {formatDate(r.created_at)}
                  </p>
                  <Markdown source={r.body} className="mt-1 text-sm text-foreground/90" />
                  {user?.id === r.user_id && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await removeReply({ data: { replyId: r.id } });
                          await refresh();
                        } catch {
                          toast.error("Could not delete the reply");
                        }
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-destructive"
                    >
                      <Trash2 className="size-3" /> Delete
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="bento-card mt-8"
        >
          {isAuthenticated ? (
            <>
              <h3 className="font-display text-base font-semibold text-indigo-900">
                Add your reply
              </h3>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Share what worked for you… markdown supported"
                className="mt-3 w-full rounded-xl border border-input px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                disabled={busy}
                onClick={handleReply}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
              >
                <Send className="size-4" /> {busy ? "Posting…" : "Post reply"}
              </motion.button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to="/auth" className="font-semibold text-indigo-700 underline">
                Sign in
              </Link>{" "}
              to reply and upvote.
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
