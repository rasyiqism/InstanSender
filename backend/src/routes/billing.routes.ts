import { Elysia, t } from 'elysia';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authContext } from '../common/middleware';
import { config } from '../config';
import { sendOrderCreatedNotification } from '../common/notifications';

async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

async function getBankAccounts() {
  const raw = await getSetting('BANK_ACCOUNTS_JSON', '');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const bankName = await getSetting('BANK_NAME', config.bank.name);
  const bankAcc = await getSetting('BANK_ACCOUNT_NUMBER', config.bank.accountNumber);
  const bankHolder = await getSetting('BANK_ACCOUNT_HOLDER', config.bank.accountHolder);
  return [{ bankName, accountNumber: bankAcc, accountHolder: bankHolder, label: bankName }];
}

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
  // 3. Create order (Retail or Agency)
  .post(
    '/billing/orders',
    async ({ body, getAuthUser, set }) => {
      const user = await getAuthUser();

      const [existingPending] = await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(and(eq(schema.payments.userId, user.id), eq(schema.payments.status, 'pending')))
        .limit(1);

      if (existingPending) {
        set.status = 400;
        return {
          message: 'Anda masih memiliki tagihan yang menunggu pembayaran. Selesaikan pembayaran atau tunggu verifikasi admin.',
          orderId: existingPending.id,
        };
      }

      const isAgencyOrder = body.packageType === 'agency';

      if (isAgencyOrder) {
        const [agencyPkg] = await db
          .select()
          .from(schema.agencyPackages)
          .where(and(eq(schema.agencyPackages.id, body.packageId), eq(schema.agencyPackages.active, true)))
          .limit(1);

        if (!agencyPkg) {
          set.status = 404;
          return { message: 'Paket agency tidak ditemukan' };
        }

        const [agency] = await db
          .select()
          .from(schema.agencies)
          .where(eq(schema.agencies.ownerUserId, user.id))
          .limit(1);

        if (!agency) {
          set.status = 400;
          return { message: 'Akun Anda bukan pemilik agency' };
        }

        const kodeUnik = Math.floor(100 + Math.random() * 900);
        const totalAmount = Number(agencyPkg.price) + kodeUnik;

        const bankAccounts = await getBankAccounts();
        const bankInfo = bankAccounts.map((b: any) => `${b.bankName} ${b.accountNumber} a.n ${b.accountHolder}`).join(' | ');

        const { agencySub, payment } = await db.transaction(async (tx) => {
          const [agencySub] = await tx
            .insert(schema.agencySubscriptions)
            .values({
              agencyId: agency.id,
              packageId: agencyPkg.id,
              deviceQuota: agencyPkg.deviceQuota,
              activationLimit: agencyPkg.activationLimit,
              allowedPackages: agencyPkg.allowedPackages,
              status: 'pending' as any,
            })
            .returning();

          const [payment] = await tx
            .insert(schema.payments)
            .values({
              userId: user.id,
              agencySubscriptionId: agencySub.id,
              amount: totalAmount,
              kodeUnik,
              bankAccountTujuan: bankInfo,
              status: 'pending',
            })
            .returning();

          return { agencySub, payment };
        });

        sendOrderCreatedNotification(user, {
          orderId: payment.id,
          packageName: agencyPkg.name,
          amount: totalAmount,
          kodeUnik,
          bankAccounts,
        }).catch(() => {});

        return {
          orderId: payment.id,
          payment,
          subscription: agencySub,
          package: agencyPkg,
          transferInstruction: {
            bankAccount: bankInfo,
            bankAccounts,
            amount: totalAmount,
            note: `Transfer tepat sebesar nominal di atas (termasuk kode unik ${kodeUnik}) agar verifikasi cepat.`,
          },
          instructions: {
            bankName: bankAccounts[0]?.bankName || config.bank.name,
            accountNumber: bankAccounts[0]?.accountNumber || config.bank.accountNumber,
            accountHolder: bankAccounts[0]?.accountHolder || config.bank.accountHolder,
            nominalAsli: Number(agencyPkg.price),
            kodeUnik,
            totalTransfer: totalAmount,
          },
        };
      }

      // Retail Package Order
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

      const bankAccounts = await getBankAccounts();
      const bankInfo = bankAccounts.map((b: any) => `${b.bankName} ${b.accountNumber} a.n ${b.accountHolder}`).join(' | ');

      const { sub, payment } = await db.transaction(async (tx) => {
        const [sub] = await tx
          .insert(schema.subscriptions)
          .values({
            userId: user.id,
            packageId: pkg.id,
            status: 'pending',
          })
          .returning();

        const [payment] = await tx
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

        return { sub, payment };
      });

      sendOrderCreatedNotification(user, {
        orderId: payment.id,
        packageName: pkg.name,
        amount: totalAmount,
        kodeUnik,
        bankAccounts,
      }).catch(() => {});

      return {
        orderId: payment.id,
        payment,
        subscription: sub,
        package: pkg,
        transferInstruction: {
          bankAccount: bankInfo,
          bankAccounts,
          amount: totalAmount,
          note: `Transfer tepat sebesar nominal di atas (termasuk kode unik ${kodeUnik}) agar verifikasi cepat.`,
        },
        instructions: {
          bankName: bankAccounts[0]?.bankName || config.bank.name,
          accountNumber: bankAccounts[0]?.accountNumber || config.bank.accountNumber,
          accountHolder: bankAccounts[0]?.accountHolder || config.bank.accountHolder,
          nominalAsli: pkg.price,
          kodeUnik,
          totalTransfer: totalAmount,
        },
      };
    },
    {
      body: t.Object({
        packageId: t.String(),
        packageType: t.Optional(t.Union([t.Literal('user'), t.Literal('agency')])),
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
