import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SupabaseHealth = {
  connected: boolean;
  languages: string[];
  message: string;
};

export const getSupabaseHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<SupabaseHealth> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) {
      return { connected: false, languages: [], message: "Supabase env vars missing" };
    }

    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.from("languages").select("name").order("name");
    if (error) {
      return { connected: false, languages: [], message: error.message };
    }

    return {
      connected: true,
      languages: (data ?? []).map((l) => l.name),
      message: "Connected to Supabase",
    };
  },
);

export type PistonHealth = { reachable: boolean; runtimes: number; message: string };

/** Ping the self-hosted Piston execution service (admin system status card). */
export const getPistonHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<PistonHealth> => {
    const base = process.env["PISTON_URL"];
    if (!base) return { reachable: false, runtimes: 0, message: "PISTON_URL is not configured" };
    try {
      const headers: Record<string, string> = {};
      const key = process.env["PISTON_API_KEY"];
      if (key) headers["Authorization"] = key;
      const res = await fetch(`${base.replace(/\/$/, "")}/api/v2/runtimes`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return { reachable: false, runtimes: 0, message: `Piston responded ${res.status}` };
      }
      const runtimes = (await res.json()) as unknown[];
      return {
        reachable: true,
        runtimes: Array.isArray(runtimes) ? runtimes.length : 0,
        message: "Execution service reachable",
      };
    } catch (e) {
      return { reachable: false, runtimes: 0, message: (e as Error).message };
    }
  },
);
