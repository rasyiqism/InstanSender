import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { config } from '../config';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { findApiKey } from './auth';

export const authContext = new Elysia({ name: 'authContext' })
  .use(
    jwt({
      name: 'jwt',
      secret: config.jwtSecret,
      exp: config.jwtExpiresIn,
    }),
  )
  .use(bearer())
  .derive({ as: 'scoped' }, ({ jwt, bearer, set, headers }) => ({
    getAuthUser: async () => {
      const token = bearer || headers['authorization']?.replace(/^Bearer\s+/i, '');
      if (!token) {
        set.status = 401;
        throw new Error('Unauthorized: missing authentication token');
      }

      const payload = await jwt.verify(token);
      if (!payload || typeof payload !== 'object' || !payload.sub) {
        set.status = 401;
        throw new Error('Unauthorized: token invalid or expired');
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub as string))
        .limit(1);

      if (!user) {
        set.status = 401;
        throw new Error('Unauthorized: user no longer exists');
      }

      if (user.suspendedAt) {
        set.status = 403;
        throw new Error('Account has been suspended');
      }

      return user;
    },

    getAdminUser: async () => {
      const token = bearer || headers['authorization']?.replace(/^Bearer\s+/i, '');
      if (!token) {
        set.status = 401;
        throw new Error('Unauthorized: missing authentication token');
      }

      const payload = await jwt.verify(token);
      if (!payload || typeof payload !== 'object' || !payload.sub) {
        set.status = 401;
        throw new Error('Unauthorized: token invalid or expired');
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub as string))
        .limit(1);

      if (!user || user.role !== 'admin') {
        set.status = 403;
        throw new Error('Forbidden: admin access required');
      }

      return user;
    },

    getAgencyUser: async () => {
      const token = bearer || headers['authorization']?.replace(/^Bearer\s+/i, '');
      if (!token) {
        set.status = 401;
        throw new Error('Unauthorized: missing authentication token');
      }

      const payload = await jwt.verify(token);
      if (!payload || typeof payload !== 'object' || !payload.sub) {
        set.status = 401;
        throw new Error('Unauthorized: token invalid or expired');
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub as string))
        .limit(1);

      if (!user || (user.role !== 'agency' && user.role !== 'admin')) {
        set.status = 403;
        throw new Error('Forbidden: agency access required');
      }

      return user;
    },

    validateApiKeyAuth: async () => {
      const token = bearer || headers['authorization']?.replace(/^Bearer\s+/i, '');
      if (!token) {
        set.status = 401;
        throw new Error('Unauthorized: missing API key');
      }

      const keyRecord = await findApiKey(token);
      if (!keyRecord) {
        set.status = 401;
        throw new Error('Unauthorized: invalid API key');
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, keyRecord.userId))
        .limit(1);

      if (!user || user.suspendedAt) {
        set.status = 401;
        throw new Error('Unauthorized: account inactive or suspended');
      }

      return { keyRecord, user };
    },
  }));
