import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MenteeSubmission = {
  id: string;
  status: string | null;
  submitted_at: string;
  question_title: string | null;
};

export type Mentee = {
  id: string;
  full_name: string | null;
  points: number;
  assigned_at: string;
  streak: number;
  solved: number;
  recent: MenteeSubmission[];
};

export type MentorNote = {
  id: string;
  student_id: string;
  note: string;
  created_at: string;
};

export type StaffMember = { id: string; full_name: string | null; role: string };

async function rolesOf(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
) {
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_staff", { _user_id: userId }),
  ]);
  return { isAdmin: Boolean(isAdmin), isStaff: Boolean(isStaff) };
}

function streakFrom(dates: string[]): number {
  const days = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort().reverse();
  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
    if (prev - cur === 86400000) streak += 1;
    else break;
  }
  return streak;
}

export const listMyMentees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Mentee[]> => {
    const { isStaff } = await rolesOf(context.supabase as never, context.userId);
    if (!isStaff) throw new Error("Forbidden: manager or admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignments } = await supabaseAdmin
      .from("mentor_assignments")
      .select("student_id, assigned_at")
      .eq("mentor_id", context.userId);

    const ids = (assignments ?? []).map((a) => a.student_id);
    if (ids.length === 0) return [];

    const [{ data: profiles }, { data: subs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, points").in("id", ids),
      supabaseAdmin
        .from("submissions")
        .select("id, user_id, status, submitted_at, questions(title)")
        .in("user_id", ids)
        .order("submitted_at", { ascending: false })
        .limit(500),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (assignments ?? []).map((a) => {
      const mine = (subs ?? []).filter((s) => s.user_id === a.student_id);
      const accepted = mine.filter((s) => s.status === "accepted");
      return {
        id: a.student_id,
        full_name: profileById.get(a.student_id)?.full_name ?? null,
        points: profileById.get(a.student_id)?.points ?? 0,
        assigned_at: a.assigned_at,
        streak: streakFrom(accepted.map((s) => s.submitted_at)),
        solved: accepted.length,
        recent: mine.slice(0, 5).map((s) => ({
          id: s.id,
          status: s.status,
          submitted_at: s.submitted_at,
          question_title:
            (s as { questions?: { title: string } | null }).questions?.title ?? null,
        })),
      };
    });
  });

export const listMentorNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string }) => ({ studentId: String(input.studentId) }))
  .handler(async ({ context, data }): Promise<MentorNote[]> => {
    const { data: notes, error } = await context.supabase
      .from("mentor_notes")
      .select("id, student_id, note, created_at")
      .eq("student_id", data.studentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return notes ?? [];
  });

export const addMentorNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string; note: string }) => {
    const note = String(input.note ?? "").trim();
    if (!note) throw new Error("Note cannot be empty");
    return { studentId: String(input.studentId), note: note.slice(0, 2000) };
  })
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("mentor_notes")
      .insert({ mentor_id: context.userId, student_id: data.studentId, note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMentorNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("mentor_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type Assignment = {
  student_id: string;
  student_name: string | null;
  mentor_id: string;
  mentor_name: string | null;
  assigned_at: string;
};

export const listAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ assignments: Assignment[]; mentors: StaffMember[] }> => {
      const { isAdmin } = await rolesOf(context.supabase as never, context.userId);
      if (!isAdmin) throw new Error("Forbidden: admin role required");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [{ data: rows }, { data: staffRoles }] = await Promise.all([
        supabaseAdmin.from("mentor_assignments").select("mentor_id, student_id, assigned_at"),
        supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["manager", "admin"]),
      ]);

      const ids = new Set<string>();
      for (const r of rows ?? []) {
        ids.add(r.mentor_id);
        ids.add(r.student_id);
      }
      for (const s of staffRoles ?? []) ids.add(s.user_id);

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(ids).length ? Array.from(ids) : ["00000000-0000-0000-0000-000000000000"]);
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

      return {
        assignments: (rows ?? []).map((r) => ({
          student_id: r.student_id,
          student_name: nameById.get(r.student_id) ?? null,
          mentor_id: r.mentor_id,
          mentor_name: nameById.get(r.mentor_id) ?? null,
          assigned_at: r.assigned_at,
        })),
        mentors: (staffRoles ?? []).map((s) => ({
          id: s.user_id,
          full_name: nameById.get(s.user_id) ?? null,
          role: s.role,
        })),
      };
    },
  );

export const assignMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string; mentorId: string }) => ({
    studentId: String(input.studentId),
    mentorId: String(input.mentorId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { isAdmin } = await rolesOf(context.supabase as never, context.userId);
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("mentor_assignments").delete().eq("student_id", data.studentId);
    if (!data.mentorId) return { ok: true };
    const { error } = await supabaseAdmin
      .from("mentor_assignments")
      .insert({ student_id: data.studentId, mentor_id: data.mentorId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
