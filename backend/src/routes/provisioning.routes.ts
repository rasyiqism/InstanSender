import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { config } from '../config';

export const provisioningRoutes = new Elysia({ prefix: '/v1/provisioning' })
  .post(
    '/subscription',
    async ({ headers, body, set }) => {
      const auth = headers['authorization'];
      const expected = config.provisioningToken;

      if (!expected) {
        set.status = 400;
        return { error: 'Provisioning is not configured (set PROVISIONING_TOKEN)' };
      }

      if (!auth?.startsWith('Bearer ') || auth.slice(7).trim() !== expected) {
        set.status = 401;
        return { error: 'Invalid provisioning token' };
      }

      const { userId, packageId, durationDays } = body;

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { error: 'User tidak ditemukan' };
      }

      const [pkg] = await db
        .select()
        .from(schema.packages)
        .where(eq(schema.packages.id, packageId))
        .limit(1);

      if (!pkg) {
        set.status = 404;
        return { error: 'Paket tidak ditemukan' };
      }

      const now = new Date();
      const days = durationDays || pkg.durationDays || 30;
      const endDate = new Date(now.getTime() + days * 86400000);

      const [sub] = await db
        .insert(schema.subscriptions)
        .values({
          userId: user.id,
          packageId: pkg.id,
          status: 'active',
          startDate: now,
          endDate,
          messagesUsed: 0,
        })
        .returning();

      const [payment] = await db
        .insert(schema.payments)
        .values({
          userId: user.id,
          subscriptionId: sub.id,
          amount: pkg.price,
          kodeUnik: 0,
          bankAccountTujuan: 'Direct activation (external integration)',
          status: 'paid',
          verifiedBy: 'provisioning',
          verifiedAt: now,
        })
        .returning();

      return {
        subscription: sub,
        payment,
      };
    },
    {
      body: t.Object({
        userId: t.String(),
        packageId: t.String(),
        durationDays: t.Optional(t.Number()),
      }),
    },
  );
