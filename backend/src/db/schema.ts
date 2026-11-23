import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('users_role_enum', ['user', 'agency', 'admin']);
export const subscriptionStatusEnum = pgEnum('subscriptions_status_enum', ['pending', 'active', 'expired', 'cancelled']);
export const paymentStatusEnum = pgEnum('payments_status_enum', ['pending', 'paid', 'rejected']);
export const deviceStatusEnum = pgEnum('devices_status_enum', ['pending_qr', 'connected', 'reconnecting', 'disconnected']);
export const messageTypeEnum = pgEnum('message_logs_message_type_enum', ['text', 'image', 'document']);
export const messageStatusEnum = pgEnum('message_logs_status_enum', ['queued', 'sent', 'delivered', 'failed']);
export const autoReplyMatchModeEnum = pgEnum('auto_reply_rules_match_mode_enum', ['contains', 'exact']);
export const webhookEventTypeEnum = pgEnum('webhooks_event_type_enum', [
  'message.status',
  'device.status',
  'message.incoming',
  'group.members',
]);
export const webhookLogEventTypeEnum = pgEnum('webhook_logs_event_type_enum', [
  'message.status',
  'device.status',
  'message.incoming',
  'group.members',
]);
export const broadcastTypeEnum = pgEnum('broadcasts_type_enum', ['text', 'image', 'document']);
export const broadcastStatusEnum = pgEnum('broadcasts_status_enum', [
  'pending',
  'running',
  'completed',
  'failed',
  'paused',
  'cancelled',
]);
export const agencyStatusEnum = pgEnum('agencies_status_enum', ['trial', 'active', 'expired', 'suspended', 'cancelled']);
export const agencyPackageStatusEnum = pgEnum('agency_packages_status_enum', ['active', 'inactive']);

// 1. Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  passwordResetTokenHash: varchar('password_reset_token_hash', { length: 255 }),
  passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
  role: userRoleEnum('role').default('user').notNull(),
  agencyId: uuid('agency_id'),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('users_agency_id_idx').on(table.agencyId),
  index('users_role_idx').on(table.role),
]);

// 2. Packages
export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  maxDevice: integer('max_device').notNull(),
  messageQuota: integer('message_quota'),
  price: bigint('price', { mode: 'number' }).notNull(),
  rateLimitPerSecond: integer('rate_limit_per_second').default(10).notNull(),
  durationDays: integer('duration_days').default(30).notNull(),
  active: boolean('active').default(true).notNull(),
});

// 3. Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  packageId: uuid('package_id').notNull().references(() => packages.id, { onDelete: 'restrict' }),
  status: subscriptionStatusEnum('status').default('pending').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  messagesUsed: integer('messages_used').default(0).notNull(),
  reminderDaysSent: text('reminder_days_sent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('subscriptions_user_id_idx').on(table.userId),
  index('subscriptions_status_idx').on(table.status),
]);

// 4. Payments
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  agencySubscriptionId: uuid('agency_subscription_id').references(() => agencySubscriptions.id, { onDelete: 'set null' }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  kodeUnik: integer('kode_unik').notNull(),
  bankAccountTujuan: varchar('bank_account_tujuan', { length: 255 }).notNull(),
  buktiTransferUrl: varchar('bukti_transfer_url', { length: 1024 }),
  status: paymentStatusEnum('status').default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  verifiedBy: varchar('verified_by', { length: 255 }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('payments_user_id_idx').on(table.userId),
  index('payments_status_idx').on(table.status),
]);

// 5. Devices
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  agencyId: uuid('agency_id'),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  status: deviceStatusEnum('status').default('pending_qr').notNull(),
  sessionDataRef: varchar('session_data_ref', { length: 255 }),
  workerNode: varchar('worker_node', { length: 255 }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  autoReplyEnabled: boolean('auto_reply_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('devices_user_id_idx').on(table.userId),
  index('devices_agency_id_idx').on(table.agencyId),
  index('devices_status_idx').on(table.status),
]);

// 6. API Keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  plaintextKey: varchar('plaintext_key', { length: 255 }),
  scope: varchar('scope', { length: 100 }).default('send:message').notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('api_keys_user_id_idx').on(table.userId),
  index('api_keys_device_id_idx').on(table.deviceId),
]);

