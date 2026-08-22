import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------------------------- types --------------------------------- */

export type PlatformStats = {
  totalUsers: number;
  dailyActive: number;
  weeklyActive: number;
  submissionsToday: number;
  submissionsWeek: number;
  totalPoints: number;
  activeGroups: number;
  upcomingEvents: number;
};

export type SeriesPoint = { label: string; total: number; accepted: number };
export type NamedCount = { name: string; value: number };
export type GrowthPoint = { label: string; signups: number; cumulative: number };

export type PlatformAnalytics = {
  stats: PlatformStats;
  submissionsOverTime: SeriesPoint[];
  difficultyDistribution: NamedCount[];
  languagePopularity: NamedCount[];
  signupGrowth: GrowthPoint[];
};

export type QuestionAnalytics = {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  category: string;
  language: string | null;
  attempts: number;
  solvers: number;
  passRate: number;
  avgAttemptsToSolve: number;
  avgRuntimeMs: number | null;
  flag: "low-pass" | "easy-hard" | null;
};

export type StudentRow = {
  id: string;
  full_name: string | null;
  points: number;
  streak: number;
  last_active: string | null;
  badges: number;
  solved: number;
  attempts: number;
  passRate: number;
  groups: string[];
  mentor: string | null;
};

export type StudentReport = {
  scope: "admin" | "manager";
  rows: StudentRow[];
  groups: string[];
  mentors: string[];
  platform: { avgPoints: number; avgStreak: number; avgSolved: number };
};

export type StudentDetail = {
  id: string;
  full_name: string | null;
  timeline: {
    id: string;
    title: string | null;
    status: string | null;
    difficulty: string | null;
    language: string | null;
    submitted_at: string;
  }[];
  languages: NamedCount[];
  passFail: { accepted: number; failed: number };
};

/* --------------------------------- helpers -------------------------------- */

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

async function requireAdmin(supabase: RpcClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin role required");
}

async function requireStaff(supabase: RpcClient, userId: string) {
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_staff", { _user_id: userId }),
  ]);
  if (!isStaff) throw new Error("Forbidden: manager or admin role required");
  return { isAdmin: Boolean(isAdmin) };
}

const DAY = 86400000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/* --------------------------- platform analytics --------------------------- */

