import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export const EVENT_TYPES = [
  "mini-hackathon",
  "saturday-day",
  "saturday-night",
  "virtual",
  "offline",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type SpaceEvent = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  registration_link: string | null;
  banner_url: string | null;
  capacity: number | null;
};

const COLS =
  "id, title, description, type, start_time, end_time, location, registration_link, banner_url, capacity";

async function assertStaff(
  supabase: { rpc: (fn: "is_staff", args: { _user_id: string }) => Promise<{ data: unknown }> },
  userId: string,
) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: manager or admin role required");
}

export const getEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ events: SpaceEvent[]; counts: Record<string, number> }> => {
    const supabase = serverPublicClient();
    const [{ data: events }, { data: regs }] = await Promise.all([
      supabase.from("events").select(COLS).order("start_time", { ascending: true }).limit(500),
      supabase.from("event_registrations").select("event_id").limit(5000),
    ]);
    const counts: Record<string, number> = {};
    for (const r of regs ?? []) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
    return { events: (events ?? []) as SpaceEvent[], counts };
  },
);

export const getEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(
    async ({
      data,
    }): Promise<{
      event: SpaceEvent | null;
      attendees: number;
      waitlisted: number;
      full: boolean;
    }> => {
      const supabase = serverPublicClient();
      const { data: event } = await supabase
        .from("events")
        .select(COLS)
        .eq("id", data.eventId)
        .maybeSingle();
      if (!event) return { event: null, attendees: 0, waitlisted: 0, full: false };

      const { data: statuses } = await supabase
        .from("event_registrations")
        .select("status")
        .eq("event_id", data.eventId);
      const attendees = (statuses ?? []).filter(
        (r) => r.status === "registered" || r.status === "attended",
      ).length;
      const waitlisted = (statuses ?? []).filter((r) => r.status === "waitlisted").length;

      return {
        event: event as SpaceEvent,
        attendees,
        waitlisted,
        full: event.capacity != null && attendees >= event.capacity,
      };
    },
  );

export const getMyRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ eventIds: string[] }> => {
    const { data } = await context.supabase
      .from("event_registrations")
      .select("event_id")
      .eq("user_id", context.userId);
    return { eventIds: (data ?? []).map((r) => r.event_id) };
  });

export const getMyEventStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ context, data }): Promise<{ status: string | null }> => {
    const { data: reg } = await context.supabase
      .from("event_registrations")
      .select("status")
      .eq("event_id", data.eventId)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { status: reg?.status ?? null };
  });

export const toggleRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; register: boolean }) => ({
    eventId: String(input.eventId),
    register: Boolean(input.register),
  }))
  .handler(async ({ context, data }): Promise<{ registered: boolean; status: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.register) {
      const { data: status, error } = await supabaseAdmin.rpc("register_for_event", {
        _event_id: data.eventId,
        _user_id: context.userId,
      });
      if (error) throw new Error(error.message);
      return { registered: true, status: (status as string | null) ?? "registered" };
    }

    const { error } = await context.supabase
      .from("event_registrations")
      .delete()
      .eq("event_id", data.eventId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("promote_next_waitlisted", { _event_id: data.eventId });
    return { registered: false, status: null };
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      description: string;
      type: string;
      start_time: string;
      end_time: string | null;
      location: string | null;
      registration_link: string | null;
      capacity?: number | null;
    }) => {
      const title = String(input.title ?? "").trim();
      const type = String(input.type ?? "");
      if (!title) throw new Error("Title is required");
      if (!(EVENT_TYPES as readonly string[]).includes(type)) throw new Error("Invalid event type");
      if (!input.start_time) throw new Error("Start time is required");
      const capacity =
        input.capacity === null ||
        input.capacity === undefined ||
        Number.isNaN(Number(input.capacity))
          ? null
          : Math.max(1, Math.round(Number(input.capacity)));
      return {
        title,
        description: String(input.description ?? "").trim() || null,
        type,
        start_time: new Date(input.start_time).toISOString(),
        end_time: input.end_time ? new Date(input.end_time).toISOString() : null,
        location: input.location?.trim() || null,
        registration_link: input.registration_link?.trim() || null,
        capacity,
      };
    },
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);

    const { data: created, error } = await context.supabase
      .from("events")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export type EventAttendee = {
  userId: string;
  fullName: string | null;
  status: string;
  registeredAt: string;
};

export const getEventAttendees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ context, data }): Promise<EventAttendee[]> => {
    await assertStaff(context.supabase, context.userId);

    const { data: regs } = await context.supabase
      .from("event_registrations")
      .select("user_id, status, registered_at")
      .eq("event_id", data.eventId)
      .order("registered_at", { ascending: true });

    const ids = (regs ?? []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (regs ?? []).map((r) => ({
      userId: r.user_id,
      fullName: nameById.get(r.user_id) ?? null,
      status: r.status,
      registeredAt: r.registered_at,
    }));
  });

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; userId: string; attended: boolean }) => ({
    eventId: String(input.eventId),
    userId: String(input.userId),
    attended: Boolean(input.attended),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertStaff(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("event_registrations")
      .update({
        status: data.attended ? "attended" : "no_show",
        checked_in_at: data.attended ? new Date().toISOString() : null,
      })
      .eq("event_id", data.eventId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitEventFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; rating: number; comment?: string | null }) => ({
    eventId: String(input.eventId),
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating)))),
    comment: input.comment ? String(input.comment).trim().slice(0, 1000) : null,
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("event_feedback").upsert(
      {
        event_id: data.eventId,
        user_id: context.userId,
        rating: data.rating,
        comment: data.comment,
      },
      { onConflict: "event_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyEventFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(
    async ({ context, data }): Promise<{ rating: number; comment: string | null } | null> => {
      const { data: row } = await context.supabase
        .from("event_feedback")
        .select("rating, comment")
        .eq("event_id", data.eventId)
        .eq("user_id", context.userId)
        .maybeSingle();
      return row ?? null;
    },
  );

/** Aggregate only (no raw comments) — event_feedback RLS is owner+staff only, so this reads via service role. */
export const getEventFeedbackSummary = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string }) => ({ eventId: String(input.eventId) }))
  .handler(async ({ data }): Promise<{ average: number; count: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("event_feedback")
      .select("rating")
      .eq("event_id", data.eventId);
    const count = rows?.length ?? 0;
    const average = count
      ? Math.round(((rows ?? []).reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;
    return { average, count };
  });
