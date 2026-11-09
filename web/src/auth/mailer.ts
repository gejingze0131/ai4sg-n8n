import nodemailer from "nodemailer";
import { env } from "@/lib/env";

// Off until SMTP_* is filled in. The hooks in auth.ts call this; nothing else sends mail.
export async function sendMail(to: string, subject: string, text: string) {
  if (!env.mailEnabled) throw new Error("E-mail is not configured (SMTP_HOST, SMTP_FROM)");
  const s = env.smtp;
  const transport = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, auth: s.user ? { user: s.user, pass: s.password } : undefined });
  await transport.sendMail({ from: s.from, to, subject, text });
}
