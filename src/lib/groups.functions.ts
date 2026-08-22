import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
  invite_code: string | null;
};

export type GroupMember = {
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
};

export type GroupLeaderRow = {
  user_id: string;
  full_name: string | null;
  points: number;
  solved_count: number;
  badge_count: number;
};

export type GroupPost = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  author: string | null;
  replies: {
    id: string;
    body: string;
    created_at: string;
    user_id: string;
    author: string | null;
  }[];
};

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      groups: GroupSummary[];
      myGroupIds: string[];
      counts: Record<string, number>;
    }> => {
      const [{ data: groups }, { data: memberships }] = await Promise.all([
        context.supabase
          .from("study_groups")
          .select("id, name, description, is_public, created_by, created_at, invite_code")
          .order("created_at", { ascending: false })
          .limit(200),
        context.supabase.from("study_group_members").select("group_id, user_id"),
      ]);

      const myGroupIds = (memberships ?? [])
        .filter((m) => m.user_id === context.userId)
        .map((m) => m.group_id);
      const counts: Record<string, number> = {};
      for (const m of memberships ?? []) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1;

      const visible = (groups ?? []).filter((g) => g.is_public || myGroupIds.includes(g.id));
      return {
        groups: visible.map((g) => ({
          ...g,
          invite_code: myGroupIds.includes(g.id) ? g.invite_code : null,
        })),
        myGroupIds,
        counts,
      };
    },
  );

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; description: string; is_public: boolean }) => {
    const name = String(input.name ?? "").trim();
    if (name.length < 3) throw new Error("Group name must be at least 3 characters");
    return {
      name: name.slice(0, 80),
      description:
        String(input.description ?? "")
          .trim()
          .slice(0, 600) || null,
      is_public: Boolean(input.is_public),
    };
  })
  .handler(async ({ context, data }) => {
    const { data: created, error } = await context.supabase
      .from("study_groups")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: memberError } = await context.supabase
      .from("study_group_members")
      .insert({ group_id: created.id, user_id: context.userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);
    return { id: created.id };
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId?: string; code?: string }) => ({
    groupId: input.groupId ? String(input.groupId) : null,
    code: input.code ? String(input.code).trim().toUpperCase().slice(0, 12) : null,
  }))
  .handler(async ({ context, data }) => {
    let groupId = data.groupId;
    if (!groupId && data.code) {
      const { data: found } = await context.supabase
        .from("study_groups")
        .select("id")
        .eq("invite_code", data.code)
        .maybeSingle();
      if (!found) throw new Error("No group matches that invite code");
      groupId = found.id;
    }
    if (!groupId) throw new Error("Group not specified");
    const { error } = await context.supabase
      .from("study_group_members")
      .insert({ group_id: groupId, user_id: context.userId, role: "member" });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { groupId };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: String(input.groupId) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("study_group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: String(input.groupId) }))
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      group: GroupSummary | null;
      isMember: boolean;
      isOwner: boolean;
      members: GroupMember[];
      leaders: GroupLeaderRow[];
      posts: GroupPost[];
    }> => {
      const { data: group } = await context.supabase
        .from("study_groups")
        .select("id, name, description, is_public, created_by, created_at, invite_code")
        .eq("id", data.groupId)
        .maybeSingle();
      if (!group)
        return {
          group: null,
          isMember: false,
          isOwner: false,
          members: [],
          leaders: [],
          posts: [],
        };

      const { data: memberRows } = await context.supabase
        .from("study_group_members")
        .select("user_id, role, joined_at")
        .eq("group_id", data.groupId);

      const rows = memberRows ?? [];
      const isMember = rows.some((m) => m.user_id === context.userId);
      const base: GroupSummary = {
        ...group,
        invite_code: isMember ? group.invite_code : null,
      };
      if (!isMember) {
        return {
          group: base,
          isMember: false,
          isOwner: false,
          members: [],
          leaders: [],
          posts: [],
        };
      }

      const ids = rows.map((m) => m.user_id);
      const [{ data: profiles }, { data: board }, { data: posts }, { data: replies }] =
        await Promise.all([
          context.supabase
            .from("profiles")
            .select("id, full_name, avatar_url, points")
            .in("id", ids),
          context.supabase
            .from("leaderboard")
            .select("user_id, full_name, points, solved_count, badge_count")
            .in("user_id", ids),
          context.supabase
            .from("study_group_posts")
            .select("id, body, created_at, user_id")
            .eq("group_id", data.groupId)
            .order("created_at", { ascending: false })
            .limit(50),
          context.supabase
            .from("study_group_replies")
            .select("id, post_id, body, created_at, user_id")
            .eq("group_id", data.groupId)
            .order("created_at", { ascending: true })
            .limit(300),
        ]);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const members: GroupMember[] = rows
        .map((m) => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          full_name: profileById.get(m.user_id)?.full_name ?? null,
          avatar_url: profileById.get(m.user_id)?.avatar_url ?? null,
          points: profileById.get(m.user_id)?.points ?? 0,
        }))
        .sort((a, b) => b.points - a.points);

      const leaders = ((board ?? []) as GroupLeaderRow[]).sort((a, b) => b.points - a.points);

      const repliesByPost = new Map<string, GroupPost["replies"]>();
      for (const r of replies ?? []) {
        const list = repliesByPost.get(r.post_id) ?? [];
        list.push({
          id: r.id,
          body: r.body,
          created_at: r.created_at,
          user_id: r.user_id,
          author: profileById.get(r.user_id)?.full_name ?? null,
        });
        repliesByPost.set(r.post_id, list);
      }

      return {
        group: base,
        isMember: true,
        isOwner: group.created_by === context.userId,
        members,
        leaders,
        posts: (posts ?? []).map((p) => ({
          id: p.id,
          body: p.body,
          created_at: p.created_at,
          user_id: p.user_id,
          author: profileById.get(p.user_id)?.full_name ?? null,
          replies: repliesByPost.get(p.id) ?? [],
        })),
      };
    },
  );

