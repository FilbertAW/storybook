import { handle } from 'hono/vercel';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createDb } from './db/client';
import { OffsetClock, systemClock } from './shared/clock';

const env = loadEnv();
const devClock = env.ENABLE_DEV_CLOCK ? new OffsetClock() : undefined;

const handler = handle(
  createApp({
    corsOrigin: env.CORS_ORIGIN,
    jwtSecret: env.JWT_SECRET,
    db: createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN),
    clock: devClock ?? systemClock,
    devClock,
  }),
);

// Vercel's fetch-style functions are one export per HTTP method.
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
