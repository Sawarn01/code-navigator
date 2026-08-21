import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getSupabaseHealth } from "@/lib/health.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Space — Practice & Compete for Coding Interviews" },
      {
        name: "description",
        content:
          "Space is a practice and competition platform for coding students preparing for technical interviews and competitive programming contests.",
      },
      { property: "og:title", content: "Space — Practice & Compete for Coding Interviews" },
      {
        property: "og:description",
        content:
          "Practice problems, contests, courses and a community forum for students training for interviews and ICPC-style contests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchHealth = useServerFn(getSupabaseHealth);
  const { data, isLoading } = useQuery({ queryKey: ["supabase-health"], queryFn: () => fetchHealth() });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center rounded-full surface-tint px-3 py-1 text-xs font-semibold text-indigo-700">
            Phase 1 · Foundation
          </span>
          <h1 className="mt-5 text-4xl leading-tight sm:text-5xl">
            Space is scaffolded and connected.
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Design tokens, layout shell and the full database schema are in place. Pages arrive in
            the next phase.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700"
          >
            Continue to next phase
          </motion.button>
        </motion.div>

        <section className="bento-grid mt-14">
          <BentoCard className="lg:col-span-4" delay={0.05}>
            <h2 className="text-lg">Supabase connection</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live check against the seeded <code>languages</code> table.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm font-medium">
              <span
                className={`size-2.5 rounded-full ${
                  isLoading ? "bg-indigo-200" : data?.connected ? "bg-success" : "bg-destructive"
                }`}
              />
              <span className="text-indigo-700">
                {isLoading ? "Checking…" : (data?.message ?? "Unknown")}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(data?.languages ?? []).map((name) => (
                <motion.span
                  key={name}
                  whileHover={{ scale: 1.06 }}
                  className="rounded-lg surface-tint px-2.5 py-1 text-xs font-semibold text-indigo-700"
                >
                  {name}
                </motion.span>
              ))}
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-2" delay={0.12}>
            <h2 className="text-lg">Design system</h2>
            <p className="mt-1 text-sm text-muted-foreground">White surface, indigo scale, Inter.</p>
            <div className="mt-5 grid grid-cols-5 gap-1.5">
              {[
                "bg-indigo-100",
                "bg-indigo-300",
                "bg-indigo-500",
                "bg-indigo-700",
                "bg-indigo-900",
              ].map((c) => (
                <div key={c} className={`h-9 rounded-lg ${c}`} />
              ))}
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-3" delay={0.18}>
            <h2 className="text-lg">Schema ready</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Profiles, roles, languages, dictionary, references, questions, test cases,
              submissions, badges, forum, events and courses — all with row-level security.
            </p>
          </BentoCard>

          <BentoCard className="lg:col-span-3" delay={0.24}>
            <h2 className="text-lg">Next up</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Auth flows, dashboards, problem sets and the Judge0-powered code runner.
            </p>
          </BentoCard>
        </section>
      </main>
    </div>
  );
}
