import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Your profile — Space" },
      {
        name: "description",
        content: "Points, rank, badges, recent submissions and languages practiced on Space.",
      },
      { property: "og:title", content: "Profile — Space" },
      {
        property: "og:description",
        content: "Points, rank, badges and recent submissions on Space.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const difficultyTone: Record<string, string> = {
  easy: "bg-indigo-50 text-indigo-700",
  medium: "bg-indigo-100 text-indigo-800",
  hard: "bg-indigo-200 text-indigo-900",
};

function ProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/profile/$userId" });
  const fetchProfile = useServerFn(getProfile);
  const saveProfile = useServerFn(updateProfile);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", bio: "", avatar_url: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile({ data: { userId } }),
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form) => saveProfile({ data: values }),
    onSuccess: () => {
      toast.success("Profile updated");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profile = data?.profile;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const solvedToday = data?.lastActiveDate === todayUtc;
  const initials = (profile?.full_name ?? "Space Student")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        ) : (
          <section className="bento-grid">
            <BentoCard className="lg:col-span-4">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl surface-tint font-display text-2xl font-bold text-indigo-700">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`${profile.full_name ?? "Student"} avatar`}
                      className="size-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-2xl">{profile?.full_name ?? "Space student"}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile?.bio ?? "No bio yet — tell the community what you're training for."}
                  </p>
                  {data?.isOwner && !editing && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => {
                        setForm({
                          full_name: profile?.full_name ?? "",
                          bio: profile?.bio ?? "",
                          avatar_url: profile?.avatar_url ?? "",
                        });
                        setEditing(true);
                      }}
                      className="mt-4 rounded-xl surface-tint px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      Edit profile
                    </motion.button>
                  )}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {editing && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 space-y-3 overflow-hidden"
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutation.mutate(form);
                    }}
                  >
                    <input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      maxLength={100}
                      placeholder="Full name"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                    />
                    <input
                      value={form.avatar_url}
                      onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                      maxLength={500}
                      placeholder="Avatar image URL"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                    />
                    <textarea
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      maxLength={500}
                      rows={3}
                      placeholder="Short bio"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {mutation.isPending ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-xl border border-input px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </BentoCard>

            <BentoCard className="lg:col-span-2" delay={0.06}>
              <p className="text-sm font-medium text-muted-foreground">Total points</p>
              <p className="mt-3 font-display text-6xl font-extrabold text-indigo-600">
                {profile?.points ?? 0}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">Earned across practice and CP</p>
            </BentoCard>

            <BentoCard className="lg:col-span-2" delay={0.1}>
              <p className="text-sm font-medium text-muted-foreground">Current rank</p>
              <p className="mt-3 font-display text-4xl font-bold text-indigo-900">#{data?.rank}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                of {data?.totalUsers} students on Space
              </p>
            </BentoCard>

            <BentoCard className="lg:col-span-2" delay={0.12}>
              <p className="text-sm font-medium text-muted-foreground">Current streak</p>
              <div className="mt-3 flex items-baseline gap-2">
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="font-display text-5xl font-extrabold text-indigo-600"
                >
                  {data?.streak ?? 0}
                </motion.span>
                <span className="text-sm font-semibold text-indigo-700">
                  day{(data?.streak ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {solvedToday
                  ? "Solved today — streak is safe."
                  : "Solve one today to keep your streak."}
              </p>
              {!solvedToday && (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-4">
                  <Link
                    to="/practice"
                    search={{}}
                    className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-indigo-700"
                  >
                    Practice now
                  </Link>
                </motion.div>
              )}
            </BentoCard>

            <BentoCard className="lg:col-span-4" delay={0.16}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg">Activity</h2>
                <span className="text-xs text-muted-foreground">Last 26 weeks</span>
              </div>
              <div className="mt-4">
                <ActivityHeatmap days={data?.activity ?? []} />
              </div>
            </BentoCard>

            <BentoCard className="lg:col-span-4" delay={0.14}>
              <h2 className="text-lg">Badges earned</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {(data?.badges ?? []).map((b) => (
                  <motion.div
                    key={b.id}
                    whileHover={{ scale: 1.08, y: -3 }}
                    title={`${b.name} — ${b.description ?? ""}`}
                    className={`grid size-16 place-items-center rounded-2xl border text-center text-[10px] font-semibold leading-tight ${
                      b.earned
                        ? "border-indigo-200 surface-tint text-indigo-700"
                        : "border-border bg-muted text-muted-foreground opacity-60"
                    }`}
                  >
                    {b.name}
                  </motion.div>
                ))}
              </div>
            </BentoCard>

            <BentoCard className="lg:col-span-2" delay={0.18}>
              <h2 className="text-lg">Languages practiced</h2>
              <div className="mt-4 space-y-3">
                {(data?.languageProgress ?? []).map((l) => (
                  <div key={l.name}>
                    <div className="flex justify-between text-xs font-medium text-indigo-900">
                      <span>{l.name}</span>
                      <span className="text-muted-foreground">{l.solved} solved</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.min(l.solved * 6, 100)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard className="lg:col-span-6" delay={0.22}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg">Recent submissions</h2>
                {data?.usingSampleData && (
                  <span className="text-xs text-muted-foreground">Sample data</span>
                )}
              </div>
              <div className="mt-4 divide-y divide-border">
                {(data?.submissions ?? []).map((s) => (
                  <motion.div
                    key={s.id}
                    whileHover={{ x: 4 }}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-indigo-900">
                        {s.question_title ?? "Untitled question"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.language ?? "—"} · {new Date(s.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                          difficultyTone[s.difficulty ?? "easy"] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.difficulty ?? "—"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                          s.status === "Accepted"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {s.status ?? "Pending"}
                      </span>
                      <span className="w-12 text-right text-sm font-bold text-indigo-600">
                        +{s.points_awarded}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </BentoCard>
          </section>
        )}
      </main>
    </div>
  );
}
