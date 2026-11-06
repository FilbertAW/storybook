import { handle } from 'hono/vercel';
import { createApp } from '../src/app';
import { loadEnv } from '../src/config/env';
import { createDb } from '../src/db/client';
import { OffsetClock, systemClock } from '../src/shared/clock';

const env = loadEnv();
const devClock = env.ENABLE_DEV_CLOCK ? new OffsetClock() : undefined;

export default handle(
  createApp({
    corsOrigin: env.CORS_ORIGIN,
    jwtSecret: env.JWT_SECRET,
    db: createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN),
    clock: devClock ?? systemClock,
    devClock,
  }),
);
