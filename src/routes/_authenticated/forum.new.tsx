import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, PenLine } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Markdown } from "@/lib/markdown";
import { createForumPost } from "@/lib/forum.functions";

export const Route = createFileRoute("/_authenticated/forum/new")({
  head: () => ({
    meta: [
      { title: "New discussion — Space Forum" },
      {
        name: "description",
        content: "Start a new discussion: ask a question, share a bug or discuss an algorithm.",
      },
      { property: "og:title", content: "New discussion — Space Forum" },
      {
        property: "og:description",
        content: "Start a new discussion on the Space student forum.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewPostPage,
});

function NewPostPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createForumPost);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = tagInput
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);

  async function handleSubmit() {
    setError(null);
    if (title.trim().length < 5) return setError("Give your post a clearer title (5+ characters).");
    if (body.trim().length < 10) return setError("Add a bit more detail (10+ characters).");

    setBusy(true);
    try {
      const result = await create({ data: { title, body, tags } });
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
      toast.success("Post published");
      navigate({ to: "/forum/$postId", params: { postId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish your post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <Link
          to="/forum"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700"
        >
          <ArrowLeft className="size-4" /> Back to forum
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mt-5 flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-indigo-900"
        >
          <PenLine className="size-6 text-indigo-600" /> Start a discussion
        </motion.h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="bento-card space-y-4"
          >
            <div>
              <label htmlFor="title" className="text-xs font-semibold text-indigo-900">
                Title
              </label>
              <input
                id="title"
                value={title}
                maxLength={150}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Why does my DP solution time out?"
                className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="body" className="text-xs font-semibold text-indigo-900">
                Body <span className="font-normal text-muted-foreground">(markdown supported)</span>
              </label>
              <textarea
                id="body"
                value={body}
                rows={14}
                maxLength={8000}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Describe what you tried…\n\n```python\nprint('code blocks work')\n```"}
                className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 font-mono text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="tags" className="text-xs font-semibold text-indigo-900">
                Tags <span className="font-normal text-muted-foreground">(comma separated, max 5)</span>
              </label>
              <input
                id="tags"
                value={tagInput}
                maxLength={120}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="dp, python, performance"
                className="mt-1.5 w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full surface-tint px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              disabled={busy}
              onClick={handleSubmit}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Publishing…" : "Publish post"}
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="bento-card"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live preview
            </p>
            <h2 className="mt-3 font-display text-xl font-bold text-indigo-900">
              {title || "Your title appears here"}
            </h2>
            <Markdown
              source={body || "_Start typing to see your formatted post._"}
              className="mt-3 text-sm text-foreground/90"
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
