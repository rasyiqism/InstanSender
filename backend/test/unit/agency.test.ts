import { describe, it, expect } from 'bun:test';

describe('Agency Quota Calculations (Unit)', () => {
  it('correctly calculates activations left', () => {
    const activationLimit = 10;
    const activationUsed = 4;
    const activationsLeft = Math.max(0, activationLimit - activationUsed);

    expect(activationsLeft).toBe(6);
  });

  it('clamps activations left to 0 when limit exceeded', () => {
    const activationLimit = 5;
    const activationUsed = 7;
    const activationsLeft = Math.max(0, activationLimit - activationUsed);

    expect(activationsLeft).toBe(0);
  });

  it('filters allowed packages correctly', () => {
    const allPackages = [
      { id: 'pkg-1', name: 'Starter' },
      { id: 'pkg-2', name: 'Pro' },
      { id: 'pkg-3', name: 'Enterprise' },
    ];
    const allowedPackages = 'Starter, pkg-2';
    const allowed = allowedPackages.split(',').map((s) => s.trim().toLowerCase());

    const filtered = allPackages.filter(
      (p) => allowed.includes(p.id.toLowerCase()) || allowed.includes(p.name.toLowerCase()),
    );

    expect(filtered.length).toBe(2);
    expect(filtered.map((p) => p.name)).toEqual(['Starter', 'Pro']);
  });

  it('verifies agency reseller v1 routes have correct path prefix', async () => {
    const { agencyRoutes } = await import('../../src/routes/agency.routes');
    const paths = agencyRoutes.routes.map((r: any) => `${r.method} ${r.path}`);

    expect(paths).toContain('GET /agency/v1/packages');
    expect(paths).toContain('GET /agency/v1/quota');
    expect(paths).toContain('GET /agency/v1/users');
    expect(paths).toContain('POST /agency/v1/users');
    // Ensure no double-prefix bug
    expect(paths.some((p: string) => p.includes('/agency/agency'))).toBeFalse();
  });
});
