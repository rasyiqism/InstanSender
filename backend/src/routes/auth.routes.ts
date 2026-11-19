import { Elysia, t } from 'elysia';
import crypto from 'node:crypto';
import { db, schema } from '../db';
import { eq, and, gt } from 'drizzle-orm';
import { hashPassword, verifyPassword, hashToken } from '../common/auth';
import { authContext } from '../common/middleware';
import { sendPasswordResetEmail } from '../common/mailer';
import { config } from '../config';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authContext)
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const { email, password } = body;
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) {
        set.status = 401;
        return { message: 'Email atau password salah' };
      }

      if (user.suspendedAt) {
        set.status = 403;
        return { message: 'Akun Anda sedang disuspend. Hubungi administrator.' };
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        set.status = 401;
        return { message: 'Email atau password salah' };
      }

      const accessToken = await jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const { passwordHash, passwordResetTokenHash, ...safeUser } = user;
      return {
        accessToken,
        user: safeUser,
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
    },
  )
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      const { name, email, password, phoneNumber } = body;
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
          phoneNumber: phoneNumber || null,
          passwordHash: passHash,
          role: 'user',
        })
        .returning();

      const accessToken = await jwt.sign({
        sub: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      const { passwordHash: _, ...safeUser } = newUser;
      return {
        accessToken,
        user: safeUser,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        phoneNumber: t.Optional(t.String()),
      }),
    },
  )
  .post(
    '/register-agency',
    async ({ body, jwt, set }) => {
      const { name, email, password, phoneNumber, agencyName, packageId } = body;
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
          phoneNumber: phoneNumber || null,
          passwordHash: passHash,
          role: 'agency',
        })
        .returning();

      const [newAgency] = await db
        .insert(schema.agencies)
        .values({
          ownerUserId: newUser.id,
          name: agencyName || name,
          status: 'trial',
        })
        .returning();

      // If agency package selected, initialize subscription
      if (packageId) {
        const [pkg] = await db
          .select()
          .from(schema.agencyPackages)
          .where(eq(schema.agencyPackages.id, packageId))
          .limit(1);

        if (pkg) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + (pkg.durationDays || 30) * 86400000);
          await db.insert(schema.agencySubscriptions).values({
            agencyId: newAgency.id,
            packageId: pkg.id,
            deviceQuota: pkg.deviceQuota,
            activationLimit: pkg.activationLimit,
            allowedPackages: pkg.allowedPackages,
            startsAt: now,
            expiresAt,
            status: 'trial',
          });
        }
      }

      const accessToken = await jwt.sign({
        sub: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      const { passwordHash: _, ...safeUser } = newUser;
      return {
        accessToken,
        user: safeUser,
        agency: newAgency,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        phoneNumber: t.Optional(t.String()),
        agencyName: t.Optional(t.String()),
        packageId: t.Optional(t.String()),
      }),
    },
  )
  .get('/me', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    const { passwordHash, passwordResetTokenHash, ...safeUser } = user;
    return safeUser;
  })
  .put(
    '/profile',
    async ({ body, getAuthUser }) => {
      const user = await getAuthUser();
      const [updated] = await db
        .update(schema.users)
        .set({
          name: body.name ?? user.name,
          phoneNumber: body.phoneNumber !== undefined ? body.phoneNumber : user.phoneNumber,
        })
        .where(eq(schema.users.id, user.id))
        .returning();

      const { passwordHash, passwordResetTokenHash, ...safeUser } = updated;
      return safeUser;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        phoneNumber: t.Optional(t.String()),
      }),
    },
  )
  .put(
    '/password',
    async ({ body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const isValid = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!isValid) {
        set.status = 400;
        return { message: 'Password saat ini salah' };
      }

      const newHash = await hashPassword(body.newPassword);
      await db
        .update(schema.users)
        .set({ passwordHash: newHash })
        .where(eq(schema.users.id, user.id));

      return { success: true, message: 'Password berhasil diperbarui' };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String({ minLength: 6 }),
      }),
    },
  )
  .post(
    '/forgot-password',
    async ({ body }) => {
      const { email } = body;
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase().trim()))
        .limit(1);

      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await db
          .update(schema.users)
          .set({
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
          })
          .where(eq(schema.users.id, user.id));

        const resetUrl = `${config.appUrl.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;
        await sendPasswordResetEmail(user.email, resetUrl);
      }

      // Always return success to prevent email enumeration
      return { success: true, message: 'Jika email terdaftar, link reset telah dikirimkan.' };
    },
    {
      body: t.Object({
        email: t.String(),
      }),
    },
  )
  .post(
    '/reset-password',
    async ({ body, set }) => {
      const { token, newPassword } = body;
      const tokenHash = hashToken(token);

      const [user] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.passwordResetTokenHash, tokenHash),
            gt(schema.users.passwordResetExpiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!user) {
        set.status = 400;
        return { message: 'Token reset password tidak valid atau sudah kedaluwarsa' };
      }

      const passHash = await hashPassword(newPassword);
      await db
        .update(schema.users)
        .set({
          passwordHash: passHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        })
        .where(eq(schema.users.id, user.id));

      return { success: true, message: 'Password berhasil diubah. Silakan login kembali.' };
    },
    {
      body: t.Object({
        token: t.String(),
        newPassword: t.String({ minLength: 6 }),
      }),
    },
  );
