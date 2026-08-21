import { createServerFn } from "@tanstack/react-start";
import { serverPublicClient } from "@/lib/supabase-server";

export type LanguageOption = { id: string; name: string; slug: string };

export type DictionaryTerm = {
  id: string;
  term: string;
  definition: string;
  example_code: string | null;
  tags: string[];
  language_id: string | null;
};

export type ReferenceLink = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  description: string | null;
  language_id: string | null;
};

export const getDictionary = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ languages: LanguageOption[]; terms: DictionaryTerm[] }> => {
    const supabase = serverPublicClient();
    const [langRes, termRes] = await Promise.all([
      supabase.from("languages").select("id, name, slug").order("name"),
      supabase
        .from("dictionary_terms")
        .select("id, term, definition, example_code, tags, language_id")
        .order("term")
        .limit(1000),
    ]);
    return {
      languages: langRes.data ?? [],
      terms: (termRes.data ?? []) as DictionaryTerm[],
    };
  },
);

export const getReference = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ languages: LanguageOption[]; links: ReferenceLink[] }> => {
    const supabase = serverPublicClient();
    const [langRes, linkRes] = await Promise.all([
      supabase.from("languages").select("id, name, slug").order("name"),
      supabase
        .from("reference_links")
        .select("id, title, url, source, description, language_id")
        .order("title")
        .limit(1000),
    ]);
    return {
      languages: langRes.data ?? [],
      links: (linkRes.data ?? []) as ReferenceLink[],
    };
  },
);