// 7. Message Logs
export const messageLogs = pgTable('message_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  broadcastId: uuid('broadcast_id').references(() => broadcasts.id, { onDelete: 'set null' }),
  recipient: varchar('recipient', { length: 50 }).notNull(),
  messageType: messageTypeEnum('message_type').notNull(),
  status: messageStatusEnum('status').default('queued').notNull(),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('message_logs_device_id_idx').on(table.deviceId),
  index('message_logs_api_key_id_idx').on(table.apiKeyId),
  index('message_logs_broadcast_id_idx').on(table.broadcastId),
  index('message_logs_status_idx').on(table.status),
  index('message_logs_created_at_idx').on(table.createdAt),
]);

// 8. Auto Reply Rules
export const autoReplyRules = pgTable('auto_reply_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  matchMode: autoReplyMatchModeEnum('match_mode').default('contains').notNull(),
  reply: varchar('reply', { length: 4096 }).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('auto_reply_rules_device_id_idx').on(table.deviceId),
]);

// 9. Contact Lists
export const contactLists = pgTable('contact_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('contact_lists_user_id_idx').on(table.userId),
]);

// 10. Contacts
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactListId: uuid('contact_list_id').notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('contacts_contact_list_id_idx').on(table.contactListId),
]);

// 11. Broadcasts
export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  contactListId: uuid('contact_list_id').notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  message: varchar('message', { length: 4096 }),
  type: broadcastTypeEnum('type').default('text').notNull(),
  mediaUrl: varchar('media_url', { length: 2048 }),
  caption: varchar('caption', { length: 1024 }),
  status: broadcastStatusEnum('status').default('pending').notNull(),
  totalRecipients: integer('total_recipients').default(0).notNull(),
  sentCount: integer('sent_count').default(0).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  delaySeconds: integer('delay_seconds').default(5).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('broadcasts_user_id_idx').on(table.userId),
  index('broadcasts_device_id_idx').on(table.deviceId),
  index('broadcasts_status_idx').on(table.status),
]);

// 12. Webhooks
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  eventType: webhookEventTypeEnum('event_type').default('message.status').notNull(),
  secret: varchar('secret', { length: 255 }).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('webhooks_user_id_idx').on(table.userId),
]);

// 13. Webhook Logs
export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  webhookId: uuid('webhook_id').references(() => webhooks.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  eventType: webhookLogEventTypeEnum('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  success: boolean('success').default(false).notNull(),
  responseStatus: integer('response_status'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('webhook_logs_user_id_idx').on(table.userId),
  index('webhook_logs_webhook_id_idx').on(table.webhookId),
  index('webhook_logs_created_at_idx').on(table.createdAt),
]);

// 14. Agencies
export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: agencyStatusEnum('status').default('trial').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 15. Agency Packages
export const agencyPackages = pgTable('agency_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  deviceQuota: integer('device_quota').default(0).notNull(),
  activationLimit: integer('activation_limit').default(0).notNull(),
  allowedPackages: text('allowed_packages'), // Comma-separated array
  durationDays: integer('duration_days').default(30).notNull(),
  price: bigint('price', { mode: 'number' }).notNull(),
  features: text('features'), // Comma-separated array
  status: agencyPackageStatusEnum('status').default('active').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 16. Agency Subscriptions
export const agencySubscriptions = pgTable('agency_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id, { onDelete: 'cascade' }),
  packageId: uuid('package_id').notNull().references(() => agencyPackages.id, { onDelete: 'restrict' }),
  deviceQuota: integer('device_quota').notNull(),
  deviceUsed: integer('device_used').default(0).notNull(),
  activationLimit: integer('activation_limit').default(0).notNull(),
  activationUsed: integer('activation_used').default(0).notNull(),
  allowedPackages: text('allowed_packages'), // Comma-separated array
  startsAt: timestamp('starts_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: agencyStatusEnum('status').default('trial').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agency_subscriptions_agency_id_idx').on(table.agencyId),
  index('agency_subscriptions_package_id_idx').on(table.packageId),
]);

// 17. Settings
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
