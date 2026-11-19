import { describe, it, expect, beforeAll } from 'bun:test';
import { request } from './test-client';

describe('Admin Operations (E2E)', () => {
  let adminToken = '';
  let normalUserToken = '';

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@neowa.id',
        password: 'admin12345',
      },
    });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.accessToken;

    // 2. Register normal user
    const userEmail = `non-admin-${Date.now()}@test.id`;
    const userRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Regular User',
        email: userEmail,
        password: 'Password123!',
      },
    });
    expect(userRes.status).toBe(200);
    normalUserToken = userRes.body.accessToken;
  });

  it('rejects regular user from accessing admin endpoints', async () => {
    const res = await request('/admin/packages', {
      headers: {
        Authorization: `Bearer ${normalUserToken}`,
      },
    });
    expect(res.status).toBe(403);
  });

  it('allows admin to list retail packages', async () => {
    const res = await request('/admin/packages', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();
  });

  it('allows admin to create, update, and delete retail package', async () => {
    // Create
    const createRes = await request('/admin/packages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        name: `E2E Package ${Date.now()}`,
        maxDevice: 5,
        messageQuota: 1000,
        price: 150000,
        rateLimitPerSecond: 10,
        durationDays: 30,
        active: true,
      },
    });
    expect(createRes.status).toBe(200);
    expect(createRes.body.id).toBeDefined();
    const pkgId = createRes.body.id;

    // Update
    const updateRes = await request(`/admin/packages/${pkgId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        maxDevice: 10,
        price: 250000,
      },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.maxDevice).toBe(10);
    expect(updateRes.body.price).toBe(250000);

    // Delete
    const deleteRes = await request(`/admin/packages/${pkgId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBeTrue();
  });

  it('returns allowedPackages and features as array in agency packages', async () => {
    const res = await request('/admin/agency-packages', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();

    if (res.body.length > 0) {
      const first = res.body[0];
      expect(Array.isArray(first.allowedPackages)).toBeTrue();
      expect(Array.isArray(first.features)).toBeTrue();
    }
  });

  it('allows admin to create, update, and delete agency package', async () => {
    // Create
    const createRes = await request('/admin/agency-packages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        name: `Agency E2E Tier ${Date.now()}`,
        activationLimit: 25,
        allowedPackages: ['Basic', 'Premium'],
        features: ['Feature A', 'Feature B'],
        durationDays: 365,
        price: 1200000,
      },
    });
    expect(createRes.status).toBe(200);
    expect(createRes.body.id).toBeDefined();
    expect(Array.isArray(createRes.body.allowedPackages)).toBeTrue();
    expect(Array.isArray(createRes.body.features)).toBeTrue();
    expect(createRes.body.allowedPackages).toEqual(['Basic', 'Premium']);

    const pkgId = createRes.body.id;

    // Update
    const updateRes = await request(`/admin/agency-packages/${pkgId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        activationLimit: 50,
        features: ['Feature A', 'Feature B', 'Feature C'],
      },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.activationLimit).toBe(50);
    expect(Array.isArray(updateRes.body.features)).toBeTrue();

    // Delete
    const deleteRes = await request(`/admin/agency-packages/${pkgId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBeTrue();
  });

  it('returns properly formatted agencies list with owner object', async () => {
    const res = await request('/admin/agencies', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();
    for (const agency of res.body) {
      expect(agency.id).toBeDefined();
      if (agency.ownerUserId) {
        expect(agency.owner).toBeDefined();
        expect(agency.owner.id).toBe(agency.ownerUserId);
      }
    }
  });
});
