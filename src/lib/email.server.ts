/** Shared Resend sender — used by the weekly digest and event reminders. */
export function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const from = process.env["DIGEST_FROM_EMAIL"] ?? "Space <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}: ${await res.text()}`);
}
