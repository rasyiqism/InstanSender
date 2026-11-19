import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { hashPassword } from '../common/auth';
import { config } from '../config';

export const agencyRoutes = new Elysia()
  .use(authContext)
  // 1. Agency Dashboard Overview
  .get('/agency/dashboard', async ({ getAgencyUser, set }) => {
    const user = await getAgencyUser();
    const [agency] = await db
      .select()
      .from(schema.agencies)
      .where(eq(schema.agencies.ownerUserId, user.id))
      .limit(1);

    if (!agency) {
      set.status = 404;
      return { message: 'Data agency tidak ditemukan' };
    }

    const [sub] = await db
      .select()
      .from(schema.agencySubscriptions)
      .where(eq(schema.agencySubscriptions.agencyId, agency.id))
      .orderBy(desc(schema.agencySubscriptions.createdAt))
      .limit(1);

    const [userCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(eq(schema.users.agencyId, agency.id));

    const [deviceCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.devices)
      .where(eq(schema.devices.agencyId, agency.id));

    return {
      agency,
      subscription: sub || null,
      stats: {
        totalUsers: userCountRes?.count || 0,
        totalDevices: deviceCountRes?.count || 0,
        activationUsed: sub?.activationUsed || 0,
        activationLimit: sub?.activationLimit || 0,
      },
    };
  })
  // 2. List Agency Users
  .get('/agency/users', async ({ getAgencyUser, set }) => {
    const user = await getAgencyUser();
    const [agency] = await db
      .select()
      .from(schema.agencies)
      .where(eq(schema.agencies.ownerUserId, user.id))
      .limit(1);

    if (!agency) {
      set.status = 404;
      return { message: 'Agency tidak ditemukan' };
    }

    const usersList = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phoneNumber: schema.users.phoneNumber,
        role: schema.users.role,
        suspendedAt: schema.users.suspendedAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.agencyId, agency.id))
      .orderBy(desc(schema.users.createdAt));

    return usersList;
  })
  // 3. Create Agency User
  .post(
    '/agency/users',
    async ({ body, getAgencyUser, set }) => {
      const agencyOwner = await getAgencyUser();
      const [agency] = await db
        .select()
        .from(schema.agencies)
        .where(eq(schema.agencies.ownerUserId, agencyOwner.id))
        .limit(1);

      if (!agency) {
        set.status = 404;
        return { message: 'Agency tidak ditemukan' };
      }

      // Check subscription activation limit
      const [sub] = await db
        .select()
        .from(schema.agencySubscriptions)
        .where(eq(schema.agencySubscriptions.agencyId, agency.id))
        .orderBy(desc(schema.agencySubscriptions.createdAt))
        .limit(1);

      if (!sub) {
        set.status = 400;
        return { message: 'Agency belum memiliki paket subscription aktif' };
      }

      if (sub.activationLimit > 0 && sub.activationUsed >= sub.activationLimit) {
        set.status = 400;
        return { message: `Batas kuota aktivasi pengguna (${sub.activationLimit}) telah habis` };
      }

      const normalizedEmail = body.email.toLowerCase().trim();
      const [existing] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizedEmail))
        .limit(1);

      if (existing) {
        set.status = 400;
        return { message: 'Email sudah terdaftar di sistem' };
      }

      const passHash = await hashPassword(body.password);
      const [newUser] = await db
        .insert(schema.users)
        .values({
          name: body.name,
          email: normalizedEmail,
          phoneNumber: body.phoneNumber || null,
          passwordHash: passHash,
          role: 'user',
          agencyId: agency.id,
        })
        .returning();

      // If packageId provided, activate user subscription
      if (body.packageId) {
        const [pkg] = await db
          .select()
          .from(schema.packages)
          .where(eq(schema.packages.id, body.packageId))
          .limit(1);

        if (pkg) {
          const now = new Date();
          const endDate = new Date(now.getTime() + pkg.durationDays * 86400000);
          await db.insert(schema.subscriptions).values({
            userId: newUser.id,
            packageId: pkg.id,
            status: 'active',
            startDate: now,
            endDate,
          });
        }
      }

      // Increment activation used
      await db
        .update(schema.agencySubscriptions)
        .set({ activationUsed: sql`${schema.agencySubscriptions.activationUsed} + 1` })
        .where(eq(schema.agencySubscriptions.id, sub.id));

      const { passwordHash: _, ...safeUser } = newUser;
      return safeUser;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        phoneNumber: t.Optional(t.String()),
        packageId: t.Optional(t.String()),
      }),
    },
  )
  // 4. Renew User Subscription
  .post(
    '/agency/users/:id/renew',
    async ({ params, body, getAgencyUser, set }) => {
      const agencyOwner = await getAgencyUser();
      const [agency] = await db
        .select()
        .from(schema.agencies)
        .where(eq(schema.agencies.ownerUserId, agencyOwner.id))
        .limit(1);

      if (!agency) {
        set.status = 404;
        return { message: 'Agency tidak ditemukan' };
      }

      const [targetUser] = await db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, params.id), eq(schema.users.agencyId, agency.id)))
        .limit(1);

      if (!targetUser) {
        set.status = 404;
        return { message: 'Pengguna tidak ditemukan di bawah agency Anda' };
      }

      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, targetUser.id))
        .orderBy(desc(schema.subscriptions.createdAt))
        .limit(1);

      const daysToAdd = body.durationDays || 30;
      const baseDate = sub?.endDate && sub.endDate > new Date() ? sub.endDate : new Date();
      const newEndDate = new Date(baseDate.getTime() + daysToAdd * 86400000);

      if (sub) {
        await db
          .update(schema.subscriptions)
          .set({ status: 'active', endDate: newEndDate })
          .where(eq(schema.subscriptions.id, sub.id));
      }

      return { success: true, message: `Langganan diperpanjang hingga ${newEndDate.toISOString()}` };
    },
    {
      body: t.Object({
        durationDays: t.Optional(t.Number()),
      }),
    },
  )
  // 5. Suspend User
  .post('/agency/users/:id/suspend', async ({ params, getAgencyUser, set }) => {
    const agencyOwner = await getAgencyUser();
    const [agency] = await db
      .select()
      .from(schema.agencies)
      .where(eq(schema.agencies.ownerUserId, agencyOwner.id))
      .limit(1);

    if (!agency) {
      set.status = 404;
      return { message: 'Agency tidak ditemukan' };
    }

    await db
      .update(schema.users)
      .set({ suspendedAt: new Date() })
      .where(and(eq(schema.users.id, params.id), eq(schema.users.agencyId, agency.id)));

    return { success: true };
  })
  // 6. Activate User
  .post('/agency/users/:id/activate', async ({ params, getAgencyUser, set }) => {
    const agencyOwner = await getAgencyUser();
    const [agency] = await db
      .select()
      .from(schema.agencies)
      .where(eq(schema.agencies.ownerUserId, agencyOwner.id))
      .limit(1);

    if (!agency) {
      set.status = 404;
      return { message: 'Agency tidak ditemukan' };
    }

    await db
      .update(schema.users)
      .set({ suspendedAt: null })
      .where(and(eq(schema.users.id, params.id), eq(schema.users.agencyId, agency.id)));

    return { success: true };
  })
  // 7. Internal API: Programmatic Agency Provisioning
  .post('/internal/agency', async ({ headers, body, set }) => {
    const token = headers['x-internal-token'];
    if (!token || token !== config.internalApiToken) {
      set.status = 401;
      return { error: 'Unauthorized internal token' };
    }

    const { name, email, password, phoneNumber, agencyName } = body as any;
    const normalizedEmail = email.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      set.status = 400;
      return { message: 'Email sudah terdaftar' };
    }

    const passHash = await hashPassword(password);
    const [newUser] = await db
      .insert(schema.users)
      .values({
        name,
        email: normalizedEmail,
        phoneNumber,
        passwordHash: passHash,
        role: 'agency',
      })
      .returning();

    const [newAgency] = await db
      .insert(schema.agencies)
      .values({
        ownerUserId: newUser.id,
        name: agencyName || name,
        status: 'active',
      })
      .returning();

    return {
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
      agency: newAgency,
    };
  });
