import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { hashPassword } from '../common/auth';

function formatAgencyPackage(pkg: typeof schema.agencyPackages.$inferSelect) {
  return {
    ...pkg,
    allowedPackages: pkg.allowedPackages
      ? pkg.allowedPackages.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    features: pkg.features
      ? pkg.features.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authContext)
  // 1. Users Management
  .get('/users', async ({ getAdminUser }) => {
    await getAdminUser();
    return db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phoneNumber: schema.users.phoneNumber,
        role: schema.users.role,
        agencyId: schema.users.agencyId,
        suspendedAt: schema.users.suspendedAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt));
  })
  .post(
    '/users',
    async ({ body, getAdminUser, set }) => {
      await getAdminUser();
      const normalizedEmail = body.email.toLowerCase().trim();

      const [existing] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizedEmail))
        .limit(1);

      if (existing) {
        set.status = 400;
        return { message: 'Email sudah terdaftar' };
      }

      const passHash = await hashPassword(body.password);
      const [newUser] = await db
        .insert(schema.users)
        .values({
          name: body.name,
          email: normalizedEmail,
          phoneNumber: body.phoneNumber || null,
          passwordHash: passHash,
          role: (body.role as any) || 'user',
        })
        .returning();

      const { passwordHash: _, ...safeUser } = newUser;
      return safeUser;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        phoneNumber: t.Optional(t.String()),
        role: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    '/users/:id',
    async ({ params, body, getAdminUser, set }) => {
      await getAdminUser();
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.email !== undefined) updates.email = body.email.toLowerCase().trim();
      if (body.phoneNumber !== undefined) updates.phoneNumber = body.phoneNumber;
      if (body.role !== undefined) updates.role = body.role;
      if (body.suspended !== undefined) {
        updates.suspendedAt = body.suspended ? new Date() : null;
      }
      if (body.password) {
        updates.passwordHash = await hashPassword(body.password);
      }

      const [updated] = await db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { message: 'User tidak ditemukan' };
      }

      const { passwordHash: _, ...safeUser } = updated;
      return safeUser;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phoneNumber: t.Optional(t.String()),
        role: t.Optional(t.String()),
        suspended: t.Optional(t.Boolean()),
        password: t.Optional(t.String()),
      }),
    },
  )
  .delete('/users/:id', async ({ params, getAdminUser, set }) => {
    await getAdminUser();
    await db.delete(schema.users).where(eq(schema.users.id, params.id));
    return { success: true };
  })

  // 2. Payments & Verifications
  .get('/payments', async ({ getAdminUser }) => {
    await getAdminUser();
    const paymentsList = await db
      .select({
        id: schema.payments.id,
        userId: schema.payments.userId,
        subscriptionId: schema.payments.subscriptionId,
        amount: schema.payments.amount,
        kodeUnik: schema.payments.kodeUnik,
        bankAccountTujuan: schema.payments.bankAccountTujuan,
        buktiTransferUrl: schema.payments.buktiTransferUrl,
        status: schema.payments.status,
        rejectionReason: schema.payments.rejectionReason,
        verifiedBy: schema.payments.verifiedBy,
        verifiedAt: schema.payments.verifiedAt,
        createdAt: schema.payments.createdAt,
        userEmail: schema.users.email,
        userName: schema.users.name,
      })
      .from(schema.payments)
      .leftJoin(schema.users, eq(schema.users.id, schema.payments.userId))
      .orderBy(desc(schema.payments.createdAt));

    return paymentsList;
  })
  .post('/payments/:id/approve', async ({ params, getAdminUser, set }) => {
    const admin = await getAdminUser();
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, params.id))
      .limit(1);

    if (!payment) {
      set.status = 404;
      return { message: 'Pembayaran tidak ditemukan' };
    }

    const now = new Date();
    await db
      .update(schema.payments)
      .set({
        status: 'paid',
        verifiedBy: admin.email,
        verifiedAt: now,
      })
      .where(eq(schema.payments.id, params.id));

    // Activate subscription if attached
    if (payment.subscriptionId) {
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, payment.subscriptionId))
        .limit(1);

      if (sub) {
        const [pkg] = await db
          .select()
          .from(schema.packages)
          .where(eq(schema.packages.id, sub.packageId))
          .limit(1);

        const duration = pkg?.durationDays || 30;
        const endDate = new Date(now.getTime() + duration * 86400000);

        await db
          .update(schema.subscriptions)
          .set({
            status: 'active',
            startDate: now,
            endDate,
          })
          .where(eq(schema.subscriptions.id, sub.id));
      }
    }

    return { success: true, message: 'Pembayaran berhasil disetujui' };
  })
  .post(
    '/payments/:id/reject',
    async ({ params, body, getAdminUser, set }) => {
      const admin = await getAdminUser();
      const [payment] = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, params.id))
        .limit(1);

      if (!payment) {
        set.status = 404;
        return { message: 'Pembayaran tidak ditemukan' };
      }

      await db
        .update(schema.payments)
        .set({
          status: 'rejected',
          rejectionReason: (body as any)?.reason || 'Bukti transfer tidak valid',
          verifiedBy: admin.email,
          verifiedAt: new Date(),
        })
        .where(eq(schema.payments.id, params.id));

      return { success: true, message: 'Pembayaran ditolak' };
    },
    {
      body: t.Optional(
        t.Object({
          reason: t.Optional(t.String()),
        }),
      ),
    },
  )
  .delete('/payments/:id', async ({ params, getAdminUser }) => {
    await getAdminUser();
    await db.delete(schema.payments).where(eq(schema.payments.id, params.id));
    return { success: true };
  })

  // 3. Retail Packages Management
  .get('/packages', async ({ getAdminUser }) => {
    await getAdminUser();
    return db.select().from(schema.packages).orderBy(schema.packages.price);
  })
  .post(
    '/packages',
    async ({ body, getAdminUser }) => {
      await getAdminUser();
      const [pkg] = await db
        .insert(schema.packages)
        .values({
          name: body.name,
          maxDevice: body.maxDevice,
          messageQuota: body.messageQuota ?? null,
          price: Number(body.price),
          rateLimitPerSecond: body.rateLimitPerSecond ?? 10,
          durationDays: body.durationDays ?? 30,
          active: body.active !== undefined ? body.active : true,
        })
        .returning();
      return pkg;
    },
    {
      body: t.Object({
        name: t.String(),
        maxDevice: t.Number(),
        messageQuota: t.Optional(t.Nullable(t.Number())),
        price: t.Union([t.String(), t.Number()]),
        rateLimitPerSecond: t.Optional(t.Number()),
        durationDays: t.Optional(t.Number()),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    '/packages/:id',
    async ({ params, body, getAdminUser, set }) => {
      await getAdminUser();
      const [updated] = await db
        .update(schema.packages)
        .set({
          name: body.name,
          maxDevice: body.maxDevice,
          messageQuota: body.messageQuota,
          price: body.price !== undefined ? Number(body.price) : undefined,
          rateLimitPerSecond: body.rateLimitPerSecond,
          durationDays: body.durationDays,
          active: body.active,
        })
        .where(eq(schema.packages.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { message: 'Paket tidak ditemukan' };
      }
      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        maxDevice: t.Optional(t.Number()),
        messageQuota: t.Optional(t.Nullable(t.Number())),
        price: t.Optional(t.Union([t.String(), t.Number()])),
        rateLimitPerSecond: t.Optional(t.Number()),
        durationDays: t.Optional(t.Number()),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete('/packages/:id', async ({ params, getAdminUser }) => {
    await getAdminUser();
    await db.delete(schema.packages).where(eq(schema.packages.id, params.id));
    return { success: true };
  })

  // 4. Agency Packages Management
  .get('/agency-packages', async ({ getAdminUser }) => {
    await getAdminUser();
    const list = await db.select().from(schema.agencyPackages).orderBy(schema.agencyPackages.price);
    return list.map(formatAgencyPackage);
  })
  .post(
    '/agency-packages',
    async ({ body, getAdminUser }) => {
      await getAdminUser();
      const [pkg] = await db
        .insert(schema.agencyPackages)
        .values({
          name: body.name,
          activationLimit: body.activationLimit || 0,
          deviceQuota: body.deviceQuota || 0,
          allowedPackages: Array.isArray(body.allowedPackages)
            ? body.allowedPackages.join(',')
            : body.allowedPackages || null,
          durationDays: body.durationDays || 30,
          price: Number(body.price),
          features: Array.isArray(body.features)
            ? body.features.join(',')
            : body.features || null,
          status: 'active',
          active: body.active !== undefined ? body.active : true,
        })
        .returning();
      return formatAgencyPackage(pkg);
    },
    {
      body: t.Object({
        name: t.String(),
        price: t.Union([t.String(), t.Number()]),
        activationLimit: t.Optional(t.Number()),
        deviceQuota: t.Optional(t.Number()),
        allowedPackages: t.Optional(t.Any()),
        durationDays: t.Optional(t.Number()),
        features: t.Optional(t.Any()),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    '/agency-packages/:id',
    async ({ params, body, getAdminUser, set }) => {
      await getAdminUser();
      const [updated] = await db
        .update(schema.agencyPackages)
        .set({
          name: body.name,
          price: body.price !== undefined ? Number(body.price) : undefined,
          activationLimit: body.activationLimit,
          deviceQuota: body.deviceQuota,
          allowedPackages: Array.isArray(body.allowedPackages)
            ? body.allowedPackages.join(',')
            : body.allowedPackages,
          durationDays: body.durationDays,
          features: Array.isArray(body.features)
            ? body.features.join(',')
            : body.features,
          active: body.active,
        })
        .where(eq(schema.agencyPackages.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { message: 'Paket agency tidak ditemukan' };
      }
      return formatAgencyPackage(updated);
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        price: t.Optional(t.Union([t.String(), t.Number()])),
        activationLimit: t.Optional(t.Number()),
        deviceQuota: t.Optional(t.Number()),
        allowedPackages: t.Optional(t.Any()),
        durationDays: t.Optional(t.Number()),
        features: t.Optional(t.Any()),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete('/agency-packages/:id', async ({ params, getAdminUser }) => {
    await getAdminUser();
    await db.delete(schema.agencyPackages).where(eq(schema.agencyPackages.id, params.id));
    return { success: true };
  })

  // 5. Agencies Management
  .get('/agencies', async ({ getAdminUser }) => {
    await getAdminUser();
    const rows = await db
      .select({
        id: schema.agencies.id,
        ownerUserId: schema.agencies.ownerUserId,
        name: schema.agencies.name,
        status: schema.agencies.status,
        createdAt: schema.agencies.createdAt,
        ownerEmail: schema.users.email,
        ownerName: schema.users.name,
      })
      .from(schema.agencies)
      .leftJoin(schema.users, eq(schema.users.id, schema.agencies.ownerUserId))
      .orderBy(desc(schema.agencies.createdAt));

    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      createdAt: a.createdAt,
      ownerUserId: a.ownerUserId,
      owner: a.ownerUserId
        ? {
            id: a.ownerUserId,
            email: a.ownerEmail,
            name: a.ownerName,
          }
        : null,
    }));
  })
  .post('/agencies/:id/activate', async ({ params, getAdminUser }) => {
    await getAdminUser();
    await db.update(schema.agencies).set({ status: 'active' }).where(eq(schema.agencies.id, params.id));
    return { success: true };
  })
  .post('/agencies/:id/suspend', async ({ params, getAdminUser }) => {
    await getAdminUser();
    await db.update(schema.agencies).set({ status: 'suspended' }).where(eq(schema.agencies.id, params.id));
    return { success: true };
  })

  // 6. Settings Management
  .get('/settings', async ({ getAdminUser }) => {
    await getAdminUser();
    return db.select().from(schema.settings).orderBy(schema.settings.key);
  })
  .patch(
    '/settings',
    async ({ body, getAdminUser }) => {
      await getAdminUser();
      const items = (body as any).items as Array<{ key: string; value: string; description?: string }>;
      if (items && Array.isArray(items)) {
        for (const item of items) {
          const [exists] = await db
            .select()
            .from(schema.settings)
            .where(eq(schema.settings.key, item.key))
            .limit(1);

          if (exists) {
            await db
              .update(schema.settings)
              .set({
                value: item.value,
                description: item.description ?? exists.description,
                updatedAt: new Date(),
              })
              .where(eq(schema.settings.key, item.key));
          } else {
            await db.insert(schema.settings).values({
              key: item.key,
              value: item.value,
              description: item.description,
            });
          }
        }
      }
      return db.select().from(schema.settings).orderBy(schema.settings.key);
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            key: t.String(),
            value: t.String(),
            description: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )

  // 7. Global Devices Audit
  .get('/devices', async ({ getAdminUser }) => {
    await getAdminUser();
    return db
      .select({
        id: schema.devices.id,
        name: schema.devices.name,
        phoneNumber: schema.devices.phoneNumber,
        status: schema.devices.status,
        lastSeenAt: schema.devices.lastSeenAt,
        createdAt: schema.devices.createdAt,
        userId: schema.devices.userId,
        userEmail: schema.users.email,
        userName: schema.users.name,
      })
      .from(schema.devices)
      .leftJoin(schema.users, eq(schema.users.id, schema.devices.userId))
      .orderBy(desc(schema.devices.createdAt));
  });
