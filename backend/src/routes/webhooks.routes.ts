import { Elysia, t } from 'elysia';
import crypto from 'node:crypto';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authContext } from '../common/middleware';

export const webhookRoutes = new Elysia({ prefix: '/webhooks' })
  .use(authContext)
  // 1. List webhooks
  .get('/', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    return db
      .select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.userId, user.id))
      .orderBy(desc(schema.webhooks.createdAt));
  })
  // 2. Create webhook
  .post(
    '/',
    async ({ body, getAuthUser }) => {
      const user = await getAuthUser();
      const secret = crypto.randomBytes(24).toString('hex');

      const [webhook] = await db
        .insert(schema.webhooks)
        .values({
          userId: user.id,
          url: body.url.trim(),
          eventType: (body.eventType as any) || 'message.status',
          secret,
          active: true,
        })
        .returning();

      return webhook;
    },
    {
      body: t.Object({
        url: t.String({ format: 'uri' }),
        eventType: t.Optional(t.String()),
      }),
    },
  )
  // 3. Delete webhook
  .delete('/:id', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [hook] = await db
      .select()
      .from(schema.webhooks)
      .where(and(eq(schema.webhooks.id, params.id), eq(schema.webhooks.userId, user.id)))
      .limit(1);

    if (!hook) {
      set.status = 404;
      return { message: 'Webhook tidak ditemukan' };
    }

    await db.delete(schema.webhooks).where(eq(schema.webhooks.id, params.id));
    return { success: true };
  });
