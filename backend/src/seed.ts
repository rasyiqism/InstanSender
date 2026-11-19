import { db, schema } from './db';
import { eq } from 'drizzle-orm';
import { config } from './config';
import { hashPassword } from './common/auth';

const defaultPackages = [
  {
    name: 'Basic',
    maxDevice: 1,
    messageQuota: null,
    price: 999000,
    rateLimitPerSecond: 10,
    durationDays: 365,
  },
  {
    name: 'Premium',
    maxDevice: 5,
    messageQuota: null,
    price: 299000,
    rateLimitPerSecond: 30,
    durationDays: 365,
  },
  {
    name: 'Business',
    maxDevice: 10,
    messageQuota: null,
    price: 499000,
    rateLimitPerSecond: 100,
    durationDays: 365,
  },
];

const defaultResellerPackages = [
  {
    name: 'Basic Reseller',
    price: 499000,
    activationLimit: 10,
    allowedPackages: 'Basic',
    deviceQuota: 0,
    durationDays: 365,
    features: '10x aktivasi Basic',
  },
  {
    name: 'Premium Reseller',
    price: 999000,
    activationLimit: 20,
    allowedPackages: 'Basic,Premium',
    deviceQuota: 0,
    durationDays: 365,
    features: '20x aktivasi Basic & Premium',
  },
  {
    name: 'Business Reseller',
    price: 1999000,
    activationLimit: 30,
    allowedPackages: 'Basic,Premium,Business',
    deviceQuota: 0,
    durationDays: 365,
    features: '30x aktivasi Basic, Premium & Business',
  },
  {
    name: 'Master Reseller',
    price: 3999000,
    activationLimit: 75,
    allowedPackages: 'Basic,Premium,Business',
    deviceQuota: 0,
    durationDays: 365,
    features: '75x aktivasi Basic, Premium & Business',
  },
];

const defaultSettings = [
  { key: 'NOTIFICATION_WA_DEVICE_ID', value: config.notificationWaDeviceId, description: 'Device UUID for system WA notifications' },
  { key: 'SMTP_HOST', value: config.smtp.host, description: 'SMTP server host' },
  { key: 'SMTP_PORT', value: String(config.smtp.port), description: 'SMTP server port' },
  { key: 'SMTP_SECURE', value: String(config.smtp.secure), description: 'Use TLS (true/false)' },
  { key: 'SMTP_USER', value: config.smtp.user, description: 'SMTP username' },
  { key: 'SMTP_PASSWORD', value: config.smtp.password, description: 'SMTP password' },
  { key: 'MAIL_FROM', value: config.smtp.from, description: 'From address for outgoing emails' },
  { key: 'BANK_NAME', value: config.bank.name, description: 'Primary bank name' },
  { key: 'BANK_ACCOUNT_NUMBER', value: config.bank.accountNumber, description: 'Primary bank account number' },
  { key: 'BANK_ACCOUNT_HOLDER', value: config.bank.accountHolder, description: 'Primary bank account holder name' },
  { key: 'BCA_ACCOUNT_NUMBER', value: config.bank.bcaNumber, description: 'BCA account number' },
  { key: 'BCA_ACCOUNT_HOLDER', value: config.bank.bcaHolder, description: 'BCA account holder' },
  { key: 'BRI_ACCOUNT_NUMBER', value: config.bank.briNumber, description: 'BRI account number' },
  { key: 'BRI_ACCOUNT_HOLDER', value: config.bank.briHolder, description: 'BRI account holder' },
];

export async function runSeed() {
  console.log('--- Starting Database Seed (Bun + Elysia + Drizzle) ---');

  // 1. Seed Packages
  for (const pkg of defaultPackages) {
    const [exists] = await db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.name, pkg.name))
      .limit(1);

    if (!exists) {
      await db.insert(schema.packages).values(pkg);
      console.log(`  ✓ Package created: ${pkg.name}`);
    }
  }

  // 2. Seed Reseller Packages
  for (const pkg of defaultResellerPackages) {
    const [exists] = await db
      .select()
      .from(schema.agencyPackages)
      .where(eq(schema.agencyPackages.name, pkg.name))
      .limit(1);

    if (!exists) {
      await db.insert(schema.agencyPackages).values(pkg);
      console.log(`  ✓ Agency Package created: ${pkg.name}`);
    }
  }

  // 3. Seed Admin User
  const isProd = config.nodeEnv === 'production';
  const adminEmail = config.seedAdminEmail || (isProd ? '' : 'admin@neowa.id');
  const adminPassword = config.seedAdminPassword || (isProd ? '' : 'admin12345');

  if (adminEmail && adminPassword) {
    const [exists] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, adminEmail.toLowerCase().trim()))
      .limit(1);

    if (!exists) {
      const passHash = await hashPassword(adminPassword);
      await db.insert(schema.users).values({
        name: 'Admin',
        email: adminEmail.toLowerCase().trim(),
        passwordHash: passHash,
        role: 'admin',
      });
      console.log(`  ✓ Admin user created: ${adminEmail}`);
    }
  }

  // 4. Seed Settings
  for (const s of defaultSettings) {
    const [exists] = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, s.key))
      .limit(1);

    if (!exists) {
      await db.insert(schema.settings).values(s);
      console.log(`  ✓ Setting created: ${s.key}`);
    }
  }

  console.log('--- Seed Finished Successfully ---');
}

if (import.meta.main) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
