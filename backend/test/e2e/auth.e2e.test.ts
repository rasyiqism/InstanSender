import { describe, it, expect } from 'bun:test';
import { request } from './test-client';

describe('Auth Flow (E2E)', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `User Test ${timestamp}`,
    email: `test-${timestamp}@neowa-test.id`,
    password: 'Password123!',
  };

  let token = '';

  it('checks system health', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers a new user and returns access token', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: testUser,
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.role).toBe('user');

    token = res.body.accessToken;
  });

  it('rejects duplicate email registration', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: testUser,
    });

    expect(res.status).toBe(400);
  });

  it('logs in successfully with valid credentials', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: {
        email: testUser.email,
        password: 'wrongPassword999',
      },
    });

    expect(res.status).toBe(401);
  });

  it('blocks access to protected endpoints without token', async () => {
    const res = await request('/devices');
    expect(res.status).toBe(401);
  });

  it('allows access to protected endpoints with valid Bearer token', async () => {
    const res = await request('/devices', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTrue();
  });

  it('fetches authenticated user profile via /auth/me', async () => {
    const res = await request('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testUser.email);
    expect(res.body.role).toBe('user');
  });
});
