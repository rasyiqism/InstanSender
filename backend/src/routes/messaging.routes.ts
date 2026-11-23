import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { messageQueue } from '../common/queue';
import { checkRateLimit } from '../common/rate-limit';

export const messagingRoutes = new Elysia({ prefix: '/v1/messages' })
  .use(authContext)
  // 1. Send text message
  .post(
    '/send',
    async ({ body, validateApiKeyAuth, set }) => {
      const { keyRecord, user } = await validateApiKeyAuth();
      const { to, message, deviceId } = body;

      // Validate device scope if API Key is restricted
      if (keyRecord.deviceId && deviceId && keyRecord.deviceId !== deviceId) {
        set.status = 403;
        return { error: `API Key ini terikat pada device ID ${keyRecord.deviceId}, tidak diizinkan mengirim melalui device ID ${deviceId}` };
      }

      // Determine target device
      let activeDeviceId = keyRecord.deviceId || deviceId;
      if (!activeDeviceId) {
        // Fallback: pick user's first connected device
        const [firstDevice] = await db
          .select()
          .from(schema.devices)
          .where(and(eq(schema.devices.userId, user.id), eq(schema.devices.status, 'connected')))
          .limit(1);

        if (!firstDevice) {
          set.status = 400;
          return { error: 'Tidak ada device WhatsApp yang terhubung untuk mengirim pesan' };
        }
        activeDeviceId = firstDevice.id;
      }

      // Verify device belongs to user
      const [device] = await db
        .select()
        .from(schema.devices)
        .where(and(eq(schema.devices.id, activeDeviceId!), eq(schema.devices.userId, user.id)))
        .limit(1);

      if (!device) {
        set.status = 404;
        return { error: 'Device tidak ditemukan atau tidak valid' };
      }

      // Check subscription quota & rate limit
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.status, 'active')))
        .limit(1);

      let limitPerSec = 5;
      if (sub) {
        const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, sub.packageId)).limit(1);
        if (pkg?.rateLimitPerSecond) {
          limitPerSec = pkg.rateLimitPerSecond;
        }

        if (pkg?.messageQuota !== null && pkg?.messageQuota !== undefined) {
          if (sub.messagesUsed >= pkg.messageQuota) {
            set.status = 403;
            return { error: 'Kuota pesan bulanan Anda telah habis' };
          }
        }
      }

      // Check per-device rate limit BEFORE deducting quota
      const rateCheck = await checkRateLimit(`device:${device.id}`, limitPerSec);
      if (!rateCheck.allowed) {
        set.status = 429;
        set.headers['Retry-After'] = String(rateCheck.retryAfterSec);
        return {
          error: `Batas pengiriman pesan (${limitPerSec} req/detik) terlampaui. Silakan tunggu sesaat.`,
          retryAfter: rateCheck.retryAfterSec,
        };
      }

      // Increment messages used after rate limit passes
      if (sub) {
        await db
          .update(schema.subscriptions)
          .set({ messagesUsed: sql`${schema.subscriptions.messagesUsed} + 1` })
          .where(eq(schema.subscriptions.id, sub.id));
      }

      // Clean recipient phone
      const cleanTo = to.replace(/[^\d]/g, '');

      // Create log
      const [log] = await db
        .insert(schema.messageLogs)
        .values({
          deviceId: device.id,
          apiKeyId: keyRecord.id,
          recipient: cleanTo,
          messageType: 'text',
          status: 'queued',
        })
        .returning();

      // Enqueue job
      await messageQueue.add('send-message', {
        logId: log.id,
        deviceId: device.id,
        userId: user.id,
        to: cleanTo,
        type: 'text',
        message,
      });

      return {
        status: 'queued',
        logId: log.id,
        to: cleanTo,
        type: 'text',
      };
    },
    {
      body: t.Object({
        to: t.String({ minLength: 5 }),
        message: t.String({ minLength: 1 }),
        type: t.Optional(t.Literal('text')),
        deviceId: t.Optional(t.String()),
      }),
    },
  )
  // 2. Send media message
  .post(
    '/send-media',
    async ({ body, validateApiKeyAuth, set }) => {
      const { keyRecord, user } = await validateApiKeyAuth();
      const { to, type, mediaUrl, caption, deviceId } = body;

      // Validate device scope if API Key is restricted
      if (keyRecord.deviceId && deviceId && keyRecord.deviceId !== deviceId) {
        set.status = 403;
        return { error: `API Key ini terikat pada device ID ${keyRecord.deviceId}, tidak diizinkan mengirim melalui device ID ${deviceId}` };
      }

      let targetDeviceId = keyRecord.deviceId || deviceId;
      if (!targetDeviceId) {
        const [firstDevice] = await db
          .select()
          .from(schema.devices)
          .where(and(eq(schema.devices.userId, user.id), eq(schema.devices.status, 'connected')))
          .limit(1);

        if (!firstDevice) {
          set.status = 400;
          return { error: 'Tidak ada device WhatsApp yang terhubung untuk mengirim media' };
        }
        targetDeviceId = firstDevice.id;
      }

      const [device] = await db
        .select()
        .from(schema.devices)
        .where(and(eq(schema.devices.id, targetDeviceId), eq(schema.devices.userId, user.id)))
        .limit(1);

      if (!device) {
        set.status = 404;
        return { error: 'Device tidak ditemukan' };
      }

      // Check subscription quota & rate limit
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.status, 'active')))
        .limit(1);

      let limitPerSec = 5;
      if (sub) {
        const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, sub.packageId)).limit(1);
        if (pkg?.rateLimitPerSecond) {
          limitPerSec = pkg.rateLimitPerSecond;
        }

        if (pkg?.messageQuota !== null && pkg?.messageQuota !== undefined) {
          if (sub.messagesUsed >= pkg.messageQuota) {
            set.status = 403;
            return { error: 'Kuota pesan bulanan Anda telah habis' };
          }
        }
      }

      // Check per-device rate limit BEFORE deducting quota
      const rateCheck = await checkRateLimit(`device:${device.id}`, limitPerSec);
      if (!rateCheck.allowed) {
        set.status = 429;
        set.headers['Retry-After'] = String(rateCheck.retryAfterSec);
        return {
          error: `Batas pengiriman pesan (${limitPerSec} req/detik) terlampaui. Silakan tunggu sesaat.`,
          retryAfter: rateCheck.retryAfterSec,
        };
      }

      // Increment messages used after rate limit passes
      if (sub) {
        await db
          .update(schema.subscriptions)
          .set({ messagesUsed: sql`${schema.subscriptions.messagesUsed} + 1` })
          .where(eq(schema.subscriptions.id, sub.id));
      }

      const cleanTo = to.replace(/[^\d]/g, '');
      const [log] = await db
        .insert(schema.messageLogs)
        .values({
          deviceId: device.id,
          apiKeyId: keyRecord.id,
          recipient: cleanTo,
          messageType: type as any,
          status: 'queued',
        })
        .returning();

      await messageQueue.add('send-message', {
        logId: log.id,
        deviceId: device.id,
        userId: user.id,
        to: cleanTo,
        type: type as any,
        mediaUrl,
        caption: caption || null,
      });

      return {
        status: 'queued',
        logId: log.id,
        to: cleanTo,
        type,
      };
    },
    {
      body: t.Object({
        to: t.String({ minLength: 5 }),
        type: t.Union([t.Literal('image'), t.Literal('document')]),
        mediaUrl: t.String({ format: 'uri' }),
        caption: t.Optional(t.String()),
        deviceId: t.Optional(t.String()),
      }),
    },
  );
