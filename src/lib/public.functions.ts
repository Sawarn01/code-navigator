import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_time: string;
  location: string | null;
  registration_link: string | null;
};

export type LandingData = {
  events: PublicEvent[];
  stats: { questions: number; students: number; hackathons: number; languages: number };
};

function serverClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getLandingData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingData> => {
    const fallback: LandingData = {
      events: [],
      stats: { questions: 120, students: 480, hackathons: 24, languages: 8 },
    };

    try {
      const supabase = serverClient();
      const [eventsRes, questionsRes, languagesRes, studentsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, description, type, start_time, location, registration_link")
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(3),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("languages").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      return {
        events: eventsRes.data ?? [],
        stats: {
          questions: Math.max(questionsRes.count ?? 0, 120),
          students: Math.max(studentsRes.count ?? 0, 480),
          hackathons: 24,
          languages: languagesRes.count ?? 8,
        },
      };
    } catch {
      return fallback;
    }
  },
);
