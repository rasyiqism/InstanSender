import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { waClient } from '../common/wa-client';
import { dispatchWebhook } from '../common/webhooks';
import { config } from '../config';
import { personalize } from '../common/template';

/** Extract numeric phone number from WhatsApp JID */
export function stripJid(jid: string): string {
  return (jid || '').split('@')[0].split(':')[0].replace(/[^\d]/g, '');
}

export const deviceRoutes = new Elysia({ prefix: '/devices' })
  .use(authContext)
  // 1. List user devices
  .get('/', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    return db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.userId, user.id))
      .orderBy(schema.devices.createdAt);
  })
  // 2. Create device
  .post(
    '/',
    async ({ body, getAuthUser, set }) => {
      const user = await getAuthUser();

      // Check user package limit
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(
          and(
            eq(schema.subscriptions.userId, user.id),
            eq(schema.subscriptions.status, 'active'),
          ),
        )
        .limit(1);

      let maxAllowed = 1;
      if (sub) {
        const [pkg] = await db
          .select()
          .from(schema.packages)
          .where(eq(schema.packages.id, sub.packageId))
          .limit(1);
        if (pkg) maxAllowed = pkg.maxDevice;
      }

      const existingDevices = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.userId, user.id));

      if (user.role !== 'admin' && existingDevices.length >= maxAllowed) {
        set.status = 400;
        return {
          message: `Batas maksimal device (${maxAllowed}) telah tercapai. Silakan upgrade paket Anda.`,
        };
      }

      const [device] = await db
        .insert(schema.devices)
        .values({
          userId: user.id,
          agencyId: user.agencyId,
          name: body.name,
          status: 'pending_qr',
          autoReplyEnabled: true,
        })
        .returning();

      // Create session on connector
      const { qr } = await waClient.createSession(device.id);

      return {
        ...device,
        device,
        qr,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
    },
  )
  // 3. Get QR
  .get('/:id/qr', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, params.id), eq(schema.devices.userId, user.id)))
      .limit(1);

    if (!device) {
      set.status = 404;
      return { message: 'Device tidak ditemukan' };
    }

    let qrResult = await waClient.getQr(params.id);
    if (!qrResult.qr && qrResult.status === 'disconnected') {
      const session = await waClient.createSession(params.id);
      qrResult = { qr: session.qr, status: 'pending_qr' };
    }

    return qrResult;
  })
  // 4. Get Status
  .get('/:id/status', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, params.id), eq(schema.devices.userId, user.id)))
      .limit(1);

    if (!device) {
      set.status = 404;
      return { message: 'Device tidak ditemukan' };
    }

    const live = await waClient.getStatus(params.id);
    if (live.status && live.status !== device.status) {
      await db
        .update(schema.devices)
        .set({
          status: live.status as any,
          phoneNumber: live.phoneNumber || device.phoneNumber,
          lastSeenAt: live.status === 'connected' ? new Date() : device.lastSeenAt,
        })
        .where(eq(schema.devices.id, params.id));
    }

    return live;
  })
  // 5. Delete device
  .delete('/:id', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, params.id), eq(schema.devices.userId, user.id)))
      .limit(1);

    if (!device) {
      set.status = 404;
      return { message: 'Device tidak ditemukan' };
    }

    await waClient.deleteSession(params.id);
    await db.delete(schema.devices).where(eq(schema.devices.id, params.id));

    return { success: true };
  })
  // 6. Internal callback: Status events from wa-connector
  .post('/internal/events', async ({ headers, body, set }) => {
    const internalToken = headers['x-internal-token'];
    if (!internalToken || internalToken !== config.waConnectorToken) {
      set.status = 401;
      return { error: 'Unauthorized internal token' };
    }

    const { deviceId, status, phoneNumber } = body as {
      deviceId: string;
      status: string;
      phoneNumber?: string;
    };

    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, deviceId))
      .limit(1);

    if (device) {
      await db
        .update(schema.devices)
        .set({
          status: status as any,
          phoneNumber: phoneNumber || device.phoneNumber,
          lastSeenAt: status === 'connected' ? new Date() : device.lastSeenAt,
        })
        .where(eq(schema.devices.id, deviceId));

      await dispatchWebhook(device.userId, 'device.status', {
        deviceId,
        status,
        phoneNumber,
      });
    }

    return { status: 'ok' };
  })
  // 7. Internal callback: Incoming message
  .post('/internal/incoming', async ({ headers, body, set }) => {
    const internalToken = headers['x-internal-token'];
    if (!internalToken || internalToken !== config.waConnectorToken) {
      set.status = 401;
      return { error: 'Unauthorized internal token' };
    }

    const { deviceId, from, sender, message, mediaUrl, isGroup, pushName, fromMe } = body as {
      deviceId: string;
      from: string;
      sender?: string;
      message?: string;
      mediaUrl?: string;
      isGroup?: boolean;
      pushName?: string;
      fromMe?: boolean;
    };

    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, deviceId))
      .limit(1);

    if (!device) return { status: 'ignored' };

    // Dispatch webhook for incoming message
    await dispatchWebhook(device.userId, 'message.incoming', {
      deviceId,
      from,
      sender,
      message,
      mediaUrl,
      isGroup,
      fromMe: !!fromMe,
    });

    // Auto reply processing (only for incoming 1-on-1 chats not from self and when enabled)
    if (!fromMe && !isGroup && device.autoReplyEnabled && message) {
      const rules = await db
        .select()
        .from(schema.autoReplyRules)
        .where(
          and(
            eq(schema.autoReplyRules.deviceId, deviceId),
            eq(schema.autoReplyRules.active, true),
          ),
        );

      const normalizedMsg = message.trim().toLowerCase();
      for (const rule of rules) {
        const keyword = rule.keyword.trim().toLowerCase();
        let matched = false;

        if (rule.matchMode === 'exact') {
          matched = normalizedMsg === keyword;
        } else {
          matched = normalizedMsg.includes(keyword);
        }

        if (matched) {
          // Send auto reply response
          try {
            const cleanTarget = stripJid(from);
            if (!cleanTarget || !/^\d{8,16}$/.test(cleanTarget)) {
              console.warn(`[AutoReply] Skipped: invalid recipient from=${from}`);
              break;
            }
            const senderName = pushName || sender || cleanTarget;
            const personalizedReply = personalize(rule.reply, senderName);
            await waClient.sendMessage({
              deviceId,
              to: cleanTarget,
              type: 'text',
              message: personalizedReply,
            });
          } catch (err: any) {
            console.error(`[AutoReply] Failed to send reply to ${from}:`, err.message);
          }
          break; // Stop after first matched rule
        }
      }
    }

    return { status: 'ok' };
  });
