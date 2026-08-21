import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

const navItems = [
  { label: "Practice", to: "/" },
  { label: "Contests", to: "/" },
  { label: "Courses", to: "/" },
  { label: "Forum", to: "/" },
];

export function SiteHeader() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
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
          {navItems.map((item) => (
            <motion.div key={item.label} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          type="button"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-indigo-700"
        >
          Sign in
        </motion.button>
      </div>
    </motion.header>
  );
}
