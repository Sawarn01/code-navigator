import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  points: number;
  role: "student" | "manager" | "admin";
  created_at: string;
};

async function assertAdmin(supabase: {
  from: (t: "user_roles") => {
    select: (c: string) => {
      eq: (
        c: string,
        v: string,
      ) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null }> };
    };
  };
}, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
  if (!data || data.length === 0) throw new Error("Forbidden: admin role required");
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, authUsers] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, points, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const emailById = new Map(
      (authUsers.data?.users ?? []).map((u) => [u.id, u.email ?? null] as const),
    );
    const roleById = new Map<string, ManagedUser["role"]>();
    for (const r of roles ?? []) {
      const current = roleById.get(r.user_id);
      const rank = { student: 0, manager: 1, admin: 2 } as const;
      if (!current || rank[r.role] > rank[current]) roleById.set(r.user_id, r.role);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: emailById.get(p.id) ?? null,
      points: p.points,
      role: roleById.get(p.id) ?? "student",
      created_at: p.created_at,
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "student" | "manager" | "admin" }) => {
    const role = input.role;
    if (!["student", "manager", "admin"].includes(role)) throw new Error("Invalid role");
    return { userId: String(input.userId), role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delError) throw new Error(delError.message);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
