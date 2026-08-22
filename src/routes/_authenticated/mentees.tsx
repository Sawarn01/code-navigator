import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { Flame, NotebookPen, Trophy } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { addMentorNote, listMentorNotes, listMyMentees } from "@/lib/mentorship.functions";

export const Route = createFileRoute("/_authenticated/mentees")({
  head: () => ({
    meta: [
      { title: "My mentees — Space" },
      { name: "description", content: "Track assigned students, their progress, and private mentor notes." },
      { property: "og:title", content: "My mentees — Space" },
      {
        property: "og:description",
        content: "Track assigned students, their progress, and private mentor notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenteesPage,
});

function MenteesPage() {
  const fetchMentees = useServerFn(listMyMentees);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-mentees"],
    queryFn: () => fetchMentees(),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">My mentees</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Students assigned to you by an admin. Notes here are private to you and admins.
          </p>
        </motion.div>

        {error ? (
          <p className="mt-8 text-sm text-destructive">
            You need the manager or admin role to view mentees.
          </p>
        ) : isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading mentees…</p>
        ) : (data ?? []).length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No mentees assigned yet. An admin can pair you with students from the admin panel.
          </p>
        ) : (
          <div className="bento-grid mt-8">
            {(data ?? []).map((m, i) => (
              <BentoCard key={m.id} delay={i * 0.05} className="lg:col-span-6">
                <MenteeCard mentee={m} />
              </BentoCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

type Mentee = NonNullable<Awaited<ReturnType<typeof listMyMentees>>>[number];

function MenteeCard({ mentee }: { mentee: Mentee }) {
  const fetchNotes = useServerFn(listMentorNotes);
  const saveNote = useServerFn(addMentorNote);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["mentor-notes", mentee.id],
    queryFn: () => fetchNotes({ data: { studentId: mentee.id } }),
  });

  const mutation = useMutation({
    mutationFn: () => saveNote({ data: { studentId: mentee.id, note } }),
    onSuccess: () => {
      setNote("");
      toast.success("Note saved (private)");
      queryClient.invalidateQueries({ queryKey: ["mentor-notes", mentee.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/profile/$userId"
          params={{ userId: mentee.id }}
          className="font-display text-lg font-bold text-indigo-900 hover:underline"
        >
          {mentee.full_name ?? "Unnamed student"}
        </Link>
        <div className="flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full surface-tint px-2 py-1 font-semibold text-indigo-700">
            <Trophy className="size-3" /> {mentee.points} pts
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
            <Flame className="size-3" /> {mentee.streak}d streak
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{mentee.solved} accepted submissions</p>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent activity</p>
        {mentee.recent.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {mentee.recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{s.question_title ?? "Problem"}</span>
                <span
                  className={
                    s.status === "accepted"
                      ? "text-xs font-semibold text-emerald-600"
                      : "text-xs font-semibold text-muted-foreground"
                  }
                >
                  {s.status ?? "pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <NotebookPen className="size-3.5" /> Private notes
        </p>
        <ul className="mt-2 space-y-2">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="rounded-xl surface-tint px-3 py-2 text-sm text-indigo-900">
              {n.note}
            </li>
          ))}
        </ul>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add a private observation…"
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="button"
          disabled={!note.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
        >
          Save note
        </button>
      </div>
    </div>
  );
}
