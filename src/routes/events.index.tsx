import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Moon, Plus, Sun, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { createEvent, EVENT_TYPES, getEvents } from "@/lib/events.functions";
import { eventMeta, formatEventDate } from "@/components/events/event-style";
import { useAuth } from "@/hooks/useAuth";

const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => getEvents(),
});

export const Route = createFileRoute("/events/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQuery),
  head: () => ({
    meta: [
      { title: "Hackathons & Events — Space" },
      {
        name: "description",
        content:
          "Mini-hackathons, Saturday Day and Saturday Night shifts, virtual and offline meetups — see the schedule and RSVP.",
      },
      { property: "og:title", content: "Hackathons & Events — Space" },
      {
        property: "og:description",
        content: "Every Saturday: a Day hackathon and a Night hackathon. Pick your shift.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load events. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: EventsPage,
});

function EventsPage() {
  const { data } = useSuspenseQuery(eventsQuery);
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "manager";
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  const now = Date.now();
  const upcoming = data.events.filter((e) => new Date(e.start_time).getTime() >= now);
  const past = data.events
    .filter((e) => new Date(e.start_time).getTime() < now)
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));

  const visibleUpcoming = upcoming.filter((e) => typeFilter === "all" || e.type === typeFilter);

  const months = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const e of visibleUpcoming) {
      const key = new Date(e.start_time).toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [visibleUpcoming]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-3xl font-bold text-indigo-900">Hackathons & Events</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {upcoming.length} upcoming sessions. Reserve your seat — spots are tracked live.
            </p>
          </div>
          {isStaff && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
            >
              <Plus className="size-4" /> Create event
            </motion.button>
          )}
        </motion.div>

        <AnimatePresence>
          {showForm && isStaff && <CreateEventForm onDone={() => setShowForm(false)} />}
        </AnimatePresence>

        <BentoCard className="mt-8">
          <h2 className="font-display text-lg font-bold text-indigo-900">The Saturday cadence</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl surface-tint p-3">
              <Sun className="mt-0.5 size-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">Saturday Day · 10:00–18:00</p>
                <p className="text-xs text-muted-foreground">
                  Daylight shift for team builds and interview-style sprints.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-indigo-900 p-3 text-indigo-50">
              <Moon className="mt-0.5 size-5" />
              <div>
                <p className="text-sm font-semibold">Saturday Night · 20:00–02:00</p>
                <p className="text-xs text-indigo-200">
                  Night shift for competitive programming and endurance rounds.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Every Saturday runs both shifts — pick one, or do both if you can survive it.
          </p>
        </BentoCard>

        <div className="mt-8 flex flex-wrap gap-2">
          {["all", ...EVENT_TYPES].map((t) => {
            const meta = t === "all" ? null : eventMeta(t);
            return (
              <motion.button
                key={t}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  typeFilter === t
                    ? "border-indigo-600 bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {meta ? <meta.icon className="size-3.5" /> : <CalendarDays className="size-3.5" />}
                {meta?.label ?? "All events"}
              </motion.button>
            );
          })}
        </div>

        <section className="mt-8 space-y-10">
          {months.map(([month, list]) => (
            <div key={month}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-indigo-700">
                {month}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {list.map((event, i) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    attendees={data.counts[event.id] ?? 0}
                    delay={i * 0.05}
                  />
                ))}
              </div>
            </div>
          ))}
          {months.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No upcoming events for this filter.
            </p>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-bold text-indigo-900">Past events</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {past.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  attendees={data.counts[event.id] ?? 0}
                  delay={i * 0.04}
                  muted
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function EventCard({
  event,
  attendees,
  delay,
  muted,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    start_time: string;
    location: string | null;
  };
  attendees: number;
  delay: number;
  muted?: boolean;
}) {
  const meta = eventMeta(event.type);
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -4 }}
      className={`rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-indigo-300 ${
        muted ? "opacity-75" : ""
      }`}
    >
      <Link to="/events/$eventId" params={{ eventId: event.id }} className="block">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}
          >
            <meta.icon className="size-3.5" /> {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" /> {attendees}
          </span>
        </div>
        <h3 className="mt-3 font-display text-lg font-bold text-indigo-900">{event.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" /> {formatEventDate(event.start_time)} UTC
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {event.location}
            </span>
          )}
        </div>
      </Link>
    </motion.article>
  );
}

function CreateEventForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const submit = useServerFn(createEvent);
  const mutation = useMutation({
    mutationFn: (vars: {
      title: string;
      description: string;
      type: string;
      start_time: string;
      end_time: string | null;
      location: string | null;
      registration_link: string | null;
      capacity: number | null;
    }) => submit({ data: vars }),
    onSuccess: () => {
      toast.success("Event created");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        mutation.mutate({
          title: String(fd.get("title") ?? ""),
          description: String(fd.get("description") ?? ""),
          type: String(fd.get("type") ?? "mini-hackathon"),
          start_time: String(fd.get("start_time") ?? ""),
          end_time: String(fd.get("end_time") ?? "") || null,
          location: String(fd.get("location") ?? "") || null,
          registration_link: String(fd.get("registration_link") ?? "") || null,
          capacity: fd.get("capacity") ? Number(fd.get("capacity")) : null,
        });
      }}
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          placeholder="Event title"
          className="rounded-xl border border-input px-3 py-2 text-sm sm:col-span-2"
        />
        <textarea
          name="description"
          placeholder="Description"
          rows={3}
          className="rounded-xl border border-input px-3 py-2 text-sm sm:col-span-2"
        />
        <select name="type" className="rounded-xl border border-input px-3 py-2 text-sm">
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {eventMeta(t).label}
            </option>
          ))}
        </select>
        <input
          name="location"
          placeholder="Location or virtual link label"
          className="rounded-xl border border-input px-3 py-2 text-sm"
        />
        <label className="text-xs font-semibold text-indigo-700">
          Starts
          <input
            name="start_time"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-xl border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-indigo-700">
          Ends
          <input
            name="end_time"
            type="datetime-local"
            className="mt-1 w-full rounded-xl border border-input px-3 py-2 text-sm"
          />
        </label>
        <input
          name="registration_link"
          placeholder="External registration link (optional)"
          className="rounded-xl border border-input px-3 py-2 text-sm sm:col-span-2"
        />
        <label className="text-xs font-semibold text-indigo-700">
          Capacity (optional)
          <input
            name="capacity"
            type="number"
            min={1}
            placeholder="Unlimited"
            className="mt-1 w-full rounded-xl border border-input px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
        >
          {mutation.isPending ? "Creating…" : "Create event"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}
