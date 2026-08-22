import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Library,
  Code2,
  Trophy,
  Medal,
  Rocket,
  PlayCircle,
  MessagesSquare,
  Users,
  ChevronDown,
  Menu,
  X,
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
  BarChart3,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";

type SubTab = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };
type Tab = { label: string; icon: React.ComponentType<{ className?: string }>; items: SubTab[] };

const baseTabs: Tab[] = [
  {
    label: "Train",
    icon: Code2,
    items: [
      { label: "Practice", to: "/practice", icon: Code2 },
      { label: "CP Zone", to: "/cp-zone", icon: Trophy },
      { label: "Learn", to: "/learn", icon: PlayCircle },
      { label: "Paths", to: "/paths", icon: Layers },
    ],
  },
  {
    label: "Compete",
    icon: Medal,
    items: [
      { label: "Events", to: "/events", icon: Rocket },
      { label: "Leaderboard", to: "/leaderboard", icon: Medal },
    ],
  },
  {
    label: "Knowledge",
    icon: BookOpen,
    items: [
      { label: "Dictionary", to: "/dictionary", icon: BookOpen },
      { label: "Reference", to: "/reference", icon: Library },
    ],
  },
  {
    label: "Community",
    icon: MessagesSquare,
    items: [
      { label: "Forum", to: "/forum", icon: MessagesSquare },
      { label: "Groups", to: "/groups", icon: Users },
    ],
  },
];

const staffTab: Tab = {
  label: "Staff",
  icon: ShieldCheck,
  items: [
    { label: "Mentees", to: "/mentees", icon: UserCog },
    { label: "Reporting", to: "/reporting", icon: BarChart3 },
    { label: "Admin", to: "/admin", icon: ShieldCheck },
  ],
};

const adminItem: SubTab = { label: "Analytics", to: "/admin/analytics", icon: BarChart3 };

export function AppSidebar() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const isStaff = role === "admin" || role === "manager";
  const tabs: Tab[] = isStaff
    ? [
        ...baseTabs,
        {
          ...staffTab,
          items: role === "admin" ? [...staffTab.items, adminItem] : staffTab.items,
        },
      ]
    : baseTabs;

  const activeTab = tabs.find((t) => t.items.some((i) => pathname.startsWith(i.to)))?.label;
  const [open, setOpen] = useState<string[]>(activeTab ? [activeTab] : ["Train"]);

  useEffect(() => {
    if (activeTab) setOpen((prev) => (prev.includes(activeTab) ? prev : [...prev, activeTab]));
  }, [activeTab]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.add("app-shell-sidebar");
    return () => document.body.classList.remove("app-shell-sidebar");
  }, []);

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

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {tabs.map((tab) => {
        const isOpen = open.includes(tab.label);
        return (
          <div key={tab.label}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                setOpen((prev) =>
                  prev.includes(tab.label)
                    ? prev.filter((l) => l !== tab.label)
                    : [...prev, tab.label],
                )
              }
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.label
                  ? "text-indigo-700 surface-tint"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <tab.icon className="size-4" />
              <span className="flex-1 text-left">{tab.label}</span>
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="size-4" />
              </motion.span>
            </motion.button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  {tab.items.map((item) => (
                    <li key={item.to} className="ml-4 border-l border-indigo-100 pl-2">
                      <motion.div whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}>
                        <Link
                          to={item.to}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-indigo-700"
                          activeProps={{ className: "bg-indigo-50 text-indigo-700 font-semibold" }}
                        >
                          <item.icon className="size-3.5" />
                          {item.label}
                        </Link>
                      </motion.div>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border/70 px-4">
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
      </div>

      {nav}

      <div className="space-y-1 border-t border-border/70 p-3">
        <Link
          to="/profile/$userId"
          params={{ userId: "me" }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          <span className="grid size-6 place-items-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground">
            {initials || "SP"}
          </span>
          Profile
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <SettingsIcon className="size-4" /> Settings
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/70 bg-background/95 backdrop-blur-md lg:flex lg:flex-col"
      >
        {sidebarBody}
      </motion.aside>

      {/* Top bar (search + notifications, and mobile menu trigger) */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-xl border border-input p-2 text-muted-foreground transition-colors hover:bg-accent lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <Link to="/" className="font-display text-lg font-bold text-indigo-900 lg:hidden">
            Space
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <GlobalSearch />
            </div>
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-indigo-950/30 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-background lg:hidden"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-4 rounded-lg p-2 text-muted-foreground hover:bg-accent"
              >
                <X className="size-4" />
              </button>
              {sidebarBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
