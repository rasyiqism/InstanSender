import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { authContext } from '../common/middleware';

export const logsRoutes = new Elysia({ prefix: '/logs' })
  .use(authContext)
  // 1. Get message logs
  .get('/', async ({ query, getAuthUser }) => {
    const user = await getAuthUser();
    const limit = Number(query.limit) || 20;
    const page = Number(query.page) || 1;
    const offset = (page - 1) * limit;

    const userDevices = await db
      .select({ id: schema.devices.id })
      .from(schema.devices)
      .where(eq(schema.devices.userId, user.id));

    if (userDevices.length === 0) {
      return { data: [], total: 0, page, limit };
    }

    const deviceIds = userDevices.map((d) => d.id);
    const conditions = [inArray(schema.messageLogs.deviceId, deviceIds)];

    if (query.deviceId) {
      conditions.push(eq(schema.messageLogs.deviceId, query.deviceId as string));
    }
    if (query.status) {
      conditions.push(eq(schema.messageLogs.status, query.status as any));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messageLogs)
      .where(whereClause);

    const logs = await db
      .select()
      .from(schema.messageLogs)
      .where(whereClause)
      .orderBy(desc(schema.messageLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: logs,
      total: countResult?.count || 0,
      page,
      limit,
    };
  })
  // 2. Delete single message log
  .delete('/:id', async ({ params, getAuthUser }) => {
    const user = await getAuthUser();
    const userDevices = await db
      .select({ id: schema.devices.id })
      .from(schema.devices)
      .where(eq(schema.devices.userId, user.id));

    const deviceIds = userDevices.map((d) => d.id);
    if (deviceIds.length > 0) {
      await db
        .delete(schema.messageLogs)
        .where(
          and(
            eq(schema.messageLogs.id, params.id),
            inArray(schema.messageLogs.deviceId, deviceIds),
          ),
        );
    }
    return { success: true };
  })
  // 3. Batch delete message logs
  .delete(
    '/batch',
    async ({ body, getAuthUser }) => {
      const user = await getAuthUser();
      const ids = (body as any).ids as string[];
      if (!ids || ids.length === 0) return { deleted: 0 };

      const userDevices = await db
        .select({ id: schema.devices.id })
        .from(schema.devices)
        .where(eq(schema.devices.userId, user.id));

      const deviceIds = userDevices.map((d) => d.id);
      if (deviceIds.length > 0) {
        await db
          .delete(schema.messageLogs)
          .where(
            and(
              inArray(schema.messageLogs.id, ids),
              inArray(schema.messageLogs.deviceId, deviceIds),
            ),
          );
      }
      return { success: true, deleted: ids.length };
    },
    {
      body: t.Object({
        ids: t.Array(t.String()),
      }),
    },
  )
  // 4. Get webhook logs
  .get('/webhooks', async ({ query, getAuthUser }) => {
    const user = await getAuthUser();
    const limit = Number(query.limit) || 20;
    const page = Number(query.page) || 1;
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.webhookLogs.userId, user.id)];
    if (query.webhookId) {
      conditions.push(eq(schema.webhookLogs.webhookId, query.webhookId as string));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.webhookLogs)
      .where(whereClause);

    const logs = await db
      .select()
      .from(schema.webhookLogs)
      .where(whereClause)
      .orderBy(desc(schema.webhookLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: logs,
      total: countResult?.count || 0,
      page,
      limit,
    };
  })
  // 5. Delete single webhook log
  .delete('/webhooks/:id', async ({ params, getAuthUser }) => {
    const user = await getAuthUser();
    await db
      .delete(schema.webhookLogs)
      .where(and(eq(schema.webhookLogs.id, params.id), eq(schema.webhookLogs.userId, user.id)));
    return { success: true };
  })
  // 6. Batch delete webhook logs
  .delete('/webhooks', async ({ body, getAuthUser }) => {
    const user = await getAuthUser();
    const ids = (body as any)?.ids as string[];
    if (ids && ids.length > 0) {
      await db
        .delete(schema.webhookLogs)
        .where(and(inArray(schema.webhookLogs.id, ids), eq(schema.webhookLogs.userId, user.id)));
    }
    return { success: true };
  });
