import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logging";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let sharedConnection: unknown;
let connInitialized = false;

async function ensureConnection() {
  if (connInitialized) return sharedConnection;
  const IORedis = await import("ioredis");
  sharedConnection = new IORedis.default(redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
  connInitialized = true;
  return sharedConnection;
}

let _webhookQueue: Queue | null = null;
let _emailQueue: Queue | null = null;

async function getWebhookQueue(): Promise<Queue> {
  if (_webhookQueue) return _webhookQueue;
  const conn = await ensureConnection();
  _webhookQueue = new Queue("webhook-delivery", {
    connection: conn as never,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
  return _webhookQueue;
}

async function getEmailQueue(): Promise<Queue> {
  if (_emailQueue) return _emailQueue;
  const conn = await ensureConnection();
  _emailQueue = new Queue("email", {
    connection: conn as never,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
  return _emailQueue;
}

export type WebhookJobData = {
  webhookId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
};

export type EmailJobData = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function enqueueWebhook(data: WebhookJobData): Promise<void> {
  const q = await getWebhookQueue();
  await q.add(data.eventId, data, { jobId: data.eventId });
}

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  const q = await getEmailQueue();
  await q.add(data.subject, data, { jobId: `${data.to}:${Date.now()}` });
}

let workersStarted = false;

export function startWorkers() {
  if (workersStarted) return;
  workersStarted = true;

  ensureConnection()
    .then((conn) => {
      try {
        new Worker<WebhookJobData>(
          "webhook-delivery",
          async (job) => {
            const { dispatchWebhook } = await import("@/lib/webhook");
            await dispatchWebhook(job.data.webhookId, job.data.eventType, job.data.eventId, job.data.payload);
          },
          { connection: conn as never },
        );

        new Worker<EmailJobData>(
          "email",
          async (job) => {
            const { sendMail } = await import("@/lib/mail/send");
            await sendMail(job.data);
          },
          { connection: conn as never },
        );

        logger.info("BullMQ workers started");
      } catch (err) {
        logger.error({ err }, "Failed to start BullMQ workers");
      }
    })
    .catch((err) => {
      logger.warn({ err }, "BullMQ workers not started (Redis unavailable)");
    });
}
