import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Club = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  meeting_info: string | null;
  contact_email: string | null;
  logo_url: string | null;
  memberCount: number;
  isMember: boolean;
};

async function assertStaff(
  supabase: { rpc: (fn: "is_staff", args: { _user_id: string }) => Promise<{ data: unknown }> },
  userId: string,
) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: manager or admin role required");
}

export const getClubs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ clubs: Club[] }> => {
    const [{ data: clubs, error }, { data: members }] = await Promise.all([
      context.supabase
        .from("clubs")
        .select(
          "id, name, description, category, meeting_info, contact_email, logo_url, created_at",
        )
        .order("name"),
      context.supabase.from("club_members").select("club_id, user_id"),
    ]);
    if (error) throw new Error(error.message);

    const countByClub = new Map<string, number>();
    const myClubs = new Set<string>();
    for (const m of members ?? []) {
      countByClub.set(m.club_id, (countByClub.get(m.club_id) ?? 0) + 1);
      if (m.user_id === context.userId) myClubs.add(m.club_id);
    }

    return {
      clubs: (clubs ?? []).map((c) => ({
        ...c,
        memberCount: countByClub.get(c.id) ?? 0,
        isMember: myClubs.has(c.id),
      })),
    };
  });

export const joinClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clubId: string }) => ({ clubId: String(input.clubId) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("club_members")
      .insert({ club_id: data.clubId, user_id: context.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const leaveClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clubId: string }) => ({ clubId: String(input.clubId) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("club_members")
      .delete()
      .eq("club_id", data.clubId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      name: string;
      description?: string | null;
      category?: string | null;
      meeting_info?: string | null;
      contact_email?: string | null;
      logo_url?: string | null;
    }) => ({
      id: input.id ? String(input.id) : null,
      name: String(input.name).slice(0, 150),
      description: input.description ? String(input.description).slice(0, 2000) : null,
      category: input.category ? String(input.category).slice(0, 80) : null,
      meeting_info: input.meeting_info ? String(input.meeting_info).slice(0, 300) : null,
      contact_email: input.contact_email ? String(input.contact_email).slice(0, 255) : null,
      logo_url: input.logo_url ? String(input.logo_url).slice(0, 500) : null,
    }),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertStaff(context.supabase as never, context.userId);
    const payload = {
      name: data.name,
      description: data.description,
      category: data.category,
      meeting_info: data.meeting_info,
      contact_email: data.contact_email,
      logo_url: data.logo_url,
    };
    if (data.id) {
      const { error } = await context.supabase.from("clubs").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("clubs")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clubId: string }) => ({ clubId: String(input.clubId) }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase.from("clubs").delete().eq("id", data.clubId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
