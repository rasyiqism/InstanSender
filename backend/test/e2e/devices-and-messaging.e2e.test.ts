import { describe, it, expect, beforeAll } from 'bun:test';
import { request } from './test-client';

describe('Messaging, Contacts & Auto-Reply (E2E)', () => {
  let userToken = '';

  beforeAll(async () => {
    const userEmail = `messaging-tester-${Date.now()}@test.id`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Msg Tester',
        email: userEmail,
        password: 'Password123!',
      },
    });
    expect(regRes.status).toBe(200);
    userToken = regRes.body.accessToken;
  });

  it('performs CRUD operations on contact lists and contacts', async () => {
    // 1. Create list
    const createListRes = await request('/contact-lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { name: 'VIP Customers' },
    });
    expect(createListRes.status).toBe(200);
    const listId = createListRes.body.id;
    expect(listId).toBeDefined();

    // 2. Add contact to list
    const addContactRes = await request(`/contact-lists/${listId}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        name: 'Budi Santoso',
        phoneNumber: '6281234567890',
      },
    });
    expect(addContactRes.status).toBe(200);
    expect(addContactRes.body.id).toBeDefined();

    // 3. Get list detail
    const getListRes = await request(`/contact-lists/${listId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(getListRes.status).toBe(200);
    expect(getListRes.body.contacts.length).toBe(1);
    expect(getListRes.body.contacts[0].name).toBe('Budi Santoso');

    // 4. Delete list
    const delRes = await request(`/contact-lists/${listId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(delRes.status).toBe(200);
  });

  it('performs CRUD operations on API keys', async () => {
    // 1. Create API Key
    const createRes = await request('/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { name: 'Production Bot' },
    });
    expect(createRes.status).toBe(200);
    expect(createRes.body.key).toBeDefined();
    expect(createRes.body.key.startsWith('nwa_')).toBeTrue();
    const keyId = createRes.body.id;

    // 2. List API Keys
    const listRes = await request('/api-keys', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((k: any) => k.id === keyId)).toBeTrue();

    // 3. Revoke API Key
    const revokeRes = await request(`/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(revokeRes.status).toBe(200);
  });
});
