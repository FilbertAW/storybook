import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HealthResponse } from '@storylib/shared';
import type { Env } from './config/env';

export function createApp(env: Pick<Env, 'CORS_ORIGIN'>) {
  const app = new Hono().basePath('/api/v1');

  app.use('*', cors({ origin: env.CORS_ORIGIN }));

  app.get('/health', (c) => {
    const body: HealthResponse = { status: 'ok' };
    return c.json(body);
  });

  return app;
}
