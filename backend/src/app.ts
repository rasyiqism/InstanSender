import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';
import { config } from './config';

// Routes
import { authRoutes } from './routes/auth.routes';
import { deviceRoutes } from './routes/devices.routes';
import { autoReplyRoutes } from './routes/auto-reply.routes';
import { apiKeysRoutes } from './routes/api-keys.routes';
import { billingRoutes } from './routes/billing.routes';
import { contactListRoutes } from './routes/contact-lists.routes';
import { broadcastRoutes } from './routes/broadcasts.routes';
import { webhookRoutes } from './routes/webhooks.routes';
import { logsRoutes } from './routes/logs.routes';
import { agencyRoutes } from './routes/agency.routes';
import { adminRoutes } from './routes/admin.routes';
import { messagingRoutes } from './routes/messaging.routes';
import { groupsRoutes } from './routes/groups.routes';
import { provisioningRoutes } from './routes/provisioning.routes';

export const app = new Elysia()
  .use(cors())
  .use(
    staticPlugin({
      assets: config.uploadDir,
      prefix: '/uploads',
    }),
  )
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Neowa API (Bun + Elysia)',
          version: '2.0.0',
          description: 'SaaS WhatsApp Notification Gateway & Agency Reseller API',
        },
        tags: [
          { name: 'Auth', description: 'Authentication & Profile operations' },
          { name: 'Devices', description: 'WhatsApp Devices management & QR scan' },
          { name: 'Messaging', description: 'Outbound WhatsApp messaging gateway' },
          { name: 'Billing', description: 'Packages, Orders, and Subscriptions' },
          { name: 'Agency', description: 'Reseller Agency operations' },
          { name: 'Admin', description: 'Platform administration & verification' },
        ],
      },
    }),
  )
  .onError(({ code, error, set }) => {
    const errObj = error as any;
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        message: 'Validasi input gagal',
        error: errObj?.message || 'Invalid input',
      };
    }
    console.error(`[AppError] [${code}]:`, error);
    return {
      message: errObj?.message || 'Terjadi kesalahan pada server',
    };
  })
  .get('/health', () => ({ status: 'ok' }));

// Group containing all application routes
export const apiGroup = new Elysia()
  .get('/health', () => ({ status: 'ok' }))
  .use(authRoutes)
  .use(deviceRoutes)
  .use(autoReplyRoutes)
  .use(apiKeysRoutes)
  .use(billingRoutes)
  .use(contactListRoutes)
  .use(broadcastRoutes)
  .use(webhookRoutes)
  .use(logsRoutes)
  .use(agencyRoutes)
  .use(adminRoutes)
  .use(messagingRoutes)
  .use(groupsRoutes)
  .use(provisioningRoutes);

// Mount at root AND under /api to seamlessly support both reverse proxy styles
app
  .use(apiGroup)
  .group('/api', (group) => group.use(apiGroup));
