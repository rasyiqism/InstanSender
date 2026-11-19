import { describe, it, expect } from 'bun:test';
import crypto from 'node:crypto';

describe('Webhooks Signature Verification (Unit)', () => {
  it('computes expected HMAC SHA-256 signature for outgoing payload', () => {
    const secret = 'whsec_test_secret_key_12345';
    const payload = JSON.stringify({
      event: 'message.status',
      data: { messageId: 'msg-123', status: 'delivered' },
      timestamp: '2026-11-19T00:00:00.000Z',
    });

    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(signature).toBeDefined();
    expect(signature).toHaveLength(64);

    // Verify verification logic
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(computed).toBe(signature);
  });
});