export const getPlatformAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformAnalytics> => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const since = new Date(now - 30 * DAY).toISOString();
    const todayStart = `${dayKey(new Date(now))}T00:00:00.000Z`;
    const weekStart = new Date(now - 7 * DAY).toISOString();

    const [profilesRes, subsRes, questionsRes, langRes, groupsRes, eventsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, points, created_at").limit(5000),
      supabaseAdmin
        .from("submissions")
        .select("id, user_id, status, language, question_id, submitted_at")
        .gte("submitted_at", since)
        .order("submitted_at", { ascending: false })
        .limit(20000),
      supabaseAdmin.from("questions").select("id, difficulty").limit(5000),
      supabaseAdmin.from("languages").select("name, slug").limit(100),
      supabaseAdmin.from("study_groups").select("id").limit(5000),
      supabaseAdmin.from("events").select("id, start_time").gte("start_time", new Date(now).toISOString()).limit(1000),
    ]);

    const profiles = profilesRes.data ?? [];
    const subs = subsRes.data ?? [];
    const difficultyById = new Map((questionsRes.data ?? []).map((q) => [q.id, q.difficulty]));
    const langNameBySlug = new Map((langRes.data ?? []).map((l) => [l.slug, l.name]));

    const daily = new Set<string>();
    const weekly = new Set<string>();
    let submissionsToday = 0;
    let submissionsWeek = 0;
    for (const s of subs) {
      if (s.submitted_at >= weekStart) {
        weekly.add(s.user_id);
        submissionsWeek += 1;
      }
      if (s.submitted_at >= todayStart) {
        daily.add(s.user_id);
        submissionsToday += 1;
      }
    }

    // submissions over last 30 days
    const buckets = new Map<string, { total: number; accepted: number }>();
    for (let i = 29; i >= 0; i -= 1) {
      buckets.set(dayKey(new Date(now - i * DAY)), { total: 0, accepted: 0 });
    }
    for (const s of subs) {
      const b = buckets.get(s.submitted_at.slice(0, 10));
      if (!b) continue;
      b.total += 1;
      if (s.status === "accepted") b.accepted += 1;
    }
    const submissionsOverTime: SeriesPoint[] = Array.from(buckets.entries()).map(([label, v]) => ({
      label: label.slice(5),
      total: v.total,
      accepted: v.accepted,
    }));

    // difficulty distribution of solved questions (unique user+question)
    const solvedPairs = new Set<string>();
    const diffCount: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    const langCount = new Map<string, number>();
    for (const s of subs) {
      if (s.language) langCount.set(s.language, (langCount.get(s.language) ?? 0) + 1);
      if (s.status !== "accepted" || !s.question_id) continue;
      const key = `${s.user_id}:${s.question_id}`;
      if (solvedPairs.has(key)) continue;
      solvedPairs.add(key);
      const d = difficultyById.get(s.question_id);
      if (d && d in diffCount) diffCount[d] = (diffCount[d] ?? 0) + 1;
    }

    const difficultyDistribution: NamedCount[] = [
      { name: "Easy", value: diffCount["easy"] ?? 0 },
      { name: "Medium", value: diffCount["medium"] ?? 0 },
      { name: "Hard", value: diffCount["hard"] ?? 0 },
    ];

    const languagePopularity: NamedCount[] = Array.from(langCount.entries())
      .map(([slug, value]) => ({ name: langNameBySlug.get(slug) ?? slug, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // signup growth by week (12 weeks)
    const weeks: { start: number; label: string; signups: number }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const start = now - i * 7 * DAY;
      weeks.push({ start, label: dayKey(new Date(start)).slice(5), signups: 0 });
    }
    const windowStart = weeks[0]!.start - 7 * DAY;
    let priorTotal = 0;
    for (const p of profiles) {
      const t = new Date(p.created_at).getTime();
      if (t < windowStart) {
        priorTotal += 1;
        continue;
      }
      for (let i = weeks.length - 1; i >= 0; i -= 1) {
        if (t >= weeks[i]!.start) {
          weeks[i]!.signups += 1;
          break;
        }
        if (i === 0) priorTotal += 1;
      }
    }
    let running = priorTotal;
    const signupGrowth: GrowthPoint[] = weeks.map((w) => {
      running += w.signups;
      return { label: w.label, signups: w.signups, cumulative: running };
    });

    return {
      stats: {
        totalUsers: profiles.length,
        dailyActive: daily.size,
        weeklyActive: weekly.size,
        submissionsToday,
        submissionsWeek,
        totalPoints: profiles.reduce((sum, p) => sum + (p.points ?? 0), 0),
        activeGroups: (groupsRes.data ?? []).length,
        upcomingEvents: (eventsRes.data ?? []).length,
      },
      submissionsOverTime,
      difficultyDistribution,
      languagePopularity,
      signupGrowth,
    };
  });

/* --------------------------- question analytics --------------------------- */

