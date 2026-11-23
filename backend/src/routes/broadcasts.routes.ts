import { Elysia, t } from 'elysia';
import { personalize } from '../common/template';
import { db, schema } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { messageQueue } from '../common/queue';

export const broadcastRoutes = new Elysia({ prefix: '/broadcasts' })
  .use(authContext)
  // 1. List broadcasts
  .get('/', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    return db
      .select()
      .from(schema.broadcasts)
      .where(eq(schema.broadcasts.userId, user.id))
      .orderBy(desc(schema.broadcasts.createdAt));
  })
  // 2. Create broadcast
  .post(
    '/',
    async ({ body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const { deviceId, contactListId, message, type, mediaUrl, caption, delaySeconds, scheduledAt } = body;

      // Validate device ownership
      const [device] = await db
        .select()
        .from(schema.devices)
        .where(and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, user.id)))
        .limit(1);

      if (!device) {
        set.status = 404;
        return { message: 'Device tidak ditemukan' };
      }

      // Validate contact list
      const [list] = await db
        .select()
        .from(schema.contactLists)
        .where(and(eq(schema.contactLists.id, contactListId), eq(schema.contactLists.userId, user.id)))
        .limit(1);

      if (!list) {
        set.status = 404;
        return { message: 'Daftar kontak tidak ditemukan' };
      }

      const contacts = await db
        .select()
        .from(schema.contacts)
        .where(eq(schema.contacts.contactListId, contactListId));

      if (contacts.length === 0) {
        set.status = 400;
        return { message: 'Daftar kontak masih kosong' };
      }

      // Check subscription quota if applicable
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.status, 'active')))
        .limit(1);

      if (sub) {
        const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, sub.packageId)).limit(1);
        if (pkg?.messageQuota !== null && pkg?.messageQuota !== undefined) {
          if (sub.messagesUsed + contacts.length > pkg.messageQuota) {
            set.status = 403;
            return {
              message: `Kuota pesan bulanan tidak mencukupi (${sub.messagesUsed}/${pkg.messageQuota}) untuk mengirim ke ${contacts.length} penerima`,
            };
          }
        }

        // Increment messages used for entire batch
        await db
          .update(schema.subscriptions)
          .set({ messagesUsed: sql`${schema.subscriptions.messagesUsed} + ${contacts.length}` })
          .where(eq(schema.subscriptions.id, sub.id));
      }

      const delaySec = delaySeconds && delaySeconds >= 2 ? delaySeconds : 5;

      const parsedSchedule = scheduledAt ? new Date(scheduledAt) : null;
      const scheduleTimeMs = parsedSchedule && !isNaN(parsedSchedule.getTime()) ? parsedSchedule.getTime() : null;
      const isFutureSchedule = scheduleTimeMs !== null && scheduleTimeMs > Date.now();
      const initialDelayMs = isFutureSchedule ? scheduleTimeMs! - Date.now() : 0;

      const [broadcast] = await db
        .insert(schema.broadcasts)
        .values({
          userId: user.id,
          deviceId,
          contactListId,
          message: message || null,
          type: type || 'text',
          mediaUrl: mediaUrl || null,
          caption: caption || null,
          status: isFutureSchedule ? 'pending' : 'running',
          totalRecipients: contacts.length,
          sentCount: 0,
          failedCount: 0,
          delaySeconds: delaySec,
          scheduledAt: parsedSchedule && !isNaN(parsedSchedule.getTime()) ? parsedSchedule : null,
          startedAt: isFutureSchedule ? null : new Date(),
        })
        .returning();

      // Enqueue messages with staggered delay
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const personalizedMsg = personalize(message, contact.name);

        const [log] = await db
          .insert(schema.messageLogs)
          .values({
            deviceId,
            broadcastId: broadcast.id,
            recipient: contact.phoneNumber,
            messageType: type || 'text',
            status: 'queued',
          })
          .returning();

        const delayMs = initialDelayMs + i * delaySec * 1000;
        await messageQueue.add(
          'send-message',
          {
            logId: log.id,
            deviceId,
            userId: user.id,
            to: contact.phoneNumber,
            type: type || 'text',
            message: personalizedMsg,
            mediaUrl: mediaUrl || null,
            caption: caption || null,
            broadcastId: broadcast.id,
          },
          { delay: delayMs },
        );
      }

      return broadcast;
    },
    {
      body: t.Object({
        deviceId: t.String(),
        contactListId: t.String(),
        message: t.Optional(t.String()),
        type: t.Optional(t.Union([t.Literal('text'), t.Literal('image'), t.Literal('document')])),
        mediaUrl: t.Optional(t.String()),
        caption: t.Optional(t.String()),
        delaySeconds: t.Optional(t.Number()),
        scheduledAt: t.Optional(t.String()),
      }),
    },
  )
  // 3. Get broadcast details
  .get('/:id', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [b] = await db
      .select()
      .from(schema.broadcasts)
      .where(and(eq(schema.broadcasts.id, params.id), eq(schema.broadcasts.userId, user.id)))
      .limit(1);

    if (!b) {
      set.status = 404;
      return { message: 'Broadcast tidak ditemukan' };
    }

    return b;
  })
  // 4. Cancel broadcast
  .post('/:id/cancel', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [b] = await db
      .select()
      .from(schema.broadcasts)
      .where(and(eq(schema.broadcasts.id, params.id), eq(schema.broadcasts.userId, user.id)))
      .limit(1);

    if (!b) {
      set.status = 404;
      return { message: 'Broadcast tidak ditemukan' };
    }

    if (b.status === 'completed' || b.status === 'cancelled') {
      set.status = 400;
      return { message: `Broadcast sudah berstatus ${b.status} dan tidak dapat dibatalkan` };
    }

    await db
      .update(schema.broadcasts)
      .set({ status: 'cancelled' })
      .where(eq(schema.broadcasts.id, b.id));

    // Refund unsent messages
    const unsent = Math.max(0, b.totalRecipients - (b.sentCount + b.failedCount));
    if (unsent > 0) {
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.status, 'active')))
        .limit(1);

      if (sub) {
        await db
          .update(schema.subscriptions)
          .set({ messagesUsed: sql`GREATEST(0, ${schema.subscriptions.messagesUsed} - ${unsent})` })
          .where(eq(schema.subscriptions.id, sub.id));
      }
    }

    return { success: true, message: 'Broadcast berhasil dibatalkan', refunded: unsent };
  })
  // 5. Pause broadcast
  .post('/:id/pause', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [b] = await db
      .select()
      .from(schema.broadcasts)
      .where(and(eq(schema.broadcasts.id, params.id), eq(schema.broadcasts.userId, user.id)))
      .limit(1);

    if (!b) {
      set.status = 404;
      return { message: 'Broadcast tidak ditemukan' };
    }

    if (b.status !== 'running') {
      set.status = 400;
      return { message: 'Hanya broadcast yang sedang berjalan yang dapat dijeda' };
    }

    await db
      .update(schema.broadcasts)
      .set({ status: 'paused' })
      .where(eq(schema.broadcasts.id, b.id));

    return { success: true, message: 'Broadcast berhasil dijeda' };
  })
  // 6. Resume broadcast
  .post('/:id/resume', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [b] = await db
      .select()
      .from(schema.broadcasts)
      .where(and(eq(schema.broadcasts.id, params.id), eq(schema.broadcasts.userId, user.id)))
      .limit(1);

    if (!b) {
      set.status = 404;
      return { message: 'Broadcast tidak ditemukan' };
    }

    if (b.status !== 'paused') {
      set.status = 400;
      return { message: 'Hanya broadcast yang berstatus dijeda yang dapat dilanjutkan' };
    }

    await db
      .update(schema.broadcasts)
      .set({ status: 'running' })
      .where(eq(schema.broadcasts.id, b.id));

    return { success: true, message: 'Broadcast berhasil dilanjutkan' };
  });
