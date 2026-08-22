import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  getEvent,
  getMyEventStatus,
  toggleRegistration,
  getEventAttendees,
  markAttendance,
  submitEventFeedback,
  getMyEventFeedback,
  getEventFeedbackSummary,
} from "@/lib/events.functions";
import { eventMeta, formatEventDate } from "@/components/events/event-style";
import { TeamPanel } from "@/components/events/TeamPanel";
import { useAuth } from "@/hooks/useAuth";

const eventQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event", eventId],
    queryFn: () => getEvent({ data: { eventId } }),
  });

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(eventQuery(params.eventId));
    if (!result.event) throw notFound();
    return { title: result.event.title, description: result.event.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Event unavailable — Space" }, { name: "robots", content: "noindex" }],
      };
    }
    const description = loaderData.description ?? "A hackathon on Space.";
    return {
      meta: [
        { title: `${loaderData.title} — Space` },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: `${loaderData.title} — Space` },
        { property: "og:description", content: description.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load this event. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Event not found.
    </div>
  ),
  component: EventDetailPage,
});

function useCountdown(target: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { data } = useSuspenseQuery(eventQuery(eventId));
  const { isAuthenticated, role } = useAuth();
  const isStaff = role === "admin" || role === "manager";
  const queryClient = useQueryClient();

  const fetchStatus = useServerFn(getMyEventStatus);
  const rsvp = useServerFn(toggleRegistration);

  const { data: myStatus } = useQuery({
    queryKey: ["my-event-status", eventId],
    queryFn: () => fetchStatus({ data: { eventId } }),
    enabled: isAuthenticated,
  });
  const status = myStatus?.status ?? null;
  const registered = status === "registered" || status === "waitlisted" || status === "attended";

  const mutation = useMutation({
    mutationFn: (register: boolean) => rsvp({ data: { eventId, register } }),
    onSuccess: (r, register) => {
      toast.success(
        !register
          ? "Registration cancelled"
          : r.status === "waitlisted"
            ? "Event is full — you're on the waitlist"
            : "You're in — see you there",
      );
      queryClient.invalidateQueries({ queryKey: ["my-event-status", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const event = data.event!;
  const meta = eventMeta(event.type);
  const countdown = useCountdown(event.start_time);
  const hasEnded = new Date(event.end_time ?? event.start_time).getTime() < Date.now();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/events" className="text-xs font-semibold text-indigo-700 hover:underline">
            ← All events
          </Link>
          <span
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.chip}`}
          >
            <meta.icon className="size-3.5" /> {meta.label}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold text-indigo-900">{event.title}</h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        </motion.div>

        {countdown && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 grid grid-cols-4 gap-3"
          >
            {[
              ["Days", countdown.days],
              ["Hours", countdown.hours],
              ["Minutes", countdown.minutes],
              ["Seconds", countdown.seconds],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl surface-tint p-4 text-center">
                <p className="font-display text-2xl font-bold text-indigo-900">
                  {String(value).padStart(2, "0")}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-indigo-700">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 grid gap-4 sm:grid-cols-2"
        >
          <InfoTile
            icon={CalendarDays}
            label="Starts"
            value={`${formatEventDate(event.start_time)} UTC`}
          />
          {event.end_time && (
            <InfoTile icon={Clock} label="Ends" value={`${formatEventDate(event.end_time)} UTC`} />
          )}
          <InfoTile icon={MapPin} label="Where" value={event.location ?? "To be announced"} />
          <InfoTile
            icon={Users}
            label={event.capacity != null ? `Registered (of ${event.capacity})` : "Registered"}
            value={`${data.attendees} student${data.attendees === 1 ? "" : "s"}${
              data.waitlisted > 0 ? ` · ${data.waitlisted} waitlisted` : ""
            }`}
          />
        </motion.div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(!registered)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                registered
                  ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "bg-primary text-primary-foreground hover:bg-indigo-700"
              }`}
            >
              {mutation.isPending
                ? "Saving…"
                : status === "waitlisted"
                  ? "You're on the waitlist — cancel"
                  : registered
                    ? "You're registered — cancel RSVP"
                    : data.full
                      ? "Event is full — join waitlist"
                      : "Register / RSVP"}
            </motion.button>
          ) : (
            <Link
              to="/auth"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
            >
              Sign in to register
            </Link>
          )}
          {event.registration_link && (
            <a
              href={event.registration_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-accent"
            >
              External details <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        {["mini-hackathon", "saturday-day", "saturday-night"].includes(event.type) && (
          <TeamPanel eventId={eventId} />
        )}

        {isStaff && <AttendeePanel eventId={eventId} />}

        {hasEnded && <EventFeedbackPanel eventId={eventId} canRate={status === "attended"} />}
      </main>
    </div>
  );
}

function AttendeePanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const fetchAttendees = useServerFn(getEventAttendees);
  const mark = useServerFn(markAttendance);

  const { data: attendees } = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => fetchAttendees({ data: { eventId } }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; attended: boolean }) =>
      mark({ data: { eventId, ...vars } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!attendees?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 className="font-display text-lg font-bold text-indigo-900">
        Attendees ({attendees.length}) — staff only
      </h2>
      <ul className="mt-4 divide-y divide-border">
        {attendees.map((a) => (
          <li key={a.userId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div>
              <p className="font-medium text-indigo-900">{a.fullName ?? "Unnamed"}</p>
              <p className="text-xs capitalize text-muted-foreground">{a.status}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ userId: a.userId, attended: true })}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 className="size-3.5" /> Attended
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ userId: a.userId, attended: false })}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
              >
                <XCircle className="size-3.5" /> No-show
              </button>
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function EventFeedbackPanel({ eventId, canRate }: { eventId: string; canRate: boolean }) {
  const queryClient = useQueryClient();
  const fetchSummary = useServerFn(getEventFeedbackSummary);
  const fetchMine = useServerFn(getMyEventFeedback);
  const save = useServerFn(submitEventFeedback);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["event-feedback-summary", eventId],
    queryFn: () => fetchSummary({ data: { eventId } }),
  });
  const { data: mine } = useQuery({
    queryKey: ["my-event-feedback", eventId],
    queryFn: () => fetchMine({ data: { eventId } }),
    enabled: canRate,
  });

  const mutation = useMutation({
    mutationFn: () => save({ data: { eventId, rating, comment: comment || null } }),
    onSuccess: () => {
      toast.success("Thanks for the feedback!");
      queryClient.invalidateQueries({ queryKey: ["event-feedback-summary", eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-event-feedback", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeRating = mine?.rating ?? rating;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 className="font-display text-lg font-bold text-indigo-900">Feedback</h2>
      {summary && summary.count > 0 ? (
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="size-4 fill-indigo-500 text-indigo-500" /> {summary.average} average from{" "}
          {summary.count} student{summary.count === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">No feedback yet.</p>
      )}

      {canRate && !mine && (
        <div className="mt-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <Star
                  className={`size-6 ${
                    n <= activeRating ? "fill-indigo-500 text-indigo-500" : "text-indigo-200"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="How was it? (optional)"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="button"
            disabled={rating === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Submit feedback
          </button>
        </div>
      )}
      {canRate && mine && (
        <p className="mt-3 text-sm text-indigo-700">
          You rated this event {mine.rating}/5. Thanks!
        </p>
      )}
    </motion.div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-indigo-900">{value}</p>
    </div>
  );
}
