import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion, useInView, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Library,
  Code2,
  Trophy,
  Medal,
  Rocket,
  PlayCircle,
  MessagesSquare,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getLandingData } from "@/lib/public.functions";

const landingQuery = queryOptions({
  queryKey: ["landing"],
  queryFn: () => getLandingData(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(landingQuery),
  head: () => ({
    meta: [
      { title: "Space — Get competition-ready in code" },
      {
        name: "description",
        content:
          "Space is the practice and competition platform for coding students: practice problems, CP zone, hackathons, courses and a forum.",
      },
      { property: "og:title", content: "Space — Get competition-ready in code" },
      {
        property: "og:description",
        content:
          "Practice problems, competitive programming, hackathons and courses for interview-ready students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Something went wrong loading Space. Please refresh.
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-sm text-muted-foreground">Page not found.</p>
    </div>
  ),
  component: Landing,
});

const features = [
  {
    icon: BookOpen,
    title: "Dictionary",
    desc: "Every term, syntax rule and concept explained with runnable examples.",
    span: "lg:col-span-2",
  },
  {
    icon: Library,
    title: "Reference Docs",
    desc: "Curated links to MDN, official docs and the answers that actually help.",
    span: "lg:col-span-2",
  },
  {
    icon: Code2,
    title: "Practice Questions",
    desc: "Graded problems across eight languages with hidden test cases.",
    span: "lg:col-span-2",
  },
  {
    icon: Trophy,
    title: "CP Zone",
    desc: "ICPC-style sets, timed rounds and editorial breakdowns.",
    span: "lg:col-span-3",
  },
  {
    icon: Medal,
    title: "Leaderboard",
    desc: "Climb the ranks with points earned from every accepted submission.",
    span: "lg:col-span-3",
  },
  {
    icon: Rocket,
    title: "Hackathons",
    desc: "Mini-hackathons, Saturday days and all-night build sessions.",
    span: "lg:col-span-2",
  },
  {
    icon: PlayCircle,
    title: "Video Courses",
    desc: "Structured tracks with lessons and practice checkpoints.",
    span: "lg:col-span-2",
  },
  {
    icon: MessagesSquare,
    title: "Forum",
    desc: "Ask, answer, and get unstuck with your cohort.",
    span: "lg:col-span-2",
  },
];

const testimonials = [
  {
    quote:
      "I went from failing every timed round to placing in our regional qualifier in one semester.",
    name: "Amara O.",
    role: "Year 3 · CS",
  },
  {
    quote: "The dictionary plus practice combo is the fastest feedback loop I've used.",
    name: "Deniz K.",
    role: "Year 2 · Software",
  },
  {
    quote: "Saturday-night hackathons are the reason our team actually ships.",
    name: "Ruth M.",
    role: "Year 4 · CS",
  },
];

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

function Landing() {
  const { data } = useSuspenseQuery(landingQuery);
  const stats = [
    { label: "Practice questions", value: data.stats.questions, suffix: "+" },
    { label: "Active students", value: data.stats.students, suffix: "+" },
    { label: "Hackathons hosted", value: data.stats.hackathons, suffix: "" },
    { label: "Languages supported", value: data.stats.languages, suffix: "" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[var(--gradient-hero)] opacity-70 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full surface-tint px-4 py-1.5 text-xs font-semibold text-indigo-700"
            >
              Built for interview prep and ICPC-style contests
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mx-auto mt-6 max-w-3xl text-4xl sm:text-6xl"
            >
              Become <span className="text-indigo-600">competition-ready</span>, one solved problem
              at a time.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
            >
              Space is where coding students train: graded practice, contest simulations, courses
              and a community that pushes you further than any tutorial can.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-9 flex flex-wrap items-center justify-center gap-3"
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700"
                >
                  Get started <ArrowRight className="size-4" />
                </Link>
              </motion.div>
              <motion.a
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-6 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
              >
                Explore practice problems
              </motion.a>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 gap-4 rounded-2xl border border-indigo-100 surface-tint p-6 sm:p-8 lg:grid-cols-4"
          >
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl font-extrabold text-indigo-700 sm:text-4xl">
                  <CountUp value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Features bento */}
        <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <h2 className="text-3xl sm:text-4xl">Everything you need in one workspace</h2>
            <p className="mt-3 text-muted-foreground">
              No more juggling ten tabs. Learn it, look it up, practice it, compete with it.
            </p>
          </motion.div>

          <div className="bento-grid mt-10">
            {features.map((f, i) => (
              <BentoCard key={f.title} className={f.span} delay={i * 0.05}>
                <div className="grid size-11 place-items-center rounded-xl surface-tint text-indigo-600">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </BentoCard>
            ))}
          </div>
        </section>

        {/* Upcoming hackathons */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl"
          >
            Upcoming hackathons
          </motion.h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events scheduled yet — check back soon.
              </p>
            ) : (
              data.events.map((e, i) => (
                <motion.article
                  key={e.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  whileHover={{ y: -6 }}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-colors hover:border-indigo-200"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-lg surface-tint px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    <CalendarDays className="size-3.5" />
                    {new Date(e.start_time).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <h3 className="mt-4 text-lg">{e.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.description}</p>
                  <p className="mt-4 text-xs font-medium text-muted-foreground">
                    {e.type} · {e.location ?? "Online"}
                  </p>
                </motion.article>
              ))
            )}
          </div>
        </section>

        {/* Why Space */}
        <section className="border-y border-border surface-tint">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl sm:text-4xl"
            >
              Why students stay
            </motion.h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <motion.blockquote
                  key={t.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="rounded-2xl border border-indigo-100 bg-card p-6 shadow-[var(--shadow-soft)]"
                >
                  <p className="text-sm leading-relaxed text-indigo-900">“{t.quote}”</p>
                  <footer className="mt-5 text-xs font-semibold text-muted-foreground">
                    {t.name} · {t.role}
                  </footer>
                </motion.blockquote>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-indigo-900">Space</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Practice. Compete. Get hired. © {new Date().getFullYear()}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-indigo-700">
              Features
            </a>
            <Link to="/auth" className="transition-colors hover:text-indigo-700">
              Sign in
            </Link>
            <Link to="/auth" className="transition-colors hover:text-indigo-700">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
