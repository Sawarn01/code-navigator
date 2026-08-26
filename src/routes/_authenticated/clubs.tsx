import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Mail, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getClubs, joinClub, leaveClub } from "@/lib/clubs.functions";

export const Route = createFileRoute("/_authenticated/clubs")({
  head: () => ({
    meta: [
      { title: "Clubs — Space" },
      {
        name: "description",
        content: "Browse and join official college clubs on Space.",
      },
    ],
  }),
  component: ClubsPage,
});

function ClubsPage() {
  const fetchClubs = useServerFn(getClubs);
  const join = useServerFn(joinClub);
  const leave = useServerFn(leaveClub);
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clubs"],
    queryFn: () => fetchClubs(),
  });

  const membershipMutation = useMutation({
    mutationFn: (vars: { clubId: string; join: boolean }) =>
      vars.join
        ? join({ data: { clubId: vars.clubId } })
        : leave({ data: { clubId: vars.clubId } }),
    onSuccess: (_res, vars) => {
      toast.success(vars.join ? "You're in the club" : "You left the club");
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clubs = useMemo(() => {
    const list = data?.clubs ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-bold text-indigo-900">Clubs</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Official college clubs — join the ones you're into.
          </p>
        </motion.div>

        <div className="relative mt-6 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clubs"
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading clubs…</p>
        ) : clubs.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {data?.clubs.length ? "No clubs match your search." : "No clubs yet — check back soon."}
          </p>
        ) : (
          <div className="bento-grid mt-8">
            {clubs.map((c, i) => (
              <BentoCard key={c.id} delay={i * 0.04} className="lg:col-span-4">
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-bold text-indigo-900">{c.name}</h3>
                    {c.category && (
                      <span className="shrink-0 rounded-full surface-tint px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        {c.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {c.description ?? "No description yet."}
                  </p>
                  {c.meeting_info && (
                    <p className="mt-3 text-xs text-muted-foreground">{c.meeting_info}</p>
                  )}
                  {c.contact_email && (
                    <a
                      href={`mailto:${c.contact_email}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:underline"
                    >
                      <Mail className="size-3.5" /> {c.contact_email}
                    </a>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      disabled={membershipMutation.isPending}
                      onClick={() => membershipMutation.mutate({ clubId: c.id, join: !c.isMember })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                        c.isMember
                          ? "border border-input text-muted-foreground hover:bg-accent"
                          : "bg-primary text-primary-foreground hover:bg-indigo-700"
                      }`}
                    >
                      {c.isMember ? "Leave" : "Join club"}
                    </button>
                  </div>
                </div>
              </BentoCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
