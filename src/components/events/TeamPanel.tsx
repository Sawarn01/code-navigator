import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { Copy, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { createTeam, getEventTeams, joinTeam, leaveTeam } from "@/lib/teams.functions";
import { useAuth } from "@/hooks/useAuth";

export function TeamPanel({ eventId }: { eventId: string }) {
  const fetchTeams = useServerFn(getEventTeams);
  const create = useServerFn(createTeam);
  const join = useServerFn(joinTeam);
  const leave = useServerFn(leaveTeam);
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [name, setName] = useState("");
  const [maxSize, setMaxSize] = useState(4);
  const [code, setCode] = useState("");

  const { data } = useQuery({
    queryKey: ["event-teams", eventId],
    queryFn: () => fetchTeams({ data: { eventId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["event-teams", eventId] });
    queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
  };

  const createMutation = useMutation({
    mutationFn: () => create({ data: { eventId, name, maxSize } }),
    onSuccess: () => {
      setName("");
      toast.success("Team created — share your invite code");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinMutation = useMutation({
    mutationFn: (vars: { teamId?: string; code?: string }) => join({ data: vars }),
    onSuccess: () => {
      setCode("");
      toast.success("You joined the team");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveMutation = useMutation({
    mutationFn: (teamId: string) => leave({ data: { teamId } }),
    onSuccess: () => {
      toast.success("You left the team");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teams = data?.teams ?? [];
  const myTeam = teams.find((t) => t.members.some((m) => m.user_id === user?.id));

  return (
    <section className="mt-10">
      <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-indigo-900">
        <UsersRound className="size-5" /> Teams
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Hackathons run in teams. Create one and share the code, or join an existing roster.
      </p>

      {isAuthenticated && !myTeam && (
        <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Team name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Segment Fault"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="w-24">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Max size</label>
            <input
              type="number"
              min={2}
              max={8}
              value={maxSize}
              onChange={(e) => setMaxSize(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
          >
            Form a team
          </motion.button>
          <div className="flex items-end gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Invite code"
              className="w-32 rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              disabled={!code.trim() || joinMutation.isPending}
              onClick={() => joinMutation.mutate({ code })}
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-accent disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">No teams yet — be the first to form one.</p>
        )}
        {teams.map((t) => {
          const mine = t.members.some((m) => m.user_id === user?.id);
          const full = t.members.length >= t.max_size;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-bold text-indigo-900">{t.name}</h3>
                <span className="rounded-full surface-tint px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {t.members.length}/{t.max_size}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {t.members.map((m) => (
                  <li key={m.user_id}>{m.full_name ?? "Member"}</li>
                ))}
                {t.members.length === 0 && <li>No members yet</li>}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {mine ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(t.invite_code);
                        toast.success("Invite code copied");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg surface-tint px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <Copy className="size-3" /> {t.invite_code}
                    </button>
                    <button
                      type="button"
                      disabled={leaveMutation.isPending}
                      onClick={() => leaveMutation.mutate(t.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-60"
                    >
                      Leave team
                    </button>
                  </>
                ) : (
                  isAuthenticated &&
                  !myTeam && (
                    <button
                      type="button"
                      disabled={full || joinMutation.isPending}
                      onClick={() => joinMutation.mutate({ teamId: t.id })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {full ? "Team full" : "Join team"}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
