import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listRuntimes, setRuntime } from "@/lib/admin.functions";

export function RuntimePanel() {
  const fetchRuntimes = useServerFn(listRuntimes);
  const save = useServerFn(setRuntime);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-runtimes"],
    queryFn: () => fetchRuntimes(),
    retry: false,
  });

  const [draft, setDraft] = useState<Record<string, { lang: string; version: string }>>({});
  useEffect(() => {
    if (!data) return;
    setDraft(
      Object.fromEntries(
        data.map((l) => [l.id, { lang: l.piston_language ?? "", version: l.piston_version ?? "" }]),
      ),
    );
  }, [data]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; piston_language: string; piston_version: string }) =>
      save({ data: vars }),
    onSuccess: () => {
      toast.success("Runtime saved");
      queryClient.invalidateQueries({ queryKey: ["admin-runtimes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <p className="text-sm text-destructive">Admin role required.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading runtimes…</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-indigo-900">Piston runtimes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste the exact language + version strings from <code>GET /api/v2/runtimes</code> on your
        Piston instance.
      </p>
      <div className="mt-4 space-y-2">
        {(data ?? []).map((l) => {
          const d = draft[l.id] ?? { lang: "", version: "" };
          return (
            <div key={l.id} className="grid items-center gap-2 sm:grid-cols-[120px_1fr_1fr_auto]">
              <span className="text-sm font-medium text-indigo-900">{l.name}</span>
              <input
                value={d.lang}
                placeholder="piston language (e.g. python)"
                onChange={(e) => setDraft((p) => ({ ...p, [l.id]: { ...d, lang: e.target.value } }))}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
              />
              <input
                value={d.version}
                placeholder="version (e.g. 3.10.0)"
                onChange={(e) =>
                  setDraft((p) => ({ ...p, [l.id]: { ...d, version: e.target.value } }))
                }
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
              />
              <button
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({ id: l.id, piston_language: d.lang, piston_version: d.version })
                }
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                Save
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
