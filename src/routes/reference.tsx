import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, ExternalLink, Library } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getReference } from "@/lib/content.functions";

const referenceQuery = queryOptions({
  queryKey: ["reference"],
  queryFn: () => getReference(),
});

export const Route = createFileRoute("/reference")({
  loader: ({ context }) => context.queryClient.ensureQueryData(referenceQuery),
  head: () => ({
    meta: [
      { title: "Reference Hub — Curated docs for every language | Space" },
      {
        name: "description",
        content:
          "A curated directory of official documentation and trusted community resources for JavaScript, Python, Java, C++, C, TypeScript, Go and SQL.",
      },
      { property: "og:title", content: "Reference Hub — Curated docs | Space" },
      {
        property: "og:description",
        content: "Official docs and trusted community resources, filterable by language and source.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">The reference hub could not load. Please refresh.</p>
    </div>
  ),
  component: ReferencePage,
});

function ReferencePage() {
  const { data } = useSuspenseQuery(referenceQuery);
  const [query, setQuery] = useState("");
  const [langId, setLangId] = useState("all");
  const [source, setSource] = useState("all");

  const sources = useMemo(
    () => Array.from(new Set(data.links.map((l) => l.source).filter(Boolean) as string[])).sort(),
    [data.links],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.links.filter((l) => {
      if (langId !== "all" && l.language_id !== langId) return false;
      if (source !== "all" && l.source !== source) return false;
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        (l.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.links, query, langId, source]);

  const langPills = [{ id: "all", name: "All languages" }, ...data.languages];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full surface-tint px-3 py-1 text-xs font-semibold text-indigo-700">
            <Library className="size-3.5" /> Reference Hub
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-indigo-900 sm:text-5xl">
            Go straight to the source
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {data.links.length} hand-picked links to official documentation and the community
            resources worth your time.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="sticky top-16 z-30 mt-8 rounded-2xl border border-border/70 bg-background/85 p-4 backdrop-blur-md"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
              placeholder="Search resources…"
              aria-label="Search reference links"
              className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {langPills.map((l) => (
              <motion.button
                key={l.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLangId(l.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  langId === l.id
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "surface-tint text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                {l.name}
              </motion.button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {["all", ...sources].map((s) => (
              <motion.button
                key={s}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setSource(s)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  source === s
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-border/70 text-muted-foreground hover:bg-accent"
                }`}
              >
                {s === "all" ? "All sources" : s}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtered.length} resource{filtered.length === 1 ? "" : "s"}
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((l) => (
              <motion.a
                key={l.id}
                layout
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                whileHover={{ y: -4 }}
                className="bento-card group flex flex-col"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full surface-tint px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                    {l.source ?? "Resource"}
                  </span>
                  <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-indigo-600" />
                </div>
                <h2 className="mt-3 font-display text-base font-semibold text-indigo-900">
                  {l.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {l.description}
                </p>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No resources match your filters yet.
          </p>
        )}
      </main>
    </div>
  );
}
