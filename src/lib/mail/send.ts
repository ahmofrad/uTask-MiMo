import nodemailer from "nodemailer";
import { logger } from "@/lib/logging";

let transporter: nodemailer.Transporter | null = null;
let smtpConfig: { host: string; port: number; user?: string | undefined; pass?: string | undefined; from?: string | undefined } | null = null;

async function loadSmtpFromDB(): Promise<typeof smtpConfig> {
  try {
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings("install", "smtp");
    if (settings.host && typeof settings.host === "string") {
      return {
        host: settings.host as string,
        port: Number(settings.port) || 587,
        user: (settings.user as string) || undefined,
        pass: (settings.pass as string) || undefined,
        from: (settings.from as string) || undefined,
      };
    }
  } catch {
    // Settings table may not exist yet
  }
  return null;
}

async function getSmtpConfig() {
  if (smtpConfig !== null) return smtpConfig;

  // Try DB first
  smtpConfig = await loadSmtpFromDB();
  if (smtpConfig) return smtpConfig;

  // Fall back to env vars
  const host = process.env.SMTP_HOST;
  if (host) {
    smtpConfig = {
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      from: process.env.SMTP_FROM || undefined,
    };
    return smtpConfig;
  }

  return null;
}

function resetCache() {
  transporter = null;
  smtpConfig = null;
}

export { resetCache };

async function getTransport() {
  if (transporter) return transporter;

  const config = await getSmtpConfig();
  if (!config) {
    logger.warn("SMTP not configured — mail sending disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });

  return transporter;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const transport = await getTransport();
  if (!transport) {
    logger.debug({ to: params.to, subject: params.subject }, "Mail skipped (no SMTP)");
    return;
  }

  const config = await getSmtpConfig();
  await transport.sendMail({
    from: config?.from || "noreply@utask.local",
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

export async function notifyAssigned(to: string, taskTitle: string, taskUrl: string) {
  const { enqueueEmail } = await import("@/lib/queue");
  await enqueueEmail({
    to,
    subject: `You were assigned: ${taskTitle}`,
    text: `You have been assigned to "${taskTitle}".\n\nView it: ${taskUrl}`,
    html: `<p>You have been assigned to <strong>${taskTitle}</strong>.</p><p><a href="${taskUrl}">View task</a></p>`,
  });
}

export async function notifyMentioned(to: string, byName: string, taskTitle: string, taskUrl: string) {
  const { enqueueEmail } = await import("@/lib/queue");
  await enqueueEmail({
    to,
    subject: `${byName} mentioned you in "${taskTitle}"`,
    text: `${byName} mentioned you in "${taskTitle}".\n\nView it: ${taskUrl}`,
    html: `<p>${byName} mentioned you in <strong>${taskTitle}</strong>.</p><p><a href="${taskUrl}">View task</a></p>`,
  });
}
