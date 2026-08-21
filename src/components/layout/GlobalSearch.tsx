import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Code2, MessageSquare, PlayCircle, Search } from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/search.functions";

const ICONS = {
  term: BookOpen,
  question: Code2,
  post: MessageSquare,
  course: PlayCircle,
} as const;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const search = useServerFn(globalSearch);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const hits = data?.hits ?? [];

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    if (hit.kind === "term") navigate({ to: "/dictionary", search: { q: hit.title } as never });
    else if (hit.kind === "question")
      navigate({
        to: hit.subtitle?.includes("CP Zone") ? "/cp-zone" : "/practice",
        search: { lang: "all", q: hit.title } as never,
      });
    else if (hit.kind === "post") navigate({ to: "/forum/$postId", params: { postId: hit.id } });
    else navigate({ to: "/learn/$courseId", params: { courseId: hit.id } });
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search Space…"
        aria-label="Search terms, problems, threads and courses"
        className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-400"
      />
      <AnimatePresence>
        {open && debounced.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-auto rounded-2xl border border-border bg-card p-2 shadow-lg"
          >
            {isFetching && hits.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">Searching…</p>
            )}
            {!isFetching && hits.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">No matches.</p>
            )}
            {hits.map((hit) => {
              const Icon = ICONS[hit.kind];
              return (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  onClick={() => go(hit)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-indigo-900">{hit.title}</span>
                    {hit.subtitle && (
                      <span className="block truncate text-[11px] text-muted-foreground">{hit.subtitle}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