export const getQuestionAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuestionAnalytics[]> => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: questions }, { data: subs }, { data: langs }] = await Promise.all([
      supabaseAdmin
        .from("questions")
        .select("id, title, slug, difficulty, category, language_id")
        .limit(5000),
      supabaseAdmin
        .from("submissions")
        .select("user_id, question_id, status, runtime_ms, submitted_at")
        .order("submitted_at", { ascending: true })
        .limit(50000),
      supabaseAdmin.from("languages").select("id, name").limit(200),
    ]);

    const langById = new Map((langs ?? []).map((l) => [l.id, l.name]));
    type Agg = {
      attempts: number;
      accepted: number;
      runtimes: number[];
      perUser: Map<string, { tries: number; solvedAt: number | null }>;
    };
    const agg = new Map<string, Agg>();
    for (const s of subs ?? []) {
      if (!s.question_id) continue;
      let a = agg.get(s.question_id);
      if (!a) {
        a = { attempts: 0, accepted: 0, runtimes: [], perUser: new Map() };
        agg.set(s.question_id, a);
      }
      a.attempts += 1;
      const u = a.perUser.get(s.user_id) ?? { tries: 0, solvedAt: null };
      if (u.solvedAt === null) u.tries += 1;
      if (s.status === "accepted") {
        a.accepted += 1;
        if (typeof s.runtime_ms === "number") a.runtimes.push(s.runtime_ms);
        if (u.solvedAt === null) u.solvedAt = u.tries;
      }
      a.perUser.set(s.user_id, u);
    }

    return (questions ?? [])
      .map((q) => {
        const a = agg.get(q.id);
        const attempts = a?.attempts ?? 0;
        const solvedUsers = a ? Array.from(a.perUser.values()).filter((u) => u.solvedAt !== null) : [];
        const solvers = solvedUsers.length;
        const passRate = attempts > 0 ? (a!.accepted / attempts) * 100 : 0;
        const avgAttemptsToSolve =
          solvers > 0 ? solvedUsers.reduce((s, u) => s + (u.solvedAt ?? 0), 0) / solvers : 0;
        const runtimes = a?.runtimes ?? [];
        const avgRuntimeMs =
          runtimes.length > 0
            ? Math.round(runtimes.reduce((s, r) => s + r, 0) / runtimes.length)
            : null;
        let flag: QuestionAnalytics["flag"] = null;
        if (attempts >= 5 && passRate < 15) flag = "low-pass";
        else if (q.difficulty === "hard" && attempts >= 5 && passRate > 80) flag = "easy-hard";
        return {
          id: q.id,
          title: q.title,
          slug: q.slug,
          difficulty: q.difficulty,
          category: q.category,
          language: q.language_id ? (langById.get(q.language_id) ?? null) : null,
          attempts,
          solvers,
          passRate,
          avgAttemptsToSolve,
          avgRuntimeMs,
          flag,
        };
      })
      .sort((a, b) => b.attempts - a.attempts);
  });

/* ---------------------------- mentor reporting ---------------------------- */

