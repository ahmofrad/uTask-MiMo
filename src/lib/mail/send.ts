import nodemailer from "nodemailer";
import { logger } from "@/lib/logging";

let transporter: nodemailer.Transporter | null = null;

function getTransport() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    logger.warn("SMTP not configured — mail sending disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return transporter;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const transport = getTransport();
  if (!transport) {
    logger.debug({ to: params.to, subject: params.subject }, "Mail skipped (no SMTP)");
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || "noreply@utask.local",
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

export async function notifyAssigned(to: string, taskTitle: string, taskUrl: string) {
  await sendMail({
    to,
    subject: `You were assigned: ${taskTitle}`,
    text: `You have been assigned to "${taskTitle}".\n\nView it: ${taskUrl}`,
    html: `<p>You have been assigned to <strong>${taskTitle}</strong>.</p><p><a href="${taskUrl}">View task</a></p>`,
  });
}

export async function notifyMentioned(to: string, byName: string, taskTitle: string, taskUrl: string) {
  await sendMail({
    to,
    subject: `${byName} mentioned you in "${taskTitle}"`,
    text: `${byName} mentioned you in "${taskTitle}".\n\nView it: ${taskUrl}`,
    html: `<p>${byName} mentioned you in <strong>${taskTitle}</strong>.</p><p><a href="${taskUrl}">View task</a></p>`,
  });
}
