import { describe, it, expect, beforeAll } from 'bun:test';
import { request } from './test-client';

describe('Billing Flow (E2E)', () => {
  let userToken = '';
  let packageId = '';

  beforeAll(async () => {
    // 1. Register test user
    const userEmail = `billing-user-${Date.now()}@test.id`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Billing Tester',
        email: userEmail,
        password: 'Password123!',
      },
    });
    expect(regRes.status).toBe(200);
    userToken = regRes.body.accessToken;

    // 2. Fetch packages to get an active package ID
    const pkgRes = await request('/packages');
    expect(pkgRes.status).toBe(200);
    expect(pkgRes.body.length).toBeGreaterThan(0);
    packageId = pkgRes.body[0].id;
  });

  it('lists public retail packages without authentication', async () => {
    const res = await request('/packages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toBeDefined();
    expect(res.body[0].price).toBeDefined();
  });

  it('lists public agency packages without authentication', async () => {
    const res = await request('/agency-packages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();
    if (res.body.length > 0) {
      expect(Array.isArray(res.body[0].allowedPackages)).toBeTrue();
      expect(Array.isArray(res.body[0].features)).toBeTrue();
    }
  });

  it('creates an order and returns payment instruction with unique code', async () => {
    const res = await request('/billing/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      body: {
        packageId,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.payment).toBeDefined();
    expect(res.body.subscription).toBeDefined();
    expect(res.body.instructions).toBeDefined();

    // Check kode unik between 100 and 999
    expect(res.body.payment.kodeUnik).toBeGreaterThanOrEqual(100);
    expect(res.body.payment.kodeUnik).toBeLessThanOrEqual(999);
    expect(res.body.payment.status).toBe('pending');
    expect(res.body.subscription.status).toBe('pending');

    // Total amount = original price + kodeUnik
    expect(res.body.payment.amount).toBe(
      res.body.package.price + res.body.payment.kodeUnik,
    );
  });

  it('lists user payment transactions', async () => {
    const res = await request('/billing/payments', {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
