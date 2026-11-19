import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

const client = postgres(config.databaseUrl, {
  ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
  max: 20,
  idle_timeout: 30,
});

export const db = drizzle(client, { schema });
export { schema };
