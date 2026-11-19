import fs from 'node:fs/promises';
import { app } from './app';
import { config } from './config';
import { runSeed } from './seed';

// Ensure uploads folder exists
await fs.mkdir(config.uploadDir, { recursive: true });

// Run initial database seed
try {
  await runSeed();
} catch (err: any) {
  console.warn(`[Bootstrap] Seed warning:`, err.message);
}

app.listen(config.port, () => {
  console.log(`🚀 Neowa API (Bun + Elysia) running on http://localhost:${config.port}`);
  console.log(`📚 Swagger documentation at http://localhost:${config.port}/docs`);
});

export { app };
