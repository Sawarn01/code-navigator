import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { QuestionBuilderPanel } from "@/components/admin/QuestionBuilderPanel";

export const Route = createFileRoute("/_authenticated/admin_/questions")({
  head: () => ({
    meta: [
      { title: "Question management — Space" },
      {
        name: "description",
        content:
          "Staff tools for creating, editing, archiving and deleting practice and competitive programming questions on Space.",
      },
      { property: "og:title", content: "Question management — Space" },
      {
        property: "og:description",
        content: "Full CRUD for practice and CP questions, test cases and topic tags.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load question management.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: AdminQuestionsPage,
});

function AdminQuestionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Question management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, archive and delete practice and CP questions — with inline test cases and
            a sample-case run preview.
          </p>
        </motion.div>
        <div className="mt-6">
          <QuestionBuilderPanel />
        </div>
      </main>
    </div>
  );
}
