import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // pg_cron authenticates with the project's publishable/anon key.
        const apikey = request.headers.get("apikey");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { runWeeklyDigest } = await import("@/lib/digest.server");
          const result = await runWeeklyDigest();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("weekly-digest failed", error);
          return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
