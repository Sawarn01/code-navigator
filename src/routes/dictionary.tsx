import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getDictionary } from "@/lib/content.functions";

const dictionaryQuery = queryOptions({
  queryKey: ["dictionary"],
  queryFn: () => getDictionary(),
});

export const Route = createFileRoute("/dictionary")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dictionaryQuery),
  head: () => ({
    meta: [
      { title: "Dictionary — Programming terms explained | Space" },
      {
        name: "description",
        content:
          "A searchable glossary of programming terms across JavaScript, Python, Java, C++, C, TypeScript, Go, SQL and general computer science.",
      },
      { property: "og:title", content: "Dictionary — Programming terms explained | Space" },
      {
        property: "og:description",
        content: "Search hundreds of accurate programming definitions with code examples.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">The dictionary could not load. Please refresh.</p>
    </div>
  ),
  component: DictionaryPage,
});

function DictionaryPage() {
  const { data } = useSuspenseQuery(dictionaryQuery);
  const [query, setQuery] = useState("");
  const [langId, setLangId] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.terms.filter((t) => {
      const matchesLang =
        langId === "all" ||
        (langId === "general" ? t.language_id === null : t.language_id === langId);
      if (!matchesLang) return false;
      if (!q) return true;
      return (
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [data.terms, query, langId]);

  const pills = [
    { id: "all", name: "All" },
    ...data.languages.map((l) => ({ id: l.id, name: l.name })),
    { id: "general", name: "General CS" },
  ];

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
            <BookOpen className="size-3.5" /> Dictionary
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-indigo-900 sm:text-5xl">
            Every term, explained clearly
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {data.terms.length} definitions across languages and core computer science — each with a
            minimal working example.
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
              placeholder="Search terms, definitions or tags…"
              aria-label="Search dictionary"
              className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pills.map((p) => {
              const active = langId === p.id;
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLangId(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "surface-tint text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  {p.name}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </p>

        <div className="mt-4 columns-1 gap-5 sm:columns-2 lg:columns-3">
          <AnimatePresence mode="popLayout">
            {filtered.slice(0, 120).map((t) => (
              <motion.article
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                whileHover={{ y: -4 }}
                className="bento-card mb-5 inline-block w-full break-inside-avoid"
              >
                <h2 className="font-display text-lg font-semibold text-indigo-900">{t.term}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.definition}</p>
                {t.example_code && (
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[12px] leading-relaxed">
                    <code className="font-mono text-indigo-900">{t.example_code}</code>
                  </pre>
                )}
                {t.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full surface-tint px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No terms match “{query}”. Try a different search or filter.
          </p>
        )}
        {filtered.length > 120 && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Showing the first 120 matches — refine your search to narrow it down.
          </p>
        )}
      </main>
    </div>
  );
}
