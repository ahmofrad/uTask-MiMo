import nodemailer from "nodemailer";
import { logger } from "@/lib/logging";

let transporter: nodemailer.Transporter | null = null;
let smtpConfig: { host: string; port: number; user?: string | undefined; pass?: string | undefined; from?: string | undefined } | null = null;

async function loadSmtpFromDB(): Promise<typeof smtpConfig> {
  try {
    const { getSettings } = await import("@/lib/settings");
    const allSettings = await getSettings("install", null);
    const smtp = (allSettings.smtp ?? {}) as Record<string, unknown>;
    if (smtp.host && typeof smtp.host === "string") {
      return {
        host: smtp.host as string,
        port: Number(smtp.port) || 587,
        user: (smtp.user as string) || undefined,
        pass: (smtp.pass as string) || undefined,
        from: (smtp.from as string) || undefined,
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
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || undefined,
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

/** Whether an SMTP transport is available (DB settings or env vars). */
export async function isMailConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifyAssigned(to: string, taskTitle: string, taskUrl: string) {
  const { enqueueEmail } = await import("@/lib/queue");
  const safeTitle = escapeHtml(taskTitle);
  await enqueueEmail({
    to,
    subject: `You were assigned: ${taskTitle}`,
    text: `You have been assigned to "${taskTitle}".\n\nView it: ${taskUrl}`,
    html: `<p>You have been assigned to <strong>${safeTitle}</strong>.</p><p><a href="${taskUrl}">View task</a></p>`,
  });
}

export async function notifyMentioned(to: string, byName: string, taskTitle: string, taskUrl: string) {
  const { enqueueEmail } = await import("@/lib/queue");
  const safeName = escapeHtml(byName);
  const safeTitle = escapeHtml(taskTitle);
  await enqueueEmail({
    to,
    subject: `${byName} mentioned you in "${taskTitle}"`,
    text: `${byName} mentioned you in "${taskTitle}".\n\nView it: ${taskUrl}`,
    html: `<p>${safeName} mentioned you in <strong>${safeTitle}</strong>.</p><p><a href="${taskUrl}">View task</a></p>`,
  });
}

/**
 * Alert every global admin/owner that a webhook delivery exhausted all its
 * retries (dead-lettered). Enqueued as a normal email job, so it inherits the
 * SMTP/no-SMTP handling and retry behaviour of the email queue.
 */
export async function notifyWebhookDeadLetter(params: {
  webhookId: string;
  eventType: string;
  eventId: string;
  error?: string;
}): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const { enqueueEmail } = await import("@/lib/queue");

  const webhook = await prisma.webhook.findUnique({
    where: { id: params.webhookId },
    select: { name: true, url: true },
  });
  const admins = await prisma.user.findMany({
    where: { roles: { some: { type: { in: ["owner", "admin"] }, scopeType: "global" } } },
    select: { email: true },
  });

  if (admins.length === 0) {
    logger.debug({ webhookId: params.webhookId }, "Webhook dead-letter alert skipped (no global admins)");
    return;
  }

  const name = webhook?.name ?? params.webhookId;
  const url = webhook?.url ?? "";
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const subject = `Webhook delivery permanently failed: ${name}`;
  const text = [
    `A webhook delivery exhausted all retry attempts and was not delivered.`,
    ``,
    `Webhook: ${name}`,
    `URL: ${url}`,
    `Event: ${params.eventType}`,
    `Event ID: ${params.eventId}`,
    params.error ? `Last error: ${params.error}` : null,
    ``,
    `Review the webhook under Admin → Webhooks and check the delivery log.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  const html = [
    `<p>A webhook delivery exhausted all retry attempts and was not delivered.</p>`,
    `<p>Webhook: <strong>${safeName}</strong><br>URL: ${safeUrl}<br>`,
    `Event: ${escapeHtml(params.eventType)}<br>Event ID: ${escapeHtml(params.eventId)}</p>`,
    params.error ? `<p>Last error: ${escapeHtml(params.error)}</p>` : null,
    `<p>Review the webhook under Admin → Webhooks and check the delivery log.</p>`,
  ]
    .filter((line) => line !== null)
    .join("");

  for (const admin of admins) {
    await enqueueEmail({ to: admin.email, subject, text, html });
  }
}
