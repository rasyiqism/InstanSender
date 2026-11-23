import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { waClient } from '../common/wa-client';
import { dispatchWebhook } from '../common/webhooks';

async function getUserIdFromContext(validateApiKeyAuth: any, getAuthUser: any): Promise<{ userId: string; scopedDeviceId?: string | null }> {
  try {
    const authResult = await validateApiKeyAuth();
    return { userId: authResult.user.id, scopedDeviceId: authResult.keyRecord.deviceId };
  } catch {
    const user = await getAuthUser();
    return { userId: user.id, scopedDeviceId: null };
  }
}

export const groupsRoutes = new Elysia({ prefix: '/v1/groups' })
  .use(authContext)
  // List groups
  .post(
    '/',
    async ({ body, validateApiKeyAuth, getAuthUser, set }) => {
      const { userId, scopedDeviceId } = await getUserIdFromContext(validateApiKeyAuth, getAuthUser);
      const deviceId = scopedDeviceId || (body as any)?.deviceId;

      if (!deviceId) {
        set.status = 400;
        return { error: 'deviceId wajib disertakan' };
      }

      const [device] = await db
        .select()
        .from(schema.devices)
        .where(and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, userId)))
        .limit(1);

      if (!device) {
        set.status = 404;
        return { error: 'Device tidak ditemukan' };
      }

      return waClient.getGroups(deviceId);
    },
    {
      body: t.Optional(
        t.Object({
          deviceId: t.Optional(t.String()),
        }),
      ),
    },
  )
  .get('/', async ({ query, validateApiKeyAuth, getAuthUser, set }) => {
    const { userId, scopedDeviceId } = await getUserIdFromContext(validateApiKeyAuth, getAuthUser);
    const deviceId = scopedDeviceId || (query as any)?.deviceId;

    if (!deviceId) {
      set.status = 400;
      return { error: 'deviceId wajib disertakan' };
    }

    const [device] = await db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, userId)))
      .limit(1);

    if (!device) {
      set.status = 404;
      return { error: 'Device tidak ditemukan' };
    }

    return waClient.getGroups(deviceId);
  })
  // Scrape group members
  .post(
    '/members',
    async ({ body, validateApiKeyAuth, getAuthUser, set }) => {
      const { userId, scopedDeviceId } = await getUserIdFromContext(validateApiKeyAuth, getAuthUser);
      const { groupJid, deviceId } = body;
      const targetDeviceId = scopedDeviceId || deviceId;

      if (!targetDeviceId) {
        set.status = 400;
        return { error: 'deviceId wajib disertakan' };
      }

      const [device] = await db
        .select()
        .from(schema.devices)
        .where(and(eq(schema.devices.id, targetDeviceId), eq(schema.devices.userId, userId)))
        .limit(1);

      if (!device) {
        set.status = 404;
        return { error: 'Device tidak ditemukan' };
      }

      const members = await waClient.getGroupMembers(targetDeviceId, groupJid);

      // Best effort webhook
      await dispatchWebhook(userId, 'group.members', {
        deviceId: targetDeviceId,
        groupJid,
        members,
      });

      return {
        groupJid,
        members,
      };
    },
    {
      body: t.Object({
        groupJid: t.String(),
        deviceId: t.Optional(t.String()),
      }),
    },
  );
