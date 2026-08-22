import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyMentor = { id: string; fullName: string | null } | null;

export const getMyMentor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyMentor> => {
    const { data: assignment } = await context.supabase
      .from("mentor_assignments")
      .select("mentor_id")
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!assignment) return null;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", assignment.mentor_id)
      .maybeSingle();
    return { id: assignment.mentor_id, fullName: profile?.full_name ?? null };
  });

export type AvailabilitySlot = {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
};

/** Mentor: every slot they've opened, booked or not. */
export const listMyAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AvailabilitySlot[]> => {
    const { data } = await context.supabase
      .from("mentor_availability")
      .select("id, start_time, end_time, is_booked")
      .eq("mentor_id", context.userId)
      .gte("start_time", new Date().toISOString())
      .order("start_time");
    return (data ?? []).map((s) => ({
      id: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      isBooked: s.is_booked,
    }));
  });

/** Student: open slots for their assigned mentor only (RLS already scopes this). */
export const listMentorOpenSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AvailabilitySlot[]> => {
    const { data: assignment } = await context.supabase
      .from("mentor_assignments")
      .select("mentor_id")
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!assignment) return [];

    const { data } = await context.supabase
      .from("mentor_availability")
      .select("id, start_time, end_time, is_booked")
      .eq("mentor_id", assignment.mentor_id)
      .eq("is_booked", false)
      .gte("start_time", new Date().toISOString())
      .order("start_time");
    return (data ?? []).map((s) => ({
      id: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      isBooked: s.is_booked,
    }));
  });

export const addAvailabilitySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { startTime: string; endTime: string }) => {
    const startTime = new Date(input.startTime).toISOString();
    const endTime = new Date(input.endTime).toISOString();
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      throw new Error("End time must be after start time");
    }
    return { startTime, endTime };
  })
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { data: created, error } = await context.supabase
      .from("mentor_availability")
      .insert({ mentor_id: context.userId, start_time: data.startTime, end_time: data.endTime })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteAvailabilitySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("mentor_availability")
      .delete()
      .eq("id", data.id)
      .eq("mentor_id", context.userId)
      .eq("is_booked", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type MentorBooking = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  counterpartName: string | null;
  isMentor: boolean;
};

export const getMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MentorBooking[]> => {
    const { data: bookings } = await context.supabase
      .from("mentor_bookings")
      .select("id, mentor_id, mentee_id, status, availability_id")
      .or(`mentor_id.eq.${context.userId},mentee_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (!bookings?.length) return [];

    const availabilityIds = bookings.map((b) => b.availability_id);
    const { data: slots } = await context.supabase
      .from("mentor_availability")
      .select("id, start_time, end_time")
      .in("id", availabilityIds);
    const slotById = new Map((slots ?? []).map((s) => [s.id, s]));

    const counterpartIds = bookings.map((b) =>
      b.mentor_id === context.userId ? b.mentee_id : b.mentor_id,
    );
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", counterpartIds);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return bookings.map((b) => {
      const isMentor = b.mentor_id === context.userId;
      const slot = slotById.get(b.availability_id);
      return {
        id: b.id,
        startTime: slot?.start_time ?? "",
        endTime: slot?.end_time ?? "",
        status: b.status,
        counterpartName: nameById.get(isMentor ? b.mentee_id : b.mentor_id) ?? null,
        isMentor,
      };
    });
  });

export const bookMentorSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { availabilityId: string }) => ({
    availabilityId: String(input.availabilityId),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("book_mentor_slot", {
      _availability_id: data.availabilityId,
      _mentee_id: context.userId,
    });
    if (error) throw new Error(error.message);

    await sendBookingEmails(data.availabilityId, context.userId).catch((e) => {
      console.error("mentor booking confirmation email failed", e);
    });
    return { ok: true };
  });

export const cancelMentorBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => ({ bookingId: String(input.bookingId) }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("cancel_mentor_booking", {
      _booking_id: data.bookingId,
      _actor_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function sendBookingEmails(availabilityId: string, menteeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, escapeHtml } = await import("@/lib/email.server");

  const { data: slot } = await supabaseAdmin
    .from("mentor_availability")
    .select("mentor_id, start_time, end_time")
    .eq("id", availabilityId)
    .maybeSingle();
  if (!slot) return;

  const [{ data: mentorProfile }, { data: menteeProfile }, mentorUser, menteeUser] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", slot.mentor_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", menteeId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(slot.mentor_id),
      supabaseAdmin.auth.admin.getUserById(menteeId),
    ]);

  const when = new Date(slot.start_time).toISOString().slice(0, 16).replace("T", " ");
  const mentorEmail = mentorUser.data.user?.email;
  const menteeEmail = menteeUser.data.user?.email;
  const mentorName = mentorProfile?.full_name ?? "your mentor";
  const menteeName = menteeProfile?.full_name ?? "your mentee";

  const html = (forName: string, withName: string) => `
    <div style="font-family:Inter,Segoe UI,sans-serif;background:#ffffff;color:#1e1b4b;padding:24px">
      <h1 style="font-size:20px;margin:0 0 8px">Mentor session booked</h1>
      <p style="margin:0 0 16px">Hi ${escapeHtml(forName)}, a session with ${escapeHtml(withName)} is confirmed.</p>
      <p style="background:#eef2ff;border-radius:12px;padding:14px;display:inline-block"><strong>${when} UTC</strong></p>
    </div>`;

  if (mentorEmail)
    await sendEmail(mentorEmail, "Mentor session booked", html(mentorName, menteeName));
  if (menteeEmail)
    await sendEmail(menteeEmail, "Mentor session booked", html(menteeName, mentorName));
}
