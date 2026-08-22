import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Award, Download, ShieldCheck } from "lucide-react";
import { getCertificate } from "@/lib/lms.functions";

const certQuery = (code: string) =>
  queryOptions({
    queryKey: ["certificate", code],
    queryFn: () => getCertificate({ data: { code } }),
  });

export const Route = createFileRoute("/certificate/$certificateCode")({
  loader: async ({ context, params }) => {
    const cert = await context.queryClient.ensureQueryData(certQuery(params.certificateCode));
    if (!cert) throw notFound();
    return { name: cert.full_name ?? "A Space learner", course: cert.course_title };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Certificate — Space" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} — ${loaderData.course} certificate | Space`;
    const description = `Verified course completion certificate for ${loaderData.course}, issued by Space.`;
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load this certificate. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      No certificate matches this verification code.
    </div>
  ),
  component: CertificatePage,
});

function CertificatePage() {
  const { certificateCode } = Route.useParams();
  const { data: cert } = useSuspenseQuery(certQuery(certificateCode));
  if (!cert) return null;

  const issued = new Date(cert.issued_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/" className="text-xs font-semibold text-indigo-700 hover:underline">
            ← Space
          </Link>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
          >
            <Download className="size-4" /> Download PDF
          </motion.button>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-6 overflow-hidden rounded-[28px] border-2 border-indigo-200 bg-card p-8 shadow-[var(--shadow-soft)] sm:p-14"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Award className="size-7 text-indigo-600" />
              <span className="font-display text-xl font-bold text-indigo-900">Space</span>
            </div>
            <span className="rounded-full surface-tint px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
              Certificate of completion
            </span>
          </div>

          <p className="mt-12 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            This certifies that
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-indigo-900 sm:text-5xl">
            {cert.full_name ?? "A Space learner"}
          </h1>
          <p className="mt-6 text-sm text-muted-foreground">
            has successfully completed every lesson and assessment in
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-indigo-700 sm:text-3xl">
            {cert.course_title}
          </h2>
          {cert.course_description && (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{cert.course_description}</p>
          )}

          <div className="mt-14 grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Issued on</p>
              <p className="mt-1 text-sm font-semibold text-indigo-900">{issued}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Verification code
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-indigo-900">
                <ShieldCheck className="size-4 text-emerald-600" />
                {cert.certificate_code}
              </p>
            </div>
          </div>
        </motion.article>

        <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
          Anyone can verify this certificate by visiting this page.
        </p>
      </main>
    </div>
  );
}