export const getStudentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudentReport> => {
    const { isAdmin } = await requireStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assignments } = await supabaseAdmin
      .from("mentor_assignments")
      .select("mentor_id, student_id");

    // Server-side scoping: managers only ever receive their own mentees.
    let visibleIds: string[] | null = null;
    if (!isAdmin) {
      visibleIds = (assignments ?? [])
        .filter((a) => a.mentor_id === context.userId)
        .map((a) => a.student_id);
      if (visibleIds.length === 0) {
        return {
          scope: "manager",
          rows: [],
          groups: [],
          mentors: [],
          platform: { avgPoints: 0, avgStreak: 0, avgSolved: 0 },
        };
      }
    }

    const profileQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, points, streak_count, last_active_date")
      .limit(5000);
    const { data: allProfiles } = await profileQuery;

    const [{ data: subs }, { data: badges }, { data: members }, { data: groups }] =
      await Promise.all([
        supabaseAdmin.from("submissions").select("user_id, status").limit(50000),
        supabaseAdmin.from("user_badges").select("user_id").limit(50000),
        supabaseAdmin.from("study_group_members").select("user_id, group_id").limit(20000),
        supabaseAdmin.from("study_groups").select("id, name").limit(2000),
      ]);

    const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));
    const groupsByUser = new Map<string, string[]>();
    for (const m of members ?? []) {
      const name = groupNameById.get(m.group_id);
      if (!name) continue;
      groupsByUser.set(m.user_id, [...(groupsByUser.get(m.user_id) ?? []), name]);
    }
    const badgeCount = new Map<string, number>();
    for (const b of badges ?? []) badgeCount.set(b.user_id, (badgeCount.get(b.user_id) ?? 0) + 1);
    const subStats = new Map<string, { attempts: number; accepted: number }>();
    for (const s of subs ?? []) {
      const v = subStats.get(s.user_id) ?? { attempts: 0, accepted: 0 };
      v.attempts += 1;
      if (s.status === "accepted") v.accepted += 1;
      subStats.set(s.user_id, v);
    }

    const nameById = new Map((allProfiles ?? []).map((p) => [p.id, p.full_name]));
    const mentorByStudent = new Map<string, string>();
    for (const a of assignments ?? []) {
      mentorByStudent.set(a.student_id, nameById.get(a.mentor_id) ?? "Unknown mentor");
    }

    const toRow = (p: {
      id: string;
      full_name: string | null;
      points: number;
      streak_count: number;
      last_active_date: string | null;
    }): StudentRow => {
      const st = subStats.get(p.id) ?? { attempts: 0, accepted: 0 };
      return {
        id: p.id,
        full_name: p.full_name,
        points: p.points ?? 0,
        streak: p.streak_count ?? 0,
        last_active: p.last_active_date,
        badges: badgeCount.get(p.id) ?? 0,
        solved: st.accepted,
        attempts: st.attempts,
        passRate: st.attempts > 0 ? (st.accepted / st.attempts) * 100 : 0,
        groups: groupsByUser.get(p.id) ?? [],
        mentor: mentorByStudent.get(p.id) ?? null,
      };
    };

    const allRows = (allProfiles ?? []).map(toRow);
    const platform = {
      avgPoints: allRows.length ? allRows.reduce((s, r) => s + r.points, 0) / allRows.length : 0,
      avgStreak: allRows.length ? allRows.reduce((s, r) => s + r.streak, 0) / allRows.length : 0,
      avgSolved: allRows.length ? allRows.reduce((s, r) => s + r.solved, 0) / allRows.length : 0,
    };

    const visible = new Set(visibleIds ?? []);
    const rows = visibleIds ? allRows.filter((r) => visible.has(r.id)) : allRows;

    return {
      scope: isAdmin ? "admin" : "manager",
      rows: rows.sort((a, b) => b.points - a.points),
      groups: Array.from(new Set(rows.flatMap((r) => r.groups))).sort(),
      mentors: Array.from(new Set(rows.map((r) => r.mentor).filter(Boolean) as string[])).sort(),
      platform,
    };
  });

export const getStudentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string }) => ({ studentId: String(input.studentId) }))
  .handler(async ({ context, data }): Promise<StudentDetail> => {
    const { isAdmin } = await requireStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!isAdmin) {
      const { data: link } = await supabaseAdmin
        .from("mentor_assignments")
        .select("student_id")
        .eq("mentor_id", context.userId)
        .eq("student_id", data.studentId)
        .maybeSingle();
      if (!link) throw new Error("Forbidden: this student is not one of your mentees");
    }

    const [{ data: profile }, { data: subs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").eq("id", data.studentId).maybeSingle(),
      supabaseAdmin
        .from("submissions")
        .select("id, status, language, submitted_at, questions(title, difficulty)")
        .eq("user_id", data.studentId)
        .order("submitted_at", { ascending: false })
        .limit(200),
    ]);

    const rows = subs ?? [];
    const langCount = new Map<string, number>();
    let accepted = 0;
    for (const s of rows) {
      if (s.language) langCount.set(s.language, (langCount.get(s.language) ?? 0) + 1);
      if (s.status === "accepted") accepted += 1;
    }

    return {
      id: data.studentId,
      full_name: profile?.full_name ?? null,
      timeline: rows.slice(0, 40).map((s) => {
        const q = (s as { questions?: { title: string; difficulty: string } | null }).questions;
        return {
          id: s.id,
          title: q?.title ?? null,
          status: s.status,
          difficulty: q?.difficulty ?? null,
          language: s.language,
          submitted_at: s.submitted_at,
        };
      }),
      languages: Array.from(langCount.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      passFail: { accepted, failed: rows.length - accepted },
    };
  });
