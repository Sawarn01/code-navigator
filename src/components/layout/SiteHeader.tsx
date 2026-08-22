import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";

const navItems = [
  { label: "Practice", to: "/practice" },
  { label: "CP Zone", to: "/cp-zone" },
  { label: "Learn", to: "/learn" },
  { label: "Events", to: "/events" },
  { label: "Leaderboard", to: "/leaderboard" },
  { label: "Dictionary", to: "/dictionary" },
  { label: "Reference", to: "/reference" },
  { label: "Forum", to: "/forum" },
  { label: "Groups", to: "/groups" },
] as const;

export function SiteHeader() {
  const { isAuthenticated, role, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (user?.user_metadata?.["full_name"] as string | undefined)
    ?.split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <motion.span
            whileHover={{ scale: 1.06, rotate: -3 }}
            whileTap={{ scale: 0.95 }}
            className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            S
          </motion.span>
          <span className="font-display text-lg font-bold tracking-tight text-indigo-900">
            Space
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => (
            <motion.div key={item.label} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                to={item.to}
                className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            </motion.div>
          ))}
          {isAuthenticated && (role === "admin" || role === "manager") && (
            <>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link
                  to="/mentees"
                  className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-accent"
                >
                  Mentees
                </Link>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link
                  to="/reporting"
                  className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-accent"
                >
                  Reporting
                </Link>
              </motion.div>
              {role === "admin" && (
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                  <Link
                    to="/admin/analytics"
                    className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-accent"
                  >
                    Analytics
                  </Link>
                </motion.div>
              )}
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link
                  to="/admin"
                  className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-accent"
                >
                  Admin
                </Link>
              </motion.div>
            </>
          )}
        </nav>

        <div className="hidden flex-1 justify-end md:flex">
          <GlobalSearch />
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                to="/settings"
                className="hidden rounded-xl border border-input px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent sm:block"
              >
                Settings
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                to="/profile/$userId"
                params={{ userId: "me" }}
                className="flex items-center gap-2 rounded-xl surface-tint px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <span className="grid size-6 place-items-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground">
                  {initials || "SP"}
                </span>
                Profile
              </Link>
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-input px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              Sign out
            </motion.button>
          </div>
        ) : (
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              to="/auth"
              className="block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700"
            >
              Sign in
            </Link>
          </motion.div>
        )}
      </div>

      <div className="lg:hidden">
        <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent"
              activeProps={{ className: "bg-indigo-50 text-indigo-700" }}
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Link
              to="/settings"
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground"
            >
              Settings
            </Link>
          )}
          {isAuthenticated && (role === "admin" || role === "manager") && (
            <>
              <Link
                to="/reporting"
                className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-indigo-700"
              >
                Reporting
              </Link>
              <Link
                to="/admin"
                className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-indigo-700"
              >
                Admin
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
