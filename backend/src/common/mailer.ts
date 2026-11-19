import nodemailer from 'nodemailer';
import { config } from '../config';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

async function createTransporter() {
  const host = await getSetting('SMTP_HOST', config.smtp.host);
  const port = Number(await getSetting('SMTP_PORT', String(config.smtp.port)));
  const secure = (await getSetting('SMTP_SECURE', String(config.smtp.secure))) === 'true';
  const user = await getSetting('SMTP_USER', config.smtp.user);
  const pass = await getSetting('SMTP_PASSWORD', config.smtp.password);

  if (!host || !user) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      console.warn(`[Mailer] SMTP not configured. Email to ${to} was skipped. Subject: ${subject}`);
      return false;
    }
    const from = await getSetting('MAIL_FROM', config.smtp.from);
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err: any) {
    console.error(`[Mailer] Error sending email to ${to}:`, err.message);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const brand = await getSetting('NOTIFICATION_BRAND_NAME', config.notificationBrandName);
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2>Reset Password ${brand}</h2>
      <p>Kami menerima permintaan untuk mereset password akun Anda.</p>
      <p>Klik tombol di bawah ini untuk mengatur password baru. Link ini berlaku selama 1 jam:</p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Jika Anda tidak merasa meminta reset password, abaikan email ini.</p>
    </div>
  `;
  return sendEmail(to, `Reset Password Akun ${brand}`, html);
}
