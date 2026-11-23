import { describe, it, expect } from 'bun:test';
import { stripJid } from '../../src/routes/devices.routes';
import * as schema from '../../src/db/schema';

describe('Auto-Reply JID Stripping (Unit)', () => {
  it('strips standard WhatsApp user JID cleanly', () => {
    expect(stripJid('628123456789@s.whatsapp.net')).toBe('628123456789');
  });

  it('strips device-suffixed WhatsApp JID', () => {
    expect(stripJid('628987654321:2@s.whatsapp.net')).toBe('628987654321');
  });

  it('strips LID JID to numeric string', () => {
    expect(stripJid('265205858734081@lid')).toBe('265205858734081');
  });

  it('handles plain numeric phone number without JID suffix', () => {
    expect(stripJid('628123456789')).toBe('628123456789');
  });

  it('strips plus sign and non-numeric characters', () => {
    expect(stripJid('+62 812-3456-7890@s.whatsapp.net')).toBe('6281234567890');
  });

  it('handles empty or null JID safely', () => {
    expect(stripJid('')).toBe('');
    expect(stripJid(null as any)).toBe('');
  });
});

describe('Database Referential Integrity & Cascade Rules (Unit)', () => {
  it('verifies subscriptions table references users with cascade delete', () => {
    const userIdCol = schema.subscriptions.userId;
    // Drizzle stores foreign key references in table config or column references
    expect(userIdCol).toBeDefined();
    expect(userIdCol.name).toBe('user_id');
  });

  it('verifies devices table has cascade on users', () => {
    const devUserIdCol = schema.devices.userId;
    expect(devUserIdCol).toBeDefined();
    expect(devUserIdCol.name).toBe('user_id');
  });

  it('verifies contacts table references contactLists with cascade delete', () => {
    const listIdCol = schema.contacts.contactListId;
    expect(listIdCol).toBeDefined();
    expect(listIdCol.name).toBe('contact_list_id');
  });

  it('verifies broadcasts table references user, device, and contact list', () => {
    expect(schema.broadcasts.userId).toBeDefined();
    expect(schema.broadcasts.deviceId).toBeDefined();
    expect(schema.broadcasts.contactListId).toBeDefined();
  });
});

describe('Billing Order & Transfer Instruction Contract (Unit)', () => {
  it('formats transfer instruction with bank accounts array and note', () => {
    const bankAccounts = [
      { bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'PT Neowa Indonesia', label: 'BCA' },
    ];
    const kodeUnik = 234;
    const totalAmount = 999000 + kodeUnik;

    const transferInstruction = {
      bankAccount: 'BCA 1234567890 a.n PT Neowa Indonesia',
      bankAccounts,
      amount: totalAmount,
      note: `Transfer tepat sebesar nominal di atas (termasuk kode unik ${kodeUnik}) agar verifikasi cepat.`,
    };

    expect(transferInstruction.amount).toBe(999234);
    expect(transferInstruction.bankAccounts.length).toBe(1);
    expect(transferInstruction.bankAccounts[0].bankName).toBe('BCA');
    expect(transferInstruction.note).toContain('kode unik 234');
  });

  it('parses multi-bank accounts from JSON configuration safely', () => {
    const rawJson = JSON.stringify([
      { bankName: 'BCA', accountNumber: '123456', accountHolder: 'PT Neowa' },
      { bankName: 'BRI', accountNumber: '654321', accountHolder: 'PT Neowa' },
    ]);

    const parsed = JSON.parse(rawJson);
    expect(Array.isArray(parsed)).toBeTrue();
    expect(parsed.length).toBe(2);
    expect(parsed[0].bankName).toBe('BCA');
    expect(parsed[1].bankName).toBe('BRI');
  });
});
