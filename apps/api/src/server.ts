import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createDb } from './db/client';
import { OffsetClock, systemClock } from './shared/clock';

const env = loadEnv();
const devClock = env.ENABLE_DEV_CLOCK ? new OffsetClock() : undefined;
const app = createApp({
  corsOrigin: env.CORS_ORIGIN,
  jwtSecret: env.JWT_SECRET,
  db: createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN),
  clock: devClock ?? systemClock,
  devClock,
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api/v1`);
});
