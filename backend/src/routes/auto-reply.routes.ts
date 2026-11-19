import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authContext } from '../common/middleware';

export const autoReplyRoutes = new Elysia({ prefix: '/devices/:id/auto-reply' })
  .use(authContext)
  // 1. Get status & rules
  .get('/', async ({ params, getAuthUser, set }) => {
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

    const rules = await db
      .select()
      .from(schema.autoReplyRules)
      .where(eq(schema.autoReplyRules.deviceId, params.id))
      .orderBy(schema.autoReplyRules.createdAt);

    return {
      enabled: device.autoReplyEnabled,
      rules,
    };
  })
  // 2. Toggle master switch
  .patch(
    '/',
    async ({ params, body, getAuthUser, set }) => {
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

      await db
        .update(schema.devices)
        .set({ autoReplyEnabled: body.enabled })
        .where(eq(schema.devices.id, params.id));

      return { enabled: body.enabled };
    },
    {
      body: t.Object({
        enabled: t.Boolean(),
      }),
    },
  )
  // 3. Create rule
  .post(
    '/rules',
    async ({ params, body, getAuthUser, set }) => {
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

      const [newRule] = await db
        .insert(schema.autoReplyRules)
        .values({
          deviceId: params.id,
          keyword: body.keyword.trim(),
          matchMode: body.matchMode || 'contains',
          reply: body.reply.trim(),
          active: body.active !== undefined ? body.active : true,
        })
        .returning();

      return newRule;
    },
    {
      body: t.Object({
        keyword: t.String({ minLength: 1 }),
        matchMode: t.Optional(t.Union([t.Literal('contains'), t.Literal('exact')])),
        reply: t.String({ minLength: 1 }),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  // 4. Update rule
  .patch(
    '/rules/:ruleId',
    async ({ params, body, getAuthUser, set }) => {
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

      const [updated] = await db
        .update(schema.autoReplyRules)
        .set({
          keyword: body.keyword ? body.keyword.trim() : undefined,
          matchMode: body.matchMode,
          reply: body.reply ? body.reply.trim() : undefined,
          active: body.active,
        })
        .where(
          and(
            eq(schema.autoReplyRules.id, params.ruleId),
            eq(schema.autoReplyRules.deviceId, params.id),
          ),
        )
        .returning();

      if (!updated) {
        set.status = 404;
        return { message: 'Rule tidak ditemukan' };
      }

      return updated;
    },
    {
      body: t.Object({
        keyword: t.Optional(t.String()),
        matchMode: t.Optional(t.Union([t.Literal('contains'), t.Literal('exact')])),
        reply: t.Optional(t.String()),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  // 5. Delete rule
  .delete('/rules/:ruleId', async ({ params, getAuthUser, set }) => {
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

    await db
      .delete(schema.autoReplyRules)
      .where(
        and(
          eq(schema.autoReplyRules.id, params.ruleId),
          eq(schema.autoReplyRules.deviceId, params.id),
        ),
      );

    return { success: true };
  });
