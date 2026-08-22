import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/layout/AppSidebar";

const marketingLinks = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Hackathons", href: "/#hackathons" },
  { label: "Stories", href: "/#stories" },
  { label: "FAQ", href: "/#faq" },
] as const;

export function SiteHeader() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <AppSidebar />;

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

        <nav className="hidden items-center gap-1 md:flex">
          {marketingLinks.map((item) => (
            <motion.a
              key={item.label}
              href={item.href}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-indigo-700"
            >
              {item.label}
            </motion.a>
          ))}
        </nav>

        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          <Link
            to="/auth"
            className="block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700"
          >
            Sign in
          </Link>
        </motion.div>
      </div>

      <div className="md:hidden">
        <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {marketingLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </motion.header>
  );
}
