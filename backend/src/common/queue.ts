import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { waClient } from './wa-client';
import { dispatchWebhook } from './webhooks';

export interface SendMessageJobData {
  logId: string;
  deviceId: string;
  userId: string;
  to: string;
  type: 'text' | 'image' | 'document';
  message?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  broadcastId?: string | null;
}

export const redisConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  console.warn(`[Redis] Connection warning:`, err.message);
});

export const messageQueue = new Queue<SendMessageJobData>('send-message-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function processSendMessageJob(data: SendMessageJobData) {
  const { logId, deviceId, userId, to, type, message, mediaUrl, caption, broadcastId } = data;

  // Check if broadcast is cancelled or paused
  if (broadcastId) {
    const [b] = await db
      .select({ status: schema.broadcasts.status })
      .from(schema.broadcasts)
      .where(eq(schema.broadcasts.id, broadcastId))
      .limit(1);

    if (b && (b.status === 'cancelled' || b.status === 'paused')) {
      await db
        .update(schema.messageLogs)
        .set({ status: 'failed', errorMessage: `Broadcast is ${b.status}` })
        .where(eq(schema.messageLogs.id, logId));
      return;
    }

    if (b && b.status === 'pending') {
      await db
        .update(schema.broadcasts)
        .set({ status: 'running', startedAt: new Date() })
        .where(and(eq(schema.broadcasts.id, broadcastId), eq(schema.broadcasts.status, 'pending')));
    }
  }

  try {
    await waClient.sendMessage({
      deviceId,
      to,
      type,
      message,
      mediaUrl,
      caption,
    });

    await db
      .update(schema.messageLogs)
      .set({
        status: 'sent',
        sentAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.messageLogs.id, logId));

    await dispatchWebhook(userId, 'message.status', {
      messageId: logId,
      status: 'sent',
      to,
    });

    if (broadcastId) {
      await updateBroadcastProgress(broadcastId, 'sent');
    }
  } catch (err: any) {
    const errorMsg = err.message || 'Send message failed';
    console.error(`[Queue] Failed to send message logId=${logId}:`, errorMsg);

    await db
      .update(schema.messageLogs)
      .set({
        status: 'failed',
        errorMessage: errorMsg,
      })
      .where(eq(schema.messageLogs.id, logId));

    await dispatchWebhook(userId, 'message.status', {
      messageId: logId,
      status: 'failed',
      to,
      error: errorMsg,
    });

    if (broadcastId) {
      await updateBroadcastProgress(broadcastId, 'failed');
    }

    throw err;
  }
}

async function updateBroadcastProgress(broadcastId: string, outcome: 'sent' | 'failed') {
  const field = outcome === 'sent' ? schema.broadcasts.sentCount : schema.broadcasts.failedCount;

  await db
    .update(schema.broadcasts)
    .set({
      [outcome === 'sent' ? 'sentCount' : 'failedCount']: sql`${field} + 1`,
    })
    .where(eq(schema.broadcasts.id, broadcastId));

  const [b] = await db
    .select()
    .from(schema.broadcasts)
    .where(eq(schema.broadcasts.id, broadcastId))
    .limit(1);

  if (b && b.status === 'running' && b.sentCount + b.failedCount >= b.totalRecipients) {
    await db
      .update(schema.broadcasts)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(schema.broadcasts.id, broadcastId));
  }
}

export const messageWorker = new Worker<SendMessageJobData>(
  'send-message-queue',
  async (job: Job<SendMessageJobData>) => {
    await processSendMessageJob(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
);

messageWorker.on('failed', (job, err) => {
  console.warn(`[QueueWorker] Job ${job?.id} failed:`, err.message);
});
