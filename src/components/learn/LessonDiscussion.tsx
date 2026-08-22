import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowBigUp, Download, MessageSquare, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  deleteLessonComment,
  getLessonThread,
  getMyCommentVotes,
  postLessonComment,
  toggleCommentVote,
} from "@/lib/course-social.functions";

function initials(name: string | null) {
  return (name ?? "Space learner")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LessonDiscussion({
  lessonId,
  currentUserId,
}: {
  lessonId: string;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const fetchThread = useServerFn(getLessonThread);
  const fetchVotes = useServerFn(getMyCommentVotes);
  const submitComment = useServerFn(postLessonComment);
  const removeComment = useServerFn(deleteLessonComment);
  const vote = useServerFn(toggleCommentVote);
  const [body, setBody] = useState("");

  const { data } = useQuery({
    queryKey: ["lesson-thread", lessonId],
    queryFn: () => fetchThread({ data: { lessonId } }),
  });

  const { data: votes } = useQuery({
    queryKey: ["lesson-comment-votes"],
    queryFn: () => fetchVotes(),
    enabled: Boolean(currentUserId),
  });
  const votedIds = new Set(votes?.commentIds ?? []);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["lesson-thread", lessonId] });
    queryClient.invalidateQueries({ queryKey: ["lesson-comment-votes"] });
  };

  const post = useMutation({
    mutationFn: async () => submitComment({ data: { lessonId, body } }),
    onSuccess: () => {
      setBody("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (commentId: string) => vote({ data: { commentId } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (commentId: string) => removeComment({ data: { commentId } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const resources = data?.resources ?? [];
  const comments = data?.comments ?? [];

  return (
    <div className="space-y-6">
      {resources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-indigo-100 bg-card p-4 shadow-[var(--shadow-soft)]"
        >
          <h3 className="text-sm font-semibold text-indigo-900">Lesson resources</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {resources.map((r) => (
              <li key={r.id}>
                <motion.a
                  whileHover={{ scale: 1.01 }}
                  href={r.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50/60"
                >
                  <Download className="size-4 shrink-0" />
                  <span className="truncate">{r.title}</span>
                  <span className="ml-auto rounded surface-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    {r.type}
                  </span>
                </motion.a>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-indigo-100 bg-card p-4 shadow-[var(--shadow-soft)]"
      >
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-900">
          <MessageSquare className="size-4" /> Q&amp;A · {comments.length}
        </h3>

        {currentUserId ? (
          <div className="mt-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Ask a question about this lesson…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={!body.trim() || post.isPending}
              onClick={() => post.mutate()}
              className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-50"
            >
              Post question
            </motion.button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Sign in to join the discussion.</p>
        )}

        <ul className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-3 rounded-xl border border-border p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full surface-tint text-xs font-bold text-indigo-700">
                  {initials(c.author_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-900">
                    {c.author_name ?? "Space learner"}
                    {c.is_instructor && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        <ShieldCheck className="size-3" /> Instructor
                      </span>
                    )}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
                  {currentUserId === c.user_id && (
                    <button
                      onClick={() => del.mutate(c.id)}
                      className="mt-1 text-[11px] text-muted-foreground hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  disabled={!currentUserId}
                  onClick={() => toggle.mutate(c.id)}
                  className={`flex h-fit shrink-0 flex-col items-center rounded-xl border px-2 py-1 text-xs font-semibold transition-colors ${
                    votedIds.has(c.id)
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-border text-muted-foreground hover:border-indigo-200 hover:text-indigo-700"
                  }`}
                >
                  <ArrowBigUp className="size-4" />
                  {c.upvotes}
                </motion.button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {comments.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            No questions yet — be the first to ask.
          </p>
        )}
      </motion.div>
    </div>
  );
}
