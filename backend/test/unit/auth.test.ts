import { describe, it, expect } from 'bun:test';
import { hashPassword, verifyPassword, hashToken, generateApiKey } from '../../src/common/auth';

describe('Auth Utilities (Unit)', () => {
  it('hashes password and verifies successfully with correct password', async () => {
    const raw = 'secretP@ssword123';
    const hash = await hashPassword(raw);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$2')).toBeTrue(); // standard bcrypt prefix

    const isValid = await verifyPassword(raw, hash);
    expect(isValid).toBeTrue();
  });

  it('fails verification with wrong password', async () => {
    const raw = 'secretP@ssword123';
    const hash = await hashPassword(raw);

    const isValid = await verifyPassword('wrong-password', hash);
    expect(isValid).toBeFalse();
  });

  it('generates consistent sha256 token hash', () => {
    const token = 'sample-token-abc-123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string length
  });

  it('generates valid API key structure with prefix and hash', () => {
    const apiKey = generateApiKey();

    expect(apiKey.key.startsWith('nwa_')).toBeTrue();
    expect(apiKey.prefix).toBe(apiKey.key.slice(0, 8));
    expect(apiKey.hash).toBe(hashToken(apiKey.key));
  });

  it('exposes both /auth/me and /auth/profile routes for backward compatibility', async () => {
    const { authRoutes } = await import('../../src/routes/auth.routes');
    const paths = authRoutes.routes.map((r: any) => `${r.method} ${r.path}`);

    expect(paths).toContain('GET /auth/me');
    expect(paths).toContain('GET /auth/profile');
  });
});
