import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/event-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // pg_cron authenticates with the project's publishable/anon key.
        const apikey = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { runEventReminders } = await import("@/lib/event-reminders.server");
          const result = await runEventReminders();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("event-reminders failed", error);
          return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
