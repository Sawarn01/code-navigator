import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { Copy, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { Markdown } from "@/lib/markdown";
import { getGroup, joinGroup, leaveGroup, postToGroup, replyInGroup } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Study group — Space" },
      { name: "description", content: "Group leaderboard, members, and discussion on Space." },
      { property: "og:title", content: "Study group — Space" },
      {
        property: "og:description",
        content: "Group leaderboard, members, and discussion on Space.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const fetchGroup = useServerFn(getGroup);
  const join = useServerFn(joinGroup);
  const leave = useServerFn(leaveGroup);
  const post = useServerFn(postToGroup);
  const reply = useServerFn(replyInGroup);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["study-group", groupId],
    queryFn: () => fetchGroup({ data: { groupId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["study-group", groupId] });

  const joinMutation = useMutation({
    mutationFn: () => join({ data: { groupId } }),
    onSuccess: () => {
      toast.success("Joined the group");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leave({ data: { groupId } }),
    onSuccess: () => {
      toast.success("You left the group");
      queryClient.invalidateQueries({ queryKey: ["study-groups"] });
      navigate({ to: "/groups" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postMutation = useMutation({
    mutationFn: () => post({ data: { groupId, body } }),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: (postId: string) => reply({ data: { groupId, postId, body: replyBody } }),
    onSuccess: () => {
      setReplyBody("");
      setReplyTo(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="mx-auto max-w-6xl px-4 pt-10 text-sm text-muted-foreground">Loading group…</p>
      </div>
    );
  }

  const group = data?.group;
  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="mx-auto max-w-6xl px-4 pt-10 text-sm text-muted-foreground">
          This group does not exist or is private.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/groups" className="text-xs font-semibold text-indigo-700 hover:underline">
            ← All groups
          </Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-indigo-900">{group.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {group.description ?? "No description yet."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {data?.isMember ? (
              <>
                {group.invite_code && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(group.invite_code ?? "");
                      toast.success("Invite code copied");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl surface-tint px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Copy className="size-3.5" /> Invite code: {group.invite_code}
                  </button>
                )}
                <button
                  type="button"
                  disabled={leaveMutation.isPending}
                  onClick={() => leaveMutation.mutate()}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-60"
                >
                  Leave group
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={joinMutation.isPending}
                onClick={() => joinMutation.mutate()}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
              >
                Join to see members and discussion
              </button>
            )}
          </div>
        </motion.div>

        {data?.isMember && (
          <div className="bento-grid mt-8">
            <BentoCard className="lg:col-span-4">
              <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-indigo-900">
                <Users className="size-4" /> Members
              </h2>
              <ul className="mt-4 space-y-2.5">
                {data.members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to="/profile/$userId"
                      params={{ userId: m.user_id }}
                      className="font-medium text-indigo-900 hover:underline"
                    >
                      {m.full_name ?? "Unnamed"}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {m.role === "owner" ? "Owner · " : ""}
                      {m.points} pts
                    </span>
                  </li>
                ))}
              </ul>
            </BentoCard>

            <BentoCard className="lg:col-span-8">
              <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-indigo-900">
                <Trophy className="size-4" /> Group leaderboard
              </h2>
              {data.leaders.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No ranked points in this group yet — solve a problem to get on the board.
                </p>
              ) : (
                <table className="mt-4 w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3 font-semibold">#</th>
                      <th className="pb-2 pr-3 font-semibold">Student</th>
                      <th className="pb-2 pr-3 font-semibold">Points</th>
                      <th className="pb-2 pr-3 font-semibold">Solved</th>
                      <th className="pb-2 font-semibold">Badges</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.leaders.map((row, i) => (
                      <tr key={row.user_id} className="transition-colors hover:bg-accent/60">
                        <td className="py-2.5 pr-3 font-semibold text-indigo-700">{i + 1}</td>
                        <td className="py-2.5 pr-3 font-medium text-indigo-900">
                          {row.full_name ?? "Unnamed"}
                        </td>
                        <td className="py-2.5 pr-3">{row.points}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{row.solved_count}</td>
                        <td className="py-2.5 text-muted-foreground">{row.badge_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </BentoCard>

            <BentoCard className="lg:col-span-12">
              <h2 className="font-display text-lg font-bold text-indigo-900">Discussion</h2>
              <div className="mt-4">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Share a problem, a hint, or a meeting time. Markdown supported."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                />
                <button
                  type="button"
                  disabled={!body.trim() || postMutation.isPending}
                  onClick={() => postMutation.mutate()}
                  className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
                >
                  Post
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {data.posts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No posts yet — start the conversation.</p>
                )}
                {data.posts.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-indigo-700">{p.author ?? "Member"}</p>
                    <div className="mt-1.5 text-sm text-foreground">
                      <Markdown source={p.body} />
                    </div>
                    {p.replies.length > 0 && (
                      <ul className="mt-3 space-y-2 border-l-2 border-indigo-100 pl-3">
                        {p.replies.map((r) => (
                          <li key={r.id} className="text-sm">
                            <span className="text-xs font-semibold text-indigo-700">
                              {r.author ?? "Member"}
                            </span>
                            <div className="text-foreground">
                              <Markdown source={r.body} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {replyTo === p.id ? (
                      <div className="mt-3">
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={!replyBody.trim() || replyMutation.isPending}
                            onClick={() => replyMutation.mutate(p.id)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
                          >
                            Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTo(null)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(p.id);
                          setReplyBody("");
                        }}
                        className="mt-3 text-xs font-semibold text-indigo-700 hover:underline"
                      >
                        Reply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>
        )}
      </main>
    </div>
  );
}
