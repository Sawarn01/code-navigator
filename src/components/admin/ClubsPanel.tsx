import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Plus, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";
import { deleteClub, getClubs, saveClub, type Club } from "@/lib/clubs.functions";

const emptyForm = {
  id: null as string | null,
  name: "",
  description: "",
  category: "",
  meeting_info: "",
  contact_email: "",
  logo_url: "",
};

export function ClubsPanel() {
  const queryClient = useQueryClient();
  const fetchClubs = useServerFn(getClubs);
  const persistClub = useServerFn(saveClub);
  const removeClub = useServerFn(deleteClub);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, error } = useQuery({
    queryKey: ["admin-clubs"],
    queryFn: () => fetchClubs(),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-clubs"] });
    queryClient.invalidateQueries({ queryKey: ["clubs"] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      persistClub({
        data: {
          id: form.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          category: form.category.trim() || null,
          meeting_info: form.meeting_info.trim() || null,
          contact_email: form.contact_email.trim() || null,
          logo_url: form.logo_url.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Club updated" : "Club created");
      setShowForm(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (clubId: string) => removeClub({ data: { clubId } }),
    onSuccess: () => {
      toast.success("Club deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Clubs are manageable by managers and admins only.
      </p>
    );
  }

  function openEdit(club: Club) {
    setForm({
      id: club.id,
      name: club.name,
      description: club.description ?? "",
      category: club.category ?? "",
      meeting_info: club.meeting_info ?? "",
      contact_email: club.contact_email ?? "",
      logo_url: club.logo_url ?? "",
    });
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl surface-tint text-indigo-700">
          <Users2 className="size-4" />
        </span>
        <h2 className="text-lg">Clubs</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage the official college clubs students can browse and join.
      </p>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          setForm(emptyForm);
          setShowForm(true);
        }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
      >
        <Plus className="size-4" /> New club
      </motion.button>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-indigo-50/60 text-xs uppercase tracking-wide text-indigo-700">
            <tr>
              <th className="px-4 py-2">Club</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(data?.clubs ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border/70 hover:bg-accent/50">
                <td className="px-4 py-2 font-medium text-indigo-900">{c.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.category ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.memberCount}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(data?.clubs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No clubs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/40 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
                >
                  <h3 className="font-display text-lg font-semibold text-indigo-900">
                    {form.id ? "Edit club" : "New club"}
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                      Name
                      <input
                        autoFocus
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Robotics Club"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                      Description
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                        placeholder="What does this club do?"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900">
                      Category
                      <input
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        placeholder="Technical, Cultural, Sports…"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900">
                      Contact email
                      <input
                        value={form.contact_email}
                        onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                        placeholder="club@college.edu"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                      Meeting info
                      <input
                        value={form.meeting_info}
                        onChange={(e) => setForm((f) => ({ ...f, meeting_info: e.target.value }))}
                        placeholder="Wednesdays 5pm, Room 204"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                      Logo URL
                      <input
                        value={form.logo_url}
                        onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                        placeholder="https://…"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (!form.name.trim()) {
                          toast.error("Name is required");
                          return;
                        }
                        saveMutation.mutate();
                      }}
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {form.id ? "Save changes" : "Create club"}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {deleteTarget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/40 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 text-amber-500" />
                    <div>
                      <h3 className="font-display text-lg font-semibold text-indigo-900">
                        Delete “{deleteTarget.name}”?
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This removes the club and every student's membership in it. This cannot be
                        undone.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const id = deleteTarget.id;
                        setDeleteTarget(null);
                        deleteMutation.mutate(id);
                      }}
                      className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Delete club
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
