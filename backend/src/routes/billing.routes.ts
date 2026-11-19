import { Elysia, t } from 'elysia';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { config } from '../config';

export const billingRoutes = new Elysia()
  .use(authContext)
  // 1. List retail packages
  .get('/packages', async () => {
    return db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.active, true))
      .orderBy(schema.packages.price);
  })
  .get('/user-packages', async () => {
    return db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.active, true))
      .orderBy(schema.packages.price);
  })
  // 2. List agency packages
  .get('/agency-packages', async () => {
    const list = await db
      .select()
      .from(schema.agencyPackages)
      .where(eq(schema.agencyPackages.active, true))
      .orderBy(schema.agencyPackages.price);

    return list.map((pkg) => ({
      ...pkg,
      allowedPackages: pkg.allowedPackages
        ? pkg.allowedPackages.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      features: pkg.features
        ? pkg.features.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    }));
  })
  // 3. Create order
  .post(
    '/billing/orders',
    async ({ body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const [pkg] = await db
        .select()
        .from(schema.packages)
        .where(and(eq(schema.packages.id, body.packageId), eq(schema.packages.active, true)))
        .limit(1);

      if (!pkg) {
        set.status = 404;
        return { message: 'Paket tidak ditemukan' };
      }

      // Generate 3 digit unique code
      const kodeUnik = Math.floor(100 + Math.random() * 900);
      const totalAmount = pkg.price + kodeUnik;

      // Get destination bank from settings/config
      const bankInfo = `${config.bank.name} ${config.bank.accountNumber} a.n ${config.bank.accountHolder}`;

      // Create subscription in pending state
      const [sub] = await db
        .insert(schema.subscriptions)
        .values({
          userId: user.id,
          packageId: pkg.id,
          status: 'pending',
        })
        .returning();

      // Create payment
      const [payment] = await db
        .insert(schema.payments)
        .values({
          userId: user.id,
          subscriptionId: sub.id,
          amount: totalAmount,
          kodeUnik,
          bankAccountTujuan: bankInfo,
          status: 'pending',
        })
        .returning();

      return {
        payment,
        subscription: sub,
        package: pkg,
        instructions: {
          bankName: config.bank.name,
          accountNumber: config.bank.accountNumber,
          accountHolder: config.bank.accountHolder,
          nominalAsli: pkg.price,
          kodeUnik,
          totalTransfer: totalAmount,
        },
      };
    },
    {
      body: t.Object({
        packageId: t.String(),
      }),
    },
  )
  // 4. Upload payment proof
  .post(
    '/billing/orders/:orderId/proof',
    async ({ params, body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const file = body.file as File;

      if (!file) {
        set.status = 400;
        return { message: 'File bukti transfer wajib diunggah' };
      }

      const [payment] = await db
        .select()
        .from(schema.payments)
        .where(
          and(
            eq(schema.payments.id, params.orderId),
            eq(schema.payments.userId, user.id),
          ),
        )
        .limit(1);

      if (!payment) {
        set.status = 404;
        return { message: 'Order pembayaran tidak ditemukan' };
      }

      // Ensure upload directory exists
      await fs.mkdir(config.uploadDir, { recursive: true });

      const ext = path.extname(file.name) || '.jpg';
      const filename = `proof_${payment.id}_${Date.now()}${ext}`;
      const filePath = path.join(config.uploadDir, filename);

      const buffer = await file.arrayBuffer();
      await Bun.write(filePath, buffer);

      const fileUrl = `/uploads/${filename}`;
      const [updated] = await db
        .update(schema.payments)
        .set({
          buktiTransferUrl: fileUrl,
        })
        .where(eq(schema.payments.id, payment.id))
        .returning();

      return updated;
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    },
  )
  // 5. List user payments
  .get('/billing/payments', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    return db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.userId, user.id))
      .orderBy(desc(schema.payments.createdAt));
  })
  // 6. Get active subscription
  .get('/billing/subscription', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, user.id),
          eq(schema.subscriptions.status, 'active'),
        ),
      )
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(1);

    if (!sub) return null;

    const [pkg] = await db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.id, sub.packageId))
      .limit(1);

    return {
      ...sub,
      package: pkg,
    };
  });
