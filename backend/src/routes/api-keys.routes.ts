import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and, isNull } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { generateApiKey } from '../common/auth';

export const apiKeysRoutes = new Elysia({ prefix: '/api-keys' })
  .use(authContext)
  // 1. List user keys
  .get('/', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    return db
      .select({
        id: schema.apiKeys.id,
        userId: schema.apiKeys.userId,
        deviceId: schema.apiKeys.deviceId,
        keyPrefix: schema.apiKeys.keyPrefix,
        scope: schema.apiKeys.scope,
        createdAt: schema.apiKeys.createdAt,
      })
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.userId, user.id), isNull(schema.apiKeys.revokedAt)))
      .orderBy(schema.apiKeys.createdAt);
  })
  // 2. Generate new key
  .post(
    '/',
    async ({ body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const { deviceId } = body;

      if (deviceId) {
        const [device] = await db
          .select()
          .from(schema.devices)
          .where(and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, user.id)))
          .limit(1);

        if (!device) {
          set.status = 404;
          return { message: 'Device tidak ditemukan' };
        }
      }

      const { key, prefix, hash } = generateApiKey();

      const [newKey] = await db
        .insert(schema.apiKeys)
        .values({
          userId: user.id,
          deviceId: deviceId || null,
          keyHash: hash,
          keyPrefix: prefix,
          scope: 'send:message',
        })
        .returning({
          id: schema.apiKeys.id,
          userId: schema.apiKeys.userId,
          deviceId: schema.apiKeys.deviceId,
          keyPrefix: schema.apiKeys.keyPrefix,
          scope: schema.apiKeys.scope,
          createdAt: schema.apiKeys.createdAt,
        });

      return {
        ...newKey,
        key, // Plaintext is returned only on creation
      };
    },
    {
      body: t.Object({
        deviceId: t.Optional(t.String()),
      }),
    },
  )
  // 3. Revoke key
  .delete('/:id', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [key] = await db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, params.id), eq(schema.apiKeys.userId, user.id)))
      .limit(1);

    if (!key) {
      set.status = 404;
      return { message: 'API Key tidak ditemukan' };
    }

    await db
      .update(schema.apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(schema.apiKeys.id, params.id));

    return { success: true };
  });
