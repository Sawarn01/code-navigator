import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { assignMentor, listAssignments } from "@/lib/mentorship.functions";
import { listUsers } from "@/lib/admin.functions";

export function MentorPanel() {
  const fetchAssignments = useServerFn(listAssignments);
  const fetchUsers = useServerFn(listUsers);
  const assign = useServerFn(assignMentor);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["mentor-assignments"],
    queryFn: () => fetchAssignments(),
    retry: false,
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (vars: { studentId: string; mentorId: string }) => assign({ data: vars }),
    onSuccess: () => {
      toast.success("Mentor updated");
      queryClient.invalidateQueries({ queryKey: ["mentor-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return <p className="text-sm text-destructive">Admin role required to manage mentorship.</p>;
  }

  const mentors = data?.mentors ?? [];
  const mentorFor = new Map((data?.assignments ?? []).map((a) => [a.student_id, a.mentor_id]));
  const students = (users ?? []).filter((u) => u.role === "student");

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-indigo-900">Mentorship pairs</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Assign each student to a manager. Managers see their mentees under “My mentees”.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading pairs…</p>
      ) : mentors.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Promote at least one member to manager before assigning mentees.
        </p>
      ) : students.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No students to assign yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-indigo-900">
                {s.full_name ?? s.email ?? "Unnamed"}
              </span>
              <select
                value={mentorFor.get(s.id) ?? ""}
                disabled={mutation.isPending}
                onChange={(e) => mutation.mutate({ studentId: s.id, mentorId: e.target.value })}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
              >
                <option value="">No mentor</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? m.id.slice(0, 8)} ({m.role})
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
