import crypto from 'node:crypto';
import { db, schema } from '../db';
import { eq, and, isNull } from 'drizzle-orm';

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  const key = `nwa_${randomBytes}`;
  const prefix = key.slice(0, 8);
  const hash = hashToken(key);
  return { key, prefix, hash };
}

export async function findApiKey(key: string) {
  const hash = hashToken(key);
  const [apiKey] = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, hash), isNull(schema.apiKeys.revokedAt)))
    .limit(1);
  return apiKey || null;
}
