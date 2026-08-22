import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { MessagesSquare, ArrowBigUp, BadgeCheck, MessageCircle, PenLine, Tag } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { listForumPosts } from "@/lib/forum.functions";
import { useAuth } from "@/hooks/useAuth";

const forumQuery = queryOptions({
  queryKey: ["forum", "list"],
  queryFn: () => listForumPosts(),
});

export const Route = createFileRoute("/forum/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(forumQuery),
  head: () => ({
    meta: [
      { title: "Forum — Ask, debug and discuss algorithms | Space" },
      {
        name: "description",
        content:
          "Ask questions, share debugging help and discuss algorithms with other students preparing for interviews and contests.",
      },
      { property: "og:title", content: "Forum — Ask, debug and discuss | Space" },
      {
        property: "og:description",
        content: "Student discussions on algorithms, debugging and interview preparation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">The forum could not load. Please refresh.</p>
    </div>
  ),
  component: ForumIndex,
});

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diff / 36e5);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function ForumIndex() {
  const { data } = useSuspenseQuery(forumQuery);
  const { isAuthenticated } = useAuth();
  const [sort, setSort] = useState<"new" | "top">("new");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of data)
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const posts = useMemo(() => {
    const filtered = tagFilter ? data.filter((p) => p.tags.includes(tagFilter)) : data;
    const copy = [...filtered];
    copy.sort((a, b) =>
      sort === "top"
        ? b.upvotes - a.upvotes
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return copy;
  }, [data, sort, tagFilter]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full surface-tint px-3 py-1 text-xs font-semibold text-indigo-700">
              <MessagesSquare className="size-3.5" /> Forum
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-indigo-900">
              Get unstuck, together
            </h1>
            <p className="mt-2 text-muted-foreground">
              {data.length} discussion{data.length === 1 ? "" : "s"} from the Space community.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
            <Link
              to={isAuthenticated ? "/forum/new" : "/auth"}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700"
            >
              <PenLine className="size-4" />
              {isAuthenticated ? "New post" : "Sign in to post"}
            </Link>
          </motion.div>
        </motion.div>

        <div className="mt-8 inline-flex rounded-xl border border-border/70 p-1">
          {(["new", "top"] as const).map((option) => (
            <motion.button
              key={option}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setSort(option)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                sort === option
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "new" ? "Newest" : "Most upvoted"}
            </motion.button>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Tag className="size-3.5 text-muted-foreground" />
            {tags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter((t) => (t === tag ? null : tag))}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  tagFilter === tag
                    ? "bg-primary text-primary-foreground"
                    : "surface-tint text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                {tag} · {count}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <AnimatePresence mode="popLayout">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.24) }}
                whileHover={{ y: -3 }}
                className="bento-card"
              >
                <Link to="/forum/$postId" params={{ postId: post.id }} className="flex gap-4">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl surface-tint py-2">
                    <ArrowBigUp className="size-5 text-indigo-600" />
                    <span className="text-sm font-bold text-indigo-700">{post.upvotes}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold text-indigo-900">
                        {post.title}
                      </h2>
                      {post.accepted_reply_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <BadgeCheck className="size-3" /> Solved
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.body.replace(/[`*#]/g, "").slice(0, 180)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full surface-tint px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageCircle className="size-3.5" />
                        {post.reply_count}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {post.author?.full_name ?? "A student"} · {relativeTime(post.created_at)}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {posts.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {tagFilter
              ? `No posts tagged "${tagFilter}".`
              : "No posts yet — be the first to start a discussion."}
          </p>
        )}
      </main>
    </div>
  );
}
