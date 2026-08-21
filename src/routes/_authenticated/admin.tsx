import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { listUsers, setUserRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Space" },
      { name: "description", content: "Manage member roles across the Space platform." },
      { property: "og:title", content: "Admin panel — Space" },
      { property: "og:description", content: "Manage member roles across the Space platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const ROLES = ["student", "manager", "admin"] as const;

function AdminPage() {
  const fetchUsers = useServerFn(listUsers);
  const changeRole = useServerFn(setUserRole);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; role: (typeof ROLES)[number] }) =>
      changeRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forbidden = !!error;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl">Admin panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Grant manager or admin access. Every new signup starts as a student.
          </p>
        </motion.div>

        <div className="bento-grid mt-8">
          <BentoCard className="lg:col-span-6">
            {forbidden ? (
              <p className="text-sm text-destructive">
                You need the admin role to manage members.
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading members…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 pr-4 font-semibold">Member</th>
                      <th className="pb-3 pr-4 font-semibold">Email</th>
                      <th className="pb-3 pr-4 font-semibold">Points</th>
                      <th className="pb-3 font-semibold">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data ?? []).map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-accent/60">
                        <td className="py-3 pr-4 font-medium text-indigo-900">
                          {u.full_name ?? "Unnamed"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{u.points}</td>
                        <td className="py-3">
                          <select
                            value={u.role}
                            disabled={mutation.isPending}
                            onChange={(e) =>
                              mutation.mutate({
                                userId: u.id,
                                role: e.target.value as (typeof ROLES)[number],
                              })
                            }
                            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BentoCard>
        </div>
      </main>
    </div>
  );
}
