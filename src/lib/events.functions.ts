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
};

const COLS =
  "id, title, description, type, start_time, end_time, location, registration_link, banner_url";

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
  .handler(async ({ data }): Promise<{ event: SpaceEvent | null; attendees: number }> => {
    const supabase = serverPublicClient();
    const { data: event } = await supabase
      .from("events")
      .select(COLS)
      .eq("id", data.eventId)
      .maybeSingle();
    if (!event) return { event: null, attendees: 0 };
    const { count } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);
    return { event: event as SpaceEvent, attendees: count ?? 0 };
  });

export const getMyRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ eventIds: string[] }> => {
    const { data } = await context.supabase
      .from("event_registrations")
      .select("event_id")
      .eq("user_id", context.userId);
    return { eventIds: (data ?? []).map((r) => r.event_id) };
  });

export const toggleRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; register: boolean }) => ({
    eventId: String(input.eventId),
    register: Boolean(input.register),
  }))
  .handler(async ({ context, data }) => {
    if (data.register) {
      const { error } = await context.supabase
        .from("event_registrations")
        .insert({ event_id: data.eventId, user_id: context.userId });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("event_registrations")
        .delete()
        .eq("event_id", data.eventId)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    return { registered: data.register };
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    description: string;
    type: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    registration_link: string | null;
  }) => {
    const title = String(input.title ?? "").trim();
    const type = String(input.type ?? "");
    if (!title) throw new Error("Title is required");
    if (!(EVENT_TYPES as readonly string[]).includes(type)) throw new Error("Invalid event type");
    if (!input.start_time) throw new Error("Start time is required");
    return {
      title,
      description: String(input.description ?? "").trim() || null,
      type,
      start_time: new Date(input.start_time).toISOString(),
      end_time: input.end_time ? new Date(input.end_time).toISOString() : null,
      location: input.location?.trim() || null,
      registration_link: input.registration_link?.trim() || null,
    };
  })
  .handler(async ({ context, data }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!isStaff) throw new Error("Forbidden: admin or manager role required");

    const { data: created, error } = await context.supabase
      .from("events")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });
