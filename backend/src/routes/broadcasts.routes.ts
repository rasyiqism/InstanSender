import { Elysia, t } from 'elysia';
import { personalize } from '../common/template';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
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
      const { deviceId, contactListId, message, type, mediaUrl, caption, delaySeconds } = body;

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

      const delaySec = delaySeconds && delaySeconds >= 2 ? delaySeconds : 5;

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
          status: 'running',
          totalRecipients: contacts.length,
          sentCount: 0,
          failedCount: 0,
          delaySeconds: delaySec,
          startedAt: new Date(),
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

        const delayMs = i * delaySec * 1000;
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
  });
