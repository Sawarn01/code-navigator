import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMyAccount,
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Space" },
      {
        name: "description",
        content: "Manage notification preferences, the weekly email digest, and your Space account.",
      },
      { property: "og:title", content: "Settings — Space" },
      {
        property: "og:description",
        content: "Notification preferences and account management on Space.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const TOGGLES: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "badge_earned", label: "Badges", hint: "When you unlock a new badge" },
  { key: "forum_reply", label: "Forum replies", hint: "When someone replies to your thread" },
  { key: "event_reminder", label: "Event reminders", hint: "Ahead of hackathons you joined" },
  { key: "streak_risk", label: "Streak warnings", hint: "When your streak is about to break" },
  { key: "mentor_note", label: "Mentor check-ins", hint: "When your mentor logs a check-in" },
  { key: "group_invite", label: "Group invites", hint: "When you're invited to a study group" },
];

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        checked ? "bg-primary" : "bg-indigo-100"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-0.5 size-5 rounded-full bg-background shadow-sm"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchPrefs = useServerFn(getNotificationPrefs);
  const savePrefs = useServerFn(updateNotificationPrefs);
  const removeAccount = useServerFn(deleteMyAccount);

  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => fetchPrefs(),
  });

  const prefsMutation = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => savePrefs({ data: patch }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["notification-prefs"] });
      const previous = queryClient.getQueryData<NotificationPrefs>(["notification-prefs"]);
      if (previous) {
        queryClient.setQueryData(["notification-prefs"], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (e: Error, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["notification-prefs"], ctx.previous);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Preferences saved"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notification-prefs"] }),
  });

  const passwordMutation = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Password updated");
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeAccount({ data: { confirm: confirmText } }),
    onSuccess: async () => {
      toast.success("Account deleted");
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-bold text-indigo-900">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose what Space tells you about, and manage your account.
          </p>
        </motion.div>

        <div className="bento-grid mt-8">
          <BentoCard className="lg:col-span-7">
            <h2 className="font-display text-lg font-bold text-indigo-900">
              Notification preferences
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These control the in-app bell. Turning one off stops new notifications of that type.
            </p>
            <div className="mt-5 space-y-1">
              {isLoading || !prefs ? (
                <p className="text-sm text-muted-foreground">Loading preferences…</p>
              ) : (
                TOGGLES.map((t) => (
                  <div
                    key={t.key}
                    className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.hint}</p>
                    </div>
                    <Switch
                      label={t.label}
                      checked={prefs[t.key]}
                      disabled={prefsMutation.isPending}
                      onChange={(v) => prefsMutation.mutate({ [t.key]: v })}
                    />
                  </div>
                ))
              )}
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-5" delay={0.05}>
            <h2 className="font-display text-lg font-bold text-indigo-900">Weekly email digest</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A Monday recap of your points, problems solved, rank movement and the events coming up.
            </p>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-xl surface-tint px-4 py-3">
              <p className="text-sm font-semibold text-indigo-900">Send me the digest</p>
              <Switch
                label="Weekly email digest"
                checked={prefs?.email_digest ?? true}
                disabled={!prefs || prefsMutation.isPending}
                onChange={(v) => prefsMutation.mutate({ email_digest: v })}
              />
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-6" delay={0.1}>
            <h2 className="font-display text-lg font-bold text-indigo-900">Change password</h2>
            <p className="mt-1 text-sm text-muted-foreground">At least 8 characters.</p>
            <form
              className="mt-5 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (password.length < 8) {
                  toast.error("Password must be at least 8 characters");
                  return;
                }
                passwordMutation.mutate(password);
              }}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={passwordMutation.isPending}
                className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {passwordMutation.isPending ? "Saving…" : "Update"}
              </motion.button>
            </form>
          </BentoCard>

          <BentoCard className="lg:col-span-6" delay={0.15}>
            <h2 className="font-display text-lg font-bold text-indigo-900">Delete account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This permanently removes your profile, submissions, points and badges. Type{" "}
              <span className="font-semibold text-indigo-700">DELETE</span> to confirm.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={confirmText !== "DELETE" || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="shrink-0 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete account"}
              </motion.button>
            </div>
          </BentoCard>
        </div>
      </main>
    </div>
  );
}
