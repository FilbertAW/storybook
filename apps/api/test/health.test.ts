import { beforeAll, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@storylib/shared';
import { WEB_ORIGIN, buildTestApp, type TestApp } from './helpers';

describe('GET /api/v1/health', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await buildTestApp();
  });

  it('answers ok without a token', async () => {
    const res = await t.request('/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('allows the configured web origin', async () => {
    const res = await t.app.request('/api/v1/health', { headers: { Origin: WEB_ORIGIN } });
    expect(res.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
  });

  it('answers unknown routes with the shared error shape', async () => {
    const res = await t.request('/nope', { token: await t.login('parent.a@example.com') });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('unexpected failures', () => {
  it('become INTERNAL without leaking the cause', async () => {
    const { createApp } = await import('../src/app');
    const { createDb } = await import('../src/db/client');
    const { systemClock } = await import('../src/shared/clock');
    // A database with no tables, so the first query throws inside the app.
    const broken = createApp({
      corsOrigin: WEB_ORIGIN,
      jwtSecret: 'test-secret-test-secret-test-secret-0123',
      db: createDb(':memory:'),
      clock: systemClock,
    });
    const res = await broken.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'parent.a@example.com' }),
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: { code: 'INTERNAL', message: 'Something went wrong.' },
    });
    expect(text).not.toMatch(/no such table|sqlite|select|\bat \w+/i);
  });
});
