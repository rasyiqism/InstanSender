import { describe, it, expect } from 'bun:test';
import { emailTemplate, formatRupiah } from '../../src/common/notifications';

describe('Notifications & Email Template (Unit)', () => {
  it('formats rupiah currency correctly', () => {
    const formatted = formatRupiah(150000);
    expect(formatted).toContain('150.000');
  });

  it('renders email template with expected brand, title, details and escaping', () => {
    const html = emailTemplate({
      title: 'Konfirmasi Pesanan <Test>',
      paragraphs: ['Halo ini paragraf pertama.', 'Paragraf kedua.'],
      details: [
        { label: 'Nomor', value: '123' },
        { label: 'Paket & Fitur', value: 'Starter & 1 Device' },
      ],
      action: {
        label: 'Klik Disini',
        url: 'https://example.com/billing',
      },
      brandName: 'Neowa Express',
    });

    expect(html).toContain('Neowa Express');
    expect(html).toContain('Konfirmasi Pesanan &lt;Test&gt;');
    expect(html).toContain('Paragraf kedua.');
    expect(html).toContain('Starter &amp; 1 Device');
    expect(html).toContain('https://example.com/billing');
    expect(html).toContain('Klik Disini');
  });
});
