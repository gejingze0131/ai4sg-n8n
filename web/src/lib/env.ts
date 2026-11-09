// All settings in one place, read when first used so that `next build` needs none of them.
const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
};
const opt = (name: string) => process.env[name]?.trim() || "";

export const env = {
  get databaseUrlRo() { return need("DATABASE_URL_RO"); },
  get databaseUrlRw() { return need("DATABASE_URL_RW"); },
  get authSecret() { return need("BETTER_AUTH_SECRET"); },
  get publicUrl() { return opt("PUBLIC_URL").replace(/\/$/, ""); },
  get authUrl() { return (opt("BETTER_AUTH_URL") || "http://localhost:3001").replace(/\/$/, ""); },
  get adminEmail() { return opt("ADMIN_EMAIL").toLowerCase(); },
  get adminInitialPassword() { return opt("ADMIN_INITIAL_PASSWORD"); },
  get expertSignup(): "open" | "approval" { return opt("EXPERT_SIGNUP") === "approval" ? "approval" : "open"; },
  get requireEmailVerification() { return opt("AUTH_REQUIRE_EMAIL_VERIFICATION") === "true"; },
  get smtp() {
    return { host: opt("SMTP_HOST"), port: Number(opt("SMTP_PORT")) || 587, user: opt("SMTP_USER"), password: opt("SMTP_PASSWORD"), from: opt("SMTP_FROM") };
  },
  get mailEnabled() { return Boolean(opt("SMTP_HOST") && opt("SMTP_FROM")); },
  get n8nUrl() { return (opt("N8N_URL") || "http://localhost:5678").replace(/\/$/, ""); },
  get n8nSecret() { return need("N8N_WEBHOOK_SECRET"); },
  get codexRunnerUrl() { return (opt("CODEX_RUNNER_URL") || "http://localhost:8787").replace(/\/$/, ""); },
};
