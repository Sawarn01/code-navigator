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
