import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { waClient } from './wa-client';
import { sendEmail } from './mailer';

export interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  greeting?: string;
  paragraphs: string[];
  details?: Array<{ label: string; value: string }>;
  action?: { label: string; url: string };
  brandName?: string;
  brandTagline?: string;
  footer?: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function emailTemplate(options: EmailTemplateOptions): string {
  const brandName = options.brandName || config.notificationBrandName || 'NotifPod';
  const brandTagline = options.brandTagline || config.notificationBrandTagline || 'WhatsApp Notification Gateway';
  const preheader = options.preheader ? escapeHtml(options.preheader) : '';
  const title = escapeHtml(options.title);
  const greeting = options.greeting ? escapeHtml(options.greeting) : '';

  const detailsHtml = options.details?.length
    ? `<div class="card">${options.details
        .map(
          ({ label, value }) =>
            `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
        )
        .join('')}</div>`
    : '';

  const actionHtml = options.action
    ? `<div class="action"><a href="${escapeHtml(options.action.url)}" target="_blank">${escapeHtml(
        options.action.label,
      )}</a></div>`
    : '';

  const footerText =
    options.footer ||
    config.notificationEmailFooter ||
    `Email ini dikirim otomatis oleh ${brandName}. Mohon tidak membalas email ini.`;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    .preheader{display:none!important;max-height:0;overflow:hidden;opacity:0}
    .wrap{width:100%;padding:32px 12px;box-sizing:border-box}
    .container{max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px rgba(0,0,0,0.04)}
    .header{padding:28px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff}
    .brand{font-size:22px;font-weight:800;letter-spacing:-.4px}
    .header p{margin:6px 0 0;color:#d1fae5;font-size:13px}
    .content{padding:32px 32px}
    .content h1{margin:0 0 16px;font-size:24px;line-height:1.3;letter-spacing:-.4px;color:#0f172a}
    .content p{margin:0 0 14px;color:#475569;font-size:15px;line-height:1.6}
    .card{margin:20px 0;padding:8px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
    .row{display:flex;gap:16px;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
    .row:last-child{border:0}
    .row span{color:#64748b}
    .row strong{text-align:right;color:#0f172a}
    .action{margin:24px 0}
    .action a{display:inline-block;padding:12px 24px;border-radius:8px;background:#10b981;color:#fff!important;text-decoration:none;font-weight:700;font-size:15px}
    .footer{padding:20px 32px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.5;border-top:1px solid #f1f5f9}
    @media(max-width:640px){.wrap{padding:0}.container{border-radius:0}.header,.content,.footer{padding-left:20px;padding-right:20px}.row{display:block}.row strong{display:block;margin-top:4px;text-align:left}}
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="wrap"><div class="container">
    <div class="header">
      <div class="brand">${escapeHtml(brandName)}</div>
      <p>${escapeHtml(brandTagline)}</p>
    </div>
    <div class="content">
      <h1>${title}</h1>
      ${greeting ? `<p>${greeting}</p>` : ''}
      ${options.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      ${detailsHtml}
      ${actionHtml}
    </div>
    <div class="footer">${escapeHtml(footerText)}</div>
  </div></div>
</body>
</html>`;
}

