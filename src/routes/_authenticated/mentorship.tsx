import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { CalendarPlus, CheckCircle2, Clock, Trash2, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyMentor,
  listMyAvailability,
  listMentorOpenSlots,
  addAvailabilitySlot,
  deleteAvailabilitySlot,
  getMyBookings,
  bookMentorSlot,
  cancelMentorBooking,
} from "@/lib/mentor-booking.functions";

export const Route = createFileRoute("/_authenticated/mentorship")({
  head: () => ({
    meta: [
      { title: "Mentorship — Space" },
      {
        name: "description",
        content: "Book 1:1 sessions with your mentor, or manage your availability as a mentor.",
      },
      { property: "og:title", content: "Mentorship — Space" },
      {
        property: "og:description",
        content: "Book 1:1 sessions with your mentor, or manage your availability as a mentor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MentorshipPage,
});

function formatSlot(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const date = start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const startT = start.toISOString().slice(11, 16);
  const endT = end.toISOString().slice(11, 16);
  return `${date} · ${startT}–${endT} UTC`;
}

function MentorshipPage() {
  const { role } = useAuth();
  const isMentor = role === "admin" || role === "manager";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-bold text-indigo-900">Mentorship</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isMentor
              ? "Open time slots for your mentees to book, and see your upcoming sessions."
              : "Book a 1:1 session with your assigned mentor."}
          </p>
        </motion.div>

        {isMentor ? <MentorView /> : <MenteeView />}
      </main>
    </div>
  );
}

function BookingList({ title, emptyText }: { title: string; emptyText: string }) {
  const fetchBookings = useServerFn(getMyBookings);
  const cancel = useServerFn(cancelMentorBooking);
  const queryClient = useQueryClient();

  const { data: bookings } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchBookings(),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => cancel({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("Session cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["mentor-availability"] });
      queryClient.invalidateQueries({ queryKey: ["mentor-open-slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upcoming = (bookings ?? []).filter((b) => b.status === "confirmed");

  return (
    <BentoCard className="lg:col-span-6">
      <h2 className="font-display text-lg font-bold text-indigo-900">{title}</h2>
      {upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {upcoming.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <div>
                <p className="font-semibold text-indigo-900">
                  with {b.counterpartName ?? "Someone"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSlot(b.startTime, b.endTime)}
                </p>
              </div>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(b.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
              >
                <XCircle className="size-3.5" /> Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

function MentorView() {
  const queryClient = useQueryClient();
  const fetchSlots = useServerFn(listMyAvailability);
  const addSlot = useServerFn(addAvailabilitySlot);
  const removeSlot = useServerFn(deleteAvailabilitySlot);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: slots } = useQuery({
    queryKey: ["mentor-availability"],
    queryFn: () => fetchSlots(),
  });

  const addMutation = useMutation({
    mutationFn: () => addSlot({ data: { startTime: start, endTime: end } }),
    onSuccess: () => {
      toast.success("Slot added");
      setStart("");
      setEnd("");
      queryClient.invalidateQueries({ queryKey: ["mentor-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeSlot({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mentor-availability"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bento-grid mt-8">
      <BentoCard className="lg:col-span-6">
        <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-indigo-900">
          <CalendarPlus className="size-4" /> Open a new slot
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-indigo-700">
            Starts
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-indigo-700">
            Ends
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!start || !end || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {addMutation.isPending ? "Adding…" : "Add slot"}
        </button>

        <div className="mt-6 space-y-2">
          {(slots ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming slots yet.</p>
          )}
          {(slots ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />{" "}
                {formatSlot(s.startTime, s.endTime)}
              </span>
              {s.isBooked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 className="size-3" /> Booked
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(s.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </BentoCard>

      <BookingList title="Upcoming sessions" emptyText="No sessions booked yet." />
    </div>
  );
}

function MenteeView() {
  const queryClient = useQueryClient();
  const fetchMentor = useServerFn(getMyMentor);
  const fetchSlots = useServerFn(listMentorOpenSlots);
  const book = useServerFn(bookMentorSlot);

  const { data: mentor, isLoading: mentorLoading } = useQuery({
    queryKey: ["my-mentor"],
    queryFn: () => fetchMentor(),
  });
  const { data: slots } = useQuery({
    queryKey: ["mentor-open-slots"],
    queryFn: () => fetchSlots(),
    enabled: Boolean(mentor),
  });

  const bookMutation = useMutation({
    mutationFn: (availabilityId: string) => book({ data: { availabilityId } }),
    onSuccess: () => {
      toast.success("Session booked — check your email for confirmation");
      queryClient.invalidateQueries({ queryKey: ["mentor-open-slots"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (mentorLoading) {
    return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!mentor) {
    return (
      <BentoCard className="mt-8">
        <p className="text-sm text-muted-foreground">
          You don't have a mentor assigned yet. An admin can pair you with one from the admin panel.
        </p>
      </BentoCard>
    );
  }

  return (
    <div className="bento-grid mt-8">
      <BentoCard className="lg:col-span-6">
        <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-indigo-900">
          <UserRound className="size-4" /> {mentor.fullName ?? "Your mentor"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open slots — pick a time that works for you.
        </p>
        <div className="mt-4 space-y-2">
          {(slots ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No open slots right now — check back soon.
            </p>
          )}
          {(slots ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />{" "}
                {formatSlot(s.startTime, s.endTime)}
              </span>
              <button
                type="button"
                disabled={bookMutation.isPending}
                onClick={() => bookMutation.mutate(s.id)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                Book
              </button>
            </div>
          ))}
        </div>
      </BentoCard>

      <BookingList title="Your sessions" emptyText="No sessions booked yet." />
    </div>
  );
}
