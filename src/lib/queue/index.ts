import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logging";
import crypto from "node:crypto";
import { waitForRedisReady, type RedisReadyClient } from "./connection";
import { getRedisConnectionOptions } from "@/lib/redis/config";
import type { RedisOptions } from "ioredis";

let sharedConnection: unknown;
let connectionPromise: Promise<unknown> | null = null;

async function ensureConnection(): Promise<unknown> {
  if (sharedConnection) return sharedConnection;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const IORedis = await import(/* webpackIgnore: true */ "ioredis");
      const options: RedisOptions = {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      };
      const connection = getRedisConnectionOptions();
      const client =
        typeof connection === "string"
          ? new IORedis.default(connection, options)
          : new IORedis.default({ ...connection, ...options });
      try {
        await waitForRedisReady(client as RedisReadyClient);
        sharedConnection = client;
        return client;
      } catch (err) {
        client.disconnect();
        throw err;
      }
    })();
  }
  try {
    return await connectionPromise;
  } catch (err) {
    connectionPromise = null;
    sharedConnection = undefined;
    throw err;
  }
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
  deliveryId?: string;
};

export type EmailJobData = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function webhookJobId(webhookId: string, eventId: string): string {
  return `webhook-${crypto.createHash("sha256").update(`${webhookId}\u0000${eventId}`).digest("hex")}`;
}

export async function enqueueWebhook(data: WebhookJobData): Promise<void> {
  const q = await getWebhookQueue();
  await q.add(data.eventId, data, { jobId: webhookJobId(data.webhookId, data.eventId) });
}

function emailJobId(to: string, subject: string, text: string): string {
  const hash = crypto.createHash("sha256").update(`${to}\u0000${subject}\u0000${text}`).digest("hex");
  return `email-${hash}`;
}

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  const q = await getEmailQueue();
  await q.add(data.subject, data, { jobId: emailJobId(data.to, data.subject, data.text) });
}

let workersStarted = false;
const _workers: Worker[] = [];

export function getWorkers() {
  return { workers: _workers, queues: [_webhookQueue, _emailQueue].filter(Boolean) as Queue[] };
}

export async function startWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;

  try {
    const conn = await ensureConnection() as { ping?: () => Promise<unknown> };
    if (typeof conn.ping !== "function") throw new Error("Redis connection does not support ping");
    await conn.ping();

    const webhookWorker = new Worker<WebhookJobData>(
      "webhook-delivery",
      async (job) => {
        const { dispatchWebhook } = await import("@/lib/webhook");
        await dispatchWebhook(
          job.data.webhookId,
          job.data.eventType,
          job.data.eventId,
          job.data.payload,
          job.data.deliveryId,
          job.attemptsMade + 1,
        );
      },
      { connection: conn as never },
    );
    webhookWorker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, err }, "Webhook job failed");
      if (!job) return;
      // BullMQ emits `failed` on every attempt. Only alert once the job has
      // exhausted its retries (dead-lettered), when attemptsMade === attempts.
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade < attempts) return;
      const data = job.data as WebhookJobData;
      void import("@/lib/mail/send")
        .then(({ notifyWebhookDeadLetter }) =>
          notifyWebhookDeadLetter({
            webhookId: data.webhookId,
            eventType: data.eventType,
            eventId: data.eventId,
            error: err?.message,
          }),
        )
        .catch((mailErr) => logger.error({ mailErr }, "Failed to send webhook dead-letter alert"));
    });
    _workers.push(webhookWorker);

    const emailWorker = new Worker<EmailJobData>(
      "email",
      async (job) => {
        const { sendMail } = await import("@/lib/mail/send");
        await sendMail(job.data);
      },
      { connection: conn as never },
    );
    emailWorker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, err }, "Email job failed");
    });
    _workers.push(emailWorker);

    logger.info("BullMQ workers started");
  } catch (err) {
    workersStarted = false;
    logger.error({ err }, "Failed to start BullMQ workers");
    throw err;
  }
}
