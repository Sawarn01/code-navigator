import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_DOMAINS = ["zenithschool.ai"];

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Space — Institutional Access" },
      {
        name: "description",
        content:
          "Sign in or create your Space account with your institutional email to practice problems and join contests.",
      },
      { property: "og:title", content: "Sign in to Space" },
      {
        property: "og:description",
        content: "Institutional sign-in for the Space practice and competition platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function domainOf(email: string) {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const emailDomainInvalid = email.length > 3 && !ALLOWED_DOMAINS.includes(domainOf(email));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (mode !== "signin" && emailDomainInvalid) {
      toast.error("Please use your institutional email (@zenithschool.ai)");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        if (fullName.trim().length < 2) {
          toast.error("Please enter your full name");
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          setNotice("Account created. Check your inbox to confirm your email, then sign in.");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that account exists, a password reset link is on its way.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(
        /institutional|domain/i.test(message)
          ? "Sign-up is restricted to approved institutional emails."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative hidden overflow-hidden surface-tint p-12 lg:flex lg:flex-col lg:justify-between"
      >
        <Link to="/" className="font-display text-lg font-bold text-indigo-900">
          ← Space
        </Link>
        <div>
          <h2 className="text-4xl leading-tight">Train like the contest already started.</h2>
          <p className="mt-4 max-w-sm text-sm text-indigo-700">
            Curated problem sets, ICPC-style contests, video courses and a community of students
            preparing for the same interviews as you.
          </p>
        </div>
        <p className="text-xs text-indigo-700">Institutional access only · @zenithschool.ai</p>
      </motion.aside>

      <main className="flex items-center justify-center px-4 py-16 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="bento-card">
            <div className="mb-6 flex gap-1 rounded-xl bg-muted p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setNotice(null);
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === m
                      ? "bg-card text-indigo-700 shadow-[var(--shadow-soft)]"
                      : "text-muted-foreground hover:text-indigo-700"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <h1 className="text-2xl">
              {mode === "forgot"
                ? "Reset your password"
                : mode === "signup"
                  ? "Join Space"
                  : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "We'll email you a secure reset link."
                : "Use your institutional email to continue."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <AnimatePresence initial={false}>
                {mode === "signup" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="text-sm font-medium text-indigo-900" htmlFor="fullName">
                      Full name
                    </label>
                    <input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={100}
                      required
                      className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                      placeholder="Ada Lovelace"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="text-sm font-medium text-indigo-900" htmlFor="email">
                  Institutional email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  required
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                  placeholder="you@zenithschool.ai"
                />
                {emailDomainInvalid && mode !== "signin" && (
                  <p className="mt-1.5 text-xs font-medium text-destructive">
                    Please use your institutional email (@zenithschool.ai)
                  </p>
                )}
              </div>

              {mode !== "forgot" && (
                <div>
                  <label className="text-sm font-medium text-indigo-900" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {notice && (
                <div className="rounded-xl surface-tint px-3.5 py-3 text-sm text-indigo-700">
                  {notice}
                </div>
              )}

              <motion.button
                whileHover={{ scale: busy ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={busy}
                type="submit"
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              </motion.button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "forgot" ? (
                <button
                  type="button"
                  className="font-medium text-indigo-700 hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Back to sign in
                </button>
              ) : (
                <button
                  type="button"
                  className="font-medium text-indigo-700 hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  Forgot your password?
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            New accounts always start with the student role. Manager and admin access is granted by
            an administrator.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
