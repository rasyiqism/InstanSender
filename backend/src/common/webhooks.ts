import crypto from 'node:crypto';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';

export async function dispatchWebhook(
  userId: string,
  eventType: 'message.status' | 'device.status' | 'message.incoming' | 'group.members',
  payload: Record<string, unknown>,
) {
  try {
    const hooks = await db
      .select()
      .from(schema.webhooks)
      .where(
        and(
          eq(schema.webhooks.userId, userId),
          eq(schema.webhooks.active, true),
          eq(schema.webhooks.eventType, eventType),
        ),
      );

    if (hooks.length === 0) return;

    await Promise.allSettled(
      hooks.map(async (hook) => {
        const start = Date.now();
        const requestPayload = {
          event: hook.eventType,
          data: payload,
          timestamp: new Date().toISOString(),
        };
        const body = JSON.stringify(requestPayload);
        const signature = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');

        let success = false;
        let responseStatus: number | null = null;
        let errorMessage: string | null = null;

        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Signature': signature,
            },
            body,
            signal: AbortSignal.timeout(10000),
          });
          responseStatus = res.status;
          success = res.ok;
          if (!res.ok) {
            errorMessage = `HTTP error: ${res.status}`;
          }
        } catch (err: any) {
          errorMessage = err.message || 'Fetch failed';
        }

        const durationMs = Date.now() - start;

        await db.insert(schema.webhookLogs).values({
          userId,
          webhookId: hook.id,
          url: hook.url,
          eventType: hook.eventType,
          payload: requestPayload,
          success,
          responseStatus,
          errorMessage,
          durationMs,
        });
      }),
    );
  } catch (err: any) {
    console.error(`[Webhook] Dispatch error:`, err.message);
  }
}
