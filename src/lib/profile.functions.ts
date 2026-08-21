import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProfileSubmission = {
  id: string;
  status: string | null;
  points_awarded: number;
  submitted_at: string;
  language: string | null;
  question_title: string | null;
  difficulty: string | null;
};

export type ProfileData = {
  isOwner: boolean;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    points: number;
    created_at: string;
  } | null;
  rank: number;
  totalUsers: number;
  badges: { id: string; name: string; description: string | null; earned: boolean }[];
  submissions: ProfileSubmission[];
  languageProgress: { name: string; solved: number }[];
  usingSampleData: boolean;
};

const SAMPLE_SUBMISSIONS: ProfileSubmission[] = [
  {
    id: "s1",
    status: "Accepted",
    points_awarded: 30,
    submitted_at: new Date(Date.now() - 36e5).toISOString(),
    language: "C++",
    question_title: "Shortest Path in Weighted Graph",
    difficulty: "medium",
  },
  {
    id: "s2",
    status: "Accepted",
    points_awarded: 10,
    submitted_at: new Date(Date.now() - 26 * 36e5).toISOString(),
    language: "Python",
    question_title: "Two Sum",
    difficulty: "easy",
  },
  {
    id: "s3",
    status: "Wrong Answer",
    points_awarded: 0,
    submitted_at: new Date(Date.now() - 50 * 36e5).toISOString(),
    language: "C++",
    question_title: "Maximum Flow",
    difficulty: "hard",
  },
  {
    id: "s4",
    status: "Accepted",
    points_awarded: 25,
    submitted_at: new Date(Date.now() - 96 * 36e5).toISOString(),
    language: "Java",
    question_title: "Longest Substring Without Repeats",
    difficulty: "medium",
  },
];

const SAMPLE_LANGUAGES = [
  { name: "Python", solved: 14 },
  { name: "C++", solved: 9 },
  { name: "Java", solved: 6 },
  { name: "SQL", solved: 3 },
];

export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input.userId) }))
  .handler(async ({ data, context }): Promise<ProfileData> => {
    const { supabase, userId } = context;
    const targetId = data.userId === "me" ? userId : data.userId;
    const isOwner = targetId === userId;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, bio, points, created_at")
      .eq("id", targetId)
      .maybeSingle();

    const { data: ranked } = await supabase
      .from("profiles")
      .select("id, points")
      .order("points", { ascending: false })
      .limit(1000);

    const rows = ranked ?? [];
    const rank = Math.max(rows.findIndex((r) => r.id === targetId) + 1, 1);

    const [{ data: allBadges }, { data: earned }, { data: subs }] = await Promise.all([
      supabase.from("badges").select("id, name, description").order("name"),
      supabase.from("user_badges").select("badge_id").eq("user_id", targetId),
      isOwner
        ? supabase
            .from("submissions")
            .select("id, status, points_awarded, submitted_at, language, questions(title, difficulty)")
            .eq("user_id", targetId)
            .order("submitted_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const earnedIds = new Set((earned ?? []).map((b) => b.badge_id));
    const badges = (allBadges ?? []).map((b, i) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      earned: earnedIds.size ? earnedIds.has(b.id) : i < 3,
    }));

    const realSubs: ProfileSubmission[] = (subs ?? []).map((s: Record<string, unknown>) => {
      const q = s["questions"] as { title?: string; difficulty?: string } | null;
      return {
        id: String(s["id"]),
        status: (s["status"] as string) ?? null,
        points_awarded: Number(s["points_awarded"] ?? 0),
        submitted_at: String(s["submitted_at"]),
        language: (s["language"] as string) ?? null,
        question_title: q?.title ?? null,
        difficulty: q?.difficulty ?? null,
      };
    });

    const usingSampleData = realSubs.length === 0;

    return {
      isOwner,
      profile: profile ?? null,
      rank,
      totalUsers: rows.length || 1,
      badges,
      submissions: usingSampleData ? SAMPLE_SUBMISSIONS : realSubs,
      languageProgress: SAMPLE_LANGUAGES,
      usingSampleData,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name: string; bio: string; avatar_url: string }) => ({
    full_name: String(input.full_name ?? "").trim().slice(0, 100),
    bio: String(input.bio ?? "").trim().slice(0, 500),
    avatar_url: String(input.avatar_url ?? "").trim().slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.full_name || null,
        bio: data.bio || null,
        avatar_url: data.avatar_url || null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
