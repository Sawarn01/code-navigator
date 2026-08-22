import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type TeamRoster = {
  id: string;
  name: string;
  max_size: number;
  created_by: string;
  invite_code: string;
  members: { user_id: string; full_name: string | null; joined_at: string }[];
};

export const getEventTeams = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data }): Promise<{ teams: TeamRoster[] }> => {
    const supabase = serverPublicClient();
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, max_size, created_by, invite_code, created_at")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: true });

    const ids = (teams ?? []).map((t) => t.id);
    if (ids.length === 0) return { teams: [] };

    const { data: members } = await supabase
      .from("team_members")
      .select("team_id, user_id, joined_at")
      .in("team_id", ids);

    const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return {
      teams: (teams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        max_size: t.max_size,
        created_by: t.created_by,
        invite_code: t.invite_code,
        members: (members ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => ({
            user_id: m.user_id,
            full_name: nameById.get(m.user_id) ?? null,
            joined_at: m.joined_at,
          })),
      })),
    };
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; name: string; maxSize: number }) => {
    const name = String(input.name ?? "").trim();
    if (name.length < 2) throw new Error("Team name must be at least 2 characters");
    const maxSize = Number(input.maxSize ?? 4);
    return {
      eventId: String(input.eventId),
      name: name.slice(0, 60),
      maxSize: Math.min(8, Math.max(2, Number.isFinite(maxSize) ? maxSize : 4)),
    };
  })
  .handler(async ({ context, data }) => {
    const { data: team, error } = await context.supabase
      .from("teams")
      .insert({
        event_id: data.eventId,
        name: data.name,
        created_by: context.userId,
        max_size: data.maxSize,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await context.supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: context.userId });
    if (memberError) throw new Error(memberError.message);

    await registerWithTeam(context.supabase, context.userId, data.eventId, team.id);
    return { id: team.id };
  });

export const joinTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId?: string; code?: string }) => ({
    teamId: input.teamId ? String(input.teamId) : null,
    code: input.code ? String(input.code).trim().toUpperCase().slice(0, 12) : null,
  }))
  .handler(async ({ context, data }) => {
    let teamId = data.teamId;
    if (!teamId && data.code) {
      const { data: found } = await context.supabase
        .from("teams")
        .select("id")
        .eq("invite_code", data.code)
        .maybeSingle();
      if (!found) throw new Error("No team matches that invite code");
      teamId = found.id;
    }
    if (!teamId) throw new Error("Team not specified");

    const { data: team } = await context.supabase
      .from("teams")
      .select("id, event_id")
      .eq("id", teamId)
      .maybeSingle();
    if (!team) throw new Error("Team not found");

    const { error } = await context.supabase
      .from("team_members")
      .insert({ team_id: teamId, user_id: context.userId });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);

    await registerWithTeam(context.supabase, context.userId, team.event_id, teamId);
    return { teamId, eventId: team.event_id };
  });

export const leaveTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => ({ teamId: String(input.teamId) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("team_members")
      .delete()
      .eq("team_id", data.teamId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("event_registrations")
      .update({ team_id: null })
      .eq("user_id", context.userId)
      .eq("team_id", data.teamId);
    return { ok: true };
  });

type AuthedClient = Parameters<typeof registerWithTeamImpl>[0];

async function registerWithTeamImpl(
  supabase: {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<unknown> };
      };
    };
  },
  userId: string,
  eventId: string,
  teamId: string,
) {
  const { error } = await supabase
    .from("event_registrations")
    .insert({ event_id: eventId, user_id: userId, team_id: teamId });
  if (error) {
    await supabase
      .from("event_registrations")
      .update({ team_id: teamId })
      .eq("user_id", userId)
      .eq("event_id", eventId);
  }
}

async function registerWithTeam(
  supabase: unknown,
  userId: string,
  eventId: string,
  teamId: string,
) {
  await registerWithTeamImpl(supabase as AuthedClient, userId, eventId, teamId);
}