export async function getSettingValue(key: string, fallback: string): Promise<string> {
  try {
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

export async function sendWhatsAppNotification(to: string, message: string): Promise<boolean> {
  try {
    if (!to || !message) return false;
    const cleanTo = to.replace(/[^\d]/g, '');
    if (!cleanTo || cleanTo.length < 8) return false;

    const deviceId = await getSettingValue('NOTIFICATION_WA_DEVICE_ID', config.notificationWaDeviceId);
    if (!deviceId) {
      return false;
    }

    await waClient.sendMessage({
      deviceId,
      to: cleanTo,
      type: 'text',
      message,
    });
    return true;
  } catch (err: any) {
    console.warn(`[NotificationWA] Skipped sending WA alert to ${to}:`, err.message);
    return false;
  }
}

export function formatRupiah(value: number | string): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export async function sendWelcomeNotification(
  user: { name: string; email: string; phoneNumber?: string | null },
  tempPassword?: string,
) {
  const brandName = await getSettingValue('NOTIFICATION_BRAND_NAME', config.notificationBrandName);
  const appUrl = config.appUrl;

  const details = [
    { label: 'Nama', value: user.name },
    { label: 'Email', value: user.email },
  ];
  if (user.phoneNumber) {
    details.push({ label: 'Nomor WhatsApp', value: user.phoneNumber });
  }
  if (tempPassword) {
    details.push({ label: 'Kata Sandi Sementara', value: tempPassword });
  }

  const html = emailTemplate({
    title: `Selamat datang di ${brandName}!`,
    preheader: `Akun ${brandName} Anda berhasil dibuat.`,
    greeting: `Halo ${user.name},`,
    paragraphs: [
      `Akun Anda berhasil dibuat. Anda sekarang dapat masuk ke dashboard untuk menghubungkan device WhatsApp dan mulai mengirim notifikasi otomatis.`,
      `Pastikan untuk menjaga kerahasiaan kredensial dan API key Anda.`,
    ],
    details,
    action: {
      label: 'Buka Dashboard',
      url: `${appUrl}/login`,
    },
    brandName,
  });

  const emailPromise = sendEmail(user.email, `Selamat datang di ${brandName}`, html);

  let waPromise = Promise.resolve(false);
  if (user.phoneNumber) {
    const waText = `Halo *${user.name}*, selamat datang di *${brandName}*!\n\nAkun Anda telah aktif dengan email: ${user.email}${
      tempPassword ? `\nKata Sandi: ${tempPassword}` : ''
    }\n\nSilakan login ke dashboard di: ${appUrl}/login`;
    waPromise = sendWhatsAppNotification(user.phoneNumber, waText);
  }

  await Promise.allSettled([emailPromise, waPromise]);
}

export async function sendOrderCreatedNotification(
  user: { name: string; email: string; phoneNumber?: string | null },
  order: {
    orderId: string;
    packageName: string;
    amount: string | number;
    kodeUnik: number;
    bankAccounts?: Array<{ bankName: string; accountNumber: string; accountHolder: string }>;
  },
) {
  const brandName = await getSettingValue('NOTIFICATION_BRAND_NAME', config.notificationBrandName);
  const appUrl = config.appUrl;
  const formattedAmount = formatRupiah(order.amount);

  const bankList = (order.bankAccounts || [])
    .filter((a) => a.accountNumber)
    .map((a) => `${a.bankName} ${a.accountNumber} a.n. ${a.accountHolder}`)
    .join(' / ');

  const details = [
    { label: 'ID Pesanan', value: order.orderId },
    { label: 'Paket Langganan', value: order.packageName },
    { label: 'Total Transfer', value: formattedAmount },
    { label: 'Kode Unik', value: String(order.kodeUnik) },
    { label: 'Rekening Tujuan', value: bankList || 'Cek di Dashboard' },
  ];

  const html = emailTemplate({
    title: `Pesanan ${order.packageName} Berhasil Dibuat`,
    preheader: `Selesaikan pembayaran transfer senilai ${formattedAmount}.`,
    greeting: `Halo ${user.name},`,
    paragraphs: [
      `Pesanan paket langganan Anda telah kami terima.`,
      `Mohon lakukan transfer tepat sesuai nominal yang tertera agar pembayaran Anda dapat segera diverifikasi oleh tim admin kami.`,
    ],
    details,
    action: {
      label: 'Unggah Bukti Transfer',
      url: `${appUrl}/billing`,
    },
    brandName,
  });

  const emailPromise = sendEmail(user.email, `Instruksi Pembayaran Pesanan #${order.orderId}`, html);

  let waPromise = Promise.resolve(false);
  if (user.phoneNumber) {
    const waText = `Halo *${user.name}*,\n\nPesanan paket *${order.packageName}* di *${brandName}* berhasil dibuat.\n\n*Total Transfer*: ${formattedAmount}\n*Kode Unik*: ${order.kodeUnik}\n*Rekening*: ${bankList || '-'}\n\nSetelah transfer, silakan upload bukti transfer di: ${appUrl}/billing`;
    waPromise = sendWhatsAppNotification(user.phoneNumber, waText);
  }

  await Promise.allSettled([emailPromise, waPromise]);
}

export async function sendSubscriptionReminderNotification(
  user: { name: string; email: string; phoneNumber?: string | null },
  packageName: string,
  endDate: Date,
  daysLeft: number,
) {
  const brandName = await getSettingValue('NOTIFICATION_BRAND_NAME', config.notificationBrandName);
  const appUrl = config.appUrl;
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(endDate);

  const details = [
    { label: 'Paket Langganan', value: packageName },
    { label: 'Tanggal Berakhir', value: formattedDate },
    { label: 'Sisa Waktu', value: `${daysLeft} hari lagi` },
  ];

  const html = emailTemplate({
    title: `Langganan ${packageName} Berakhir ${daysLeft} Hari Lagi`,
    preheader: `Masa aktif paket ${packageName} akan berakhir pada ${formattedDate}.`,
    greeting: `Halo ${user.name},`,
    paragraphs: [
      `Masa aktif paket langganan ${packageName} Anda akan berakhir pada ${formattedDate}.`,
      `Perpanjang paket sekarang agar integrasi WhatsApp dan pengiriman notifikasi otomatis Anda tetap berjalan tanpa kendala.`,
    ],
    details,
    action: {
      label: 'Perpanjang Langganan',
      url: `${appUrl}/billing`,
    },
    brandName,
  });

  const emailPromise = sendEmail(user.email, `Pengingat: Langganan Berakhir ${daysLeft} Hari Lagi`, html);

  let waPromise = Promise.resolve(false);
  if (user.phoneNumber) {
    const waText = `Halo *${user.name}*,\n\nMasa aktif paket *${packageName}* Anda di *${brandName}* akan berakhir dalam *${daysLeft} hari* lagi (pada tanggal ${formattedDate}).\n\nSilakan lakukan perpanjangan di: ${appUrl}/billing agar layanan tidak terputus.`;
    waPromise = sendWhatsAppNotification(user.phoneNumber, waText);
  }

  await Promise.allSettled([emailPromise, waPromise]);
}
