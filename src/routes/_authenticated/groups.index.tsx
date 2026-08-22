import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Lock, Plus, Search, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { createGroup, joinGroup, listGroups, getGroupsLeaderboard } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "Study groups — Space" },
      {
        name: "description",
        content: "Browse and join study groups on Space to practice algorithms together.",
      },
      { property: "og:title", content: "Study groups — Space" },
      {
        property: "og:description",
        content: "Browse and join study groups on Space to practice algorithms together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const fetchGroups = useServerFn(listGroups);
  const create = useServerFn(createGroup);
  const join = useServerFn(joinGroup);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["study-groups"],
    queryFn: () => fetchGroups(),
  });
  const { data: groupsLeaderboard } = useQuery({
    queryKey: ["groups-leaderboard"],
    queryFn: () => getGroupsLeaderboard(),
  });

  const createMutation = useMutation({
    mutationFn: () => create({ data: { name, description, is_public: isPublic } }),
    onSuccess: (res) => {
      toast.success("Group created");
      setShowForm(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["study-groups"] });
      navigate({ to: "/groups/$groupId", params: { groupId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinMutation = useMutation({
    mutationFn: (vars: { groupId?: string; code?: string }) => join({ data: vars }),
    onSuccess: (res) => {
      toast.success("You're in");
      queryClient.invalidateQueries({ queryKey: ["study-groups"] });
      navigate({ to: "/groups/$groupId", params: { groupId: res.groupId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const list = data?.groups ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q),
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
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-3xl font-bold text-indigo-900">Study groups</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Practice with a squad — shared leaderboards, discussion, and accountability.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
          >
            <Plus className="size-4" /> Create group
          </motion.button>
        </motion.div>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search groups"
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Invite code"
              className="w-36 rounded-xl border border-input bg-background px-3 py-2.5 text-sm uppercase outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              disabled={!code.trim() || joinMutation.isPending}
              onClick={() => joinMutation.mutate({ code })}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-accent disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 className="text-sm font-semibold text-indigo-900">New study group</h2>
            <div className="mt-4 grid gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What will this group work on?"
                className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
              />
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                Public — anyone can find and join this group
              </label>
              <div>
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
                >
                  {createMutation.isPending ? "Creating…" : "Create group"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {(groupsLeaderboard ?? []).length > 0 && (
          <BentoCard className="mt-8">
            <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-indigo-900">
              <Trophy className="size-4" /> Top groups
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ranked by combined member points — public groups only.
            </p>
            <ol className="mt-4 space-y-1.5">
              {(groupsLeaderboard ?? []).slice(0, 10).map((g, i) => (
                <li
                  key={g.groupId}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-accent/60"
                >
                  <span className="font-medium text-indigo-900">
                    {i + 1}. {g.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {g.totalPoints} pts · {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          </BentoCard>
        )}

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading groups…</p>
        ) : groups.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No groups match your search yet.</p>
        ) : (
          <div className="bento-grid mt-8">
            {groups.map((g, i) => {
              const joined = (data?.myGroupIds ?? []).includes(g.id);
              return (
                <BentoCard
                  key={g.id}
                  delay={i * 0.04}
                  className={i % 5 === 0 ? "lg:col-span-6" : "lg:col-span-4"}
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-bold text-indigo-900">{g.name}</h3>
                      {!g.is_public && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                          <Lock className="size-3" /> Private
                        </span>
                      )}
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {g.description ?? "No description yet."}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {joined ? `${data?.counts[g.id] ?? 1} member(s)` : "Members hidden"}
                      </span>
                      {joined ? (
                        <Link
                          to="/groups/$groupId"
                          params={{ groupId: g.id }}
                          className="rounded-lg surface-tint px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Open group
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={joinMutation.isPending}
                          onClick={() => joinMutation.mutate({ groupId: g.id })}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
                        >
                          Join group
                        </button>
                      )}
                    </div>
                  </div>
                </BentoCard>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
