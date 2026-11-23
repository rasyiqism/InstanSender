import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { hashPassword, findApiKey } from '../common/auth';
import { sendWelcomeNotification } from '../common/notifications';
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

    if (usersList.length === 0) return [];

    const enriched = await Promise.all(
      usersList.map(async (u) => {
        const [sub] = await db
          .select({
            status: schema.subscriptions.status,
            endDate: schema.subscriptions.endDate,
            packageId: schema.subscriptions.packageId,
          })
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, u.id))
          .orderBy(desc(schema.subscriptions.createdAt))
          .limit(1);

        let pkgName: string | null = null;
        let maxDevice = 1;
        if (sub?.packageId) {
          const [pkg] = await db
            .select({ name: schema.packages.name, maxDevice: schema.packages.maxDevice })
            .from(schema.packages)
            .where(eq(schema.packages.id, sub.packageId))
            .limit(1);
          if (pkg) {
            pkgName = pkg.name;
            maxDevice = pkg.maxDevice;
          }
        }

        const [devCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.devices)
          .where(eq(schema.devices.userId, u.id));

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phoneNumber: u.phoneNumber,
          role: u.role,
          suspended: Boolean(u.suspendedAt),
          suspendedAt: u.suspendedAt,
          package: pkgName,
          maxDevice,
          deviceCount: devCount?.count || 0,
          subscriptionStatus: sub?.status || 'inactive',
          subscriptionEnd: sub?.endDate || null,
          createdAt: u.createdAt,
        };
      }),
    );

    return enriched;
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
      const { newUser, safeUser } = await db.transaction(async (tx) => {
        const [newUser] = await tx
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
          const [pkg] = await tx
            .select()
            .from(schema.packages)
            .where(eq(schema.packages.id, body.packageId))
            .limit(1);

          if (pkg) {
            const now = new Date();
            const endDate = new Date(now.getTime() + pkg.durationDays * 86400000);
            await tx.insert(schema.subscriptions).values({
              userId: newUser.id,
              packageId: pkg.id,
              status: 'active',
              startDate: now,
              endDate,
            });
          }
        }

        // Increment activation used
        await tx
          .update(schema.agencySubscriptions)
          .set({ activationUsed: sql`${schema.agencySubscriptions.activationUsed} + 1` })
          .where(eq(schema.agencySubscriptions.id, sub.id));

        const { passwordHash: _, ...safe } = newUser;
        return { newUser, safeUser: safe };
      });

      sendWelcomeNotification(newUser, body.password).catch(() => {});

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
  // 7. Delete Agency User (and reclaim activation)
  .delete('/agency/users/:id', async ({ params, getAgencyUser, set }) => {
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

    // Delete user
    await db.delete(schema.users).where(eq(schema.users.id, targetUser.id));

    // Reclaim activation quota if possible
    const [sub] = await db
      .select()
      .from(schema.agencySubscriptions)
      .where(eq(schema.agencySubscriptions.agencyId, agency.id))
      .orderBy(desc(schema.agencySubscriptions.createdAt))
      .limit(1);

    if (sub && sub.activationUsed > 0) {
      await db
        .update(schema.agencySubscriptions)
        .set({ activationUsed: sql`GREATEST(0, ${schema.agencySubscriptions.activationUsed} - 1)` })
        .where(eq(schema.agencySubscriptions.id, sub.id));
    }

    return { success: true, message: 'Pengguna berhasil dihapus' };
  })
  // 8. Get devices of agency user
  .get('/agency/users/:id/devices', async ({ params, getAgencyUser, set }) => {
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

    const devices = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.userId, targetUser.id))
      .orderBy(desc(schema.devices.createdAt));

    return devices;
  })
  // 9. Reseller Programmatic API (authenticated via Agency API Key)
  .group('/agency/v1', (v1Group) =>
    v1Group
      .resolve(async ({ headers, set }) => {
        const authHeader = headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
          set.status = 401;
          throw new Error('API Key wajib disertakan pada header Authorization: Bearer <key>');
        }
        const token = authHeader.slice(7).trim();
        if (!token || token.includes('.')) {
          set.status = 401;
          throw new Error('Token JWT tidak valid untuk API Reseller. Gunakan API Key Agency.');
        }

        const apiKey = await findApiKey(token);
        if (!apiKey) {
          set.status = 401;
          throw new Error('API Key tidak valid atau telah dicabut');
        }

        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, apiKey.userId))
          .limit(1);

        if (!user || user.role !== 'agency') {
          set.status = 403;
          throw new Error('Akses khusus Agency diperlukan');
        }

        if (user.suspendedAt) {
          set.status = 403;
          throw new Error('Akun Agency Anda sedang disuspend');
        }

        const [agency] = await db
          .select()
          .from(schema.agencies)
          .where(and(eq(schema.agencies.ownerUserId, user.id), eq(schema.agencies.status, 'active')))
          .limit(1);

        if (!agency) {
          set.status = 403;
          throw new Error('Profil Agency tidak ditemukan atau tidak aktif');
        }

        return { agencyUser: user, agency, apiKey };
      })
      .get('/packages', async ({ agency }) => {
        const [sub] = await db
          .select()
          .from(schema.agencySubscriptions)
          .where(eq(schema.agencySubscriptions.agencyId, agency.id))
          .orderBy(desc(schema.agencySubscriptions.createdAt))
          .limit(1);

        const allPackages = await db
          .select()
          .from(schema.packages)
          .where(eq(schema.packages.active, true))
          .orderBy(schema.packages.price);

        if (!sub?.allowedPackages) {
          return allPackages;
        }

        const allowed = sub.allowedPackages.split(',').map((s) => s.trim().toLowerCase());
        return allPackages.filter((p) => allowed.includes(p.id.toLowerCase()) || allowed.includes(p.name.toLowerCase()));
      })
      .get('/quota', async ({ agency }) => {
        const [sub] = await db
          .select()
          .from(schema.agencySubscriptions)
          .where(eq(schema.agencySubscriptions.agencyId, agency.id))
          .orderBy(desc(schema.agencySubscriptions.createdAt))
          .limit(1);

        const limit = sub?.activationLimit || sub?.deviceQuota || 0;
        const used = sub?.activationUsed || 0;
        const allowed = sub?.allowedPackages ? sub.allowedPackages.split(',').map((s) => s.trim()) : [];

        return {
          agency: {
            id: agency.id,
            name: agency.name,
            status: agency.status,
          },
          activationLimit: limit,
          activationUsed: used,
          activationsLeft: Math.max(0, limit - used),
          allowedPackages: allowed,
          subscription: {
            status: sub?.status || 'inactive',
            startsAt: sub?.startsAt || null,
            expiresAt: sub?.expiresAt || null,
          },
        };
      })
      .get('/users', async ({ agency }) => {
        const usersList = await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            phoneNumber: schema.users.phoneNumber,
            suspendedAt: schema.users.suspendedAt,
            createdAt: schema.users.createdAt,
          })
          .from(schema.users)
          .where(eq(schema.users.agencyId, agency.id))
          .orderBy(desc(schema.users.createdAt));

        return Promise.all(
          usersList.map(async (u) => {
            const [sub] = await db
              .select()
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.userId, u.id))
              .orderBy(desc(schema.subscriptions.createdAt))
              .limit(1);

            let pkgName: string | null = null;
            let maxDevice = 1;
            if (sub?.packageId) {
              const [pkg] = await db
                .select({ name: schema.packages.name, maxDevice: schema.packages.maxDevice })
                .from(schema.packages)
                .where(eq(schema.packages.id, sub.packageId))
                .limit(1);
              if (pkg) {
                pkgName = pkg.name;
                maxDevice = pkg.maxDevice;
              }
            }

            const [devCount] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.devices)
              .where(eq(schema.devices.userId, u.id));

            return {
              id: u.id,
              name: u.name,
              email: u.email,
              phoneNumber: u.phoneNumber,
              suspended: Boolean(u.suspendedAt),
              package: pkgName,
              maxDevice,
              deviceCount: devCount?.count || 0,
              subscriptionStatus: sub?.status || 'inactive',
              subscriptionEnd: sub?.endDate || null,
              createdAt: u.createdAt,
            };
          }),
        );
      })
      .post(
        '/users',
        async ({ agency, body, set }) => {
          const [sub] = await db
            .select()
            .from(schema.agencySubscriptions)
            .where(eq(schema.agencySubscriptions.agencyId, agency.id))
            .orderBy(desc(schema.agencySubscriptions.createdAt))
            .limit(1);

          if (!sub || sub.status !== 'active') {
            set.status = 400;
            return { error: 'Agency belum memiliki paket subscription aktif' };
          }

          const limit = sub.activationLimit || sub.deviceQuota || 0;
          if (limit > 0 && sub.activationUsed >= limit) {
            set.status = 400;
            return { error: `Batas kuota aktivasi pengguna (${limit}) telah habis` };
          }

          const normalizedEmail = body.email.toLowerCase().trim();
          const [existing] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, normalizedEmail))
            .limit(1);

          if (existing) {
            set.status = 400;
            return { error: 'Email sudah terdaftar di sistem' };
          }

          // Validate package
          const [pkg] = await db
            .select()
            .from(schema.packages)
            .where(eq(schema.packages.id, body.packageId))
            .limit(1);

          if (!pkg) {
            set.status = 404;
            return { error: 'Paket tidak ditemukan' };
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

          const now = new Date();
          const days = body.durationDays || pkg.durationDays || 30;
          const endDate = new Date(now.getTime() + days * 86400000);

          const [newSub] = await db
            .insert(schema.subscriptions)
            .values({
              userId: newUser.id,
              packageId: pkg.id,
              status: 'active',
              startDate: now,
              endDate,
              messagesUsed: 0,
            })
            .returning();

          await db
            .update(schema.agencySubscriptions)
            .set({ activationUsed: sql`${schema.agencySubscriptions.activationUsed} + 1` })
            .where(eq(schema.agencySubscriptions.id, sub.id));

          sendWelcomeNotification(newUser, body.password).catch(() => {});

          return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            package: pkg.name,
            maxDevice: pkg.maxDevice,
            subscriptionEnd: newSub.endDate,
          };
        },
        {
          body: t.Object({
            name: t.String({ minLength: 2 }),
            email: t.String({ format: 'email' }),
            password: t.String({ minLength: 6 }),
            packageId: t.String(),
            phoneNumber: t.Optional(t.String()),
            durationDays: t.Optional(t.Number()),
          }),
        },
      ),
  )
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