export const postToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; body: string }) => {
    const body = String(input.body ?? "").trim();
    if (!body) throw new Error("Write something first");
    return { groupId: String(input.groupId), body: body.slice(0, 4000) };
  })
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("study_group_posts")
      .insert({ group_id: data.groupId, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; postId: string; body: string }) => {
    const body = String(input.body ?? "").trim();
    if (!body) throw new Error("Write something first");
    return {
      groupId: String(input.groupId),
      postId: String(input.postId),
      body: body.slice(0, 4000),
    };
  })
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("study_group_replies").insert({
      group_id: data.groupId,
      post_id: data.postId,
      user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ group challenges ------------------------------ */

export type GroupChallenge = {
  id: string;
  questionId: string;
  questionTitle: string;
  startsAt: string;
  endsAt: string;
  createdBy: string;
};

export const getGroupChallenges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: String(input.groupId) }))
  .handler(async ({ context, data }): Promise<GroupChallenge[]> => {
    const { data: rows } = await context.supabase
      .from("group_challenges")
      .select("id, question_id, starts_at, ends_at, created_by")
      .eq("group_id", data.groupId)
      .order("starts_at", { ascending: false });
    if (!rows?.length) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, title")
      .in(
        "id",
        rows.map((r) => r.question_id),
      );
    const titleById = new Map((questions ?? []).map((q) => [q.id, q.title]));

    return rows.map((r) => ({
      id: r.id,
      questionId: r.question_id,
      questionTitle: titleById.get(r.question_id) ?? "Question",
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      createdBy: r.created_by,
    }));
  });

export const createGroupChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { groupId: string; questionId: string; startsAt: string; endsAt: string }) => {
      const startsAt = new Date(input.startsAt).toISOString();
      const endsAt = new Date(input.endsAt).toISOString();
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        throw new Error("End time must be after start time");
      }
      return {
        groupId: String(input.groupId),
        questionId: String(input.questionId),
        startsAt,
        endsAt,
      };
    },
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { data: created, error } = await context.supabase
      .from("group_challenges")
      .insert({
        group_id: data.groupId,
        question_id: data.questionId,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export type GroupChallengeLeaderboardRow = {
  userId: string;
  fullName: string | null;
  solvedAt: string | null;
};

export const getGroupChallengeLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { challengeId: string }) => ({ challengeId: String(input.challengeId) }))
  .handler(async ({ context, data }): Promise<GroupChallengeLeaderboardRow[]> => {
    const { data: challenge } = await context.supabase
      .from("group_challenges")
      .select("group_id, question_id, starts_at, ends_at")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!challenge) return [];

    const { data: members } = await context.supabase
      .from("study_group_members")
      .select("user_id")
      .eq("group_id", challenge.group_id);
    const memberIds = (members ?? []).map((m) => m.user_id);
    if (!memberIds.length) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", memberIds),
      supabaseAdmin
        .from("submissions")
        .select("user_id, submitted_at")
        .eq("question_id", challenge.question_id)
        .eq("status", "accepted")
        .in("user_id", memberIds)
        .gte("submitted_at", challenge.starts_at)
        .lte("submitted_at", challenge.ends_at)
        .order("submitted_at", { ascending: true }),
    ]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const solvedAtByUser = new Map<string, string>();
    for (const s of subs ?? []) {
      if (!solvedAtByUser.has(s.user_id)) solvedAtByUser.set(s.user_id, s.submitted_at);
    }

    return memberIds
      .map((id) => ({
        userId: id,
        fullName: nameById.get(id) ?? null,
        solvedAt: solvedAtByUser.get(id) ?? null,
      }))
      .sort((a, b) => {
        if (a.solvedAt && b.solvedAt)
          return new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime();
        if (a.solvedAt) return -1;
        if (b.solvedAt) return 1;
        return (a.fullName ?? "").localeCompare(b.fullName ?? "");
      });
  });

/* ------------------------------ group-vs-group leaderboard ------------------------------ */

export type GroupLeaderboardEntry = {
  groupId: string;
  name: string;
  totalPoints: number;
  memberCount: number;
};

/** Public, aggregate-only (group totals, not individual points) — no auth needed. */
export const getGroupsLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<GroupLeaderboardEntry[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: groups }, { data: members }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("study_groups").select("id, name").eq("is_public", true),
      supabaseAdmin.from("study_group_members").select("group_id, user_id"),
      supabaseAdmin.from("profiles").select("id, points"),
    ]);
    const pointsById = new Map((profiles ?? []).map((p) => [p.id, p.points]));
    const byGroup = new Map<string, { total: number; count: number }>();
    for (const m of members ?? []) {
      const agg = byGroup.get(m.group_id) ?? { total: 0, count: 0 };
      agg.total += pointsById.get(m.user_id) ?? 0;
      agg.count += 1;
      byGroup.set(m.group_id, agg);
    }

    return (groups ?? [])
      .map((g) => ({
        groupId: g.id,
        name: g.name,
        totalPoints: byGroup.get(g.id)?.total ?? 0,
        memberCount: byGroup.get(g.id)?.count ?? 0,
      }))
      .filter((g) => g.memberCount > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 50);
  },
);
