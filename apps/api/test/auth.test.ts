import { beforeEach, describe, expect, it } from 'vitest';
import { authResponseSchema, errorResponseSchema, meResponseSchema } from '@storylib/shared';
import { MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '../src/modules/auth/auth.service';
import { TokenService } from '../src/modules/auth/token.service';
import { DEMO_PIN, JWT_SECRET, buildTestApp, type TestApp } from './helpers';

const PARENT_A = 'parent.a@example.com'; // PIN set
const PARENT_C = 'parent.c@example.com'; // no PIN
const CREATOR = 'sari@example.com';
const WRONG_PIN = '9999';

let t: TestApp;
beforeEach(async () => {
  t = await buildTestApp();
});

const unlock = (token: string, pin: string) =>
  t.request('/auth/parent-unlock', { method: 'POST', token, json: { pin } });

describe('login and tokens', () => {
  it('logs in a seeded user, ignoring email case', async () => {
    const res = await t.request('/auth/login', { method: 'POST', json: { email: 'Parent.A@Example.com' } });
    expect(res.status).toBe(200);
    const body = authResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ email: PARENT_A, role: 'parent' });
  });

  it('404s an unknown email and 400s a bad or malformed body', async () => {
    const unknown = await t.request('/auth/login', { method: 'POST', json: { email: 'who@example.com' } });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');

    const bad = await t.request('/auth/login', { method: 'POST', json: { email: 'not-an-email' } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const malformed = await t.app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{nope',
    });
    expect(malformed.status).toBe(400);
    expect(errorResponseSchema.parse(await malformed.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing, garbage or forged token with 401 UNAUTHENTICATED', async () => {
    for (const token of [undefined, 'garbage', 'a.b.c']) {
      const res = await t.request('/me', { token });
      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new TokenService('x'.repeat(40), t.clock).issue('anyone', 'full');
    expect((await t.request('/me', { token: forged })).status).toBe(401);
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const orphan = await new TokenService(JWT_SECRET, t.clock).issue(crypto.randomUUID(), 'full');
    expect((await t.request('/me', { token: orphan })).status).toBe(401);
  });

  it('returns the user and whether a PIN is set', async () => {
    const a = await t.request('/me', { token: await t.login(PARENT_A) });
    expect(meResponseSchema.parse(a.body).pinSet).toBe(true);
    const c = await t.request('/me', { token: await t.login(PARENT_C) });
    expect(meResponseSchema.parse(c.body).pinSet).toBe(false);
  });
});

describe('Kid mode', () => {
  it('409 PIN_NOT_SET when the parent has no PIN', async () => {
    const res = await t.request('/auth/kid-mode', { method: 'POST', token: await t.login(PARENT_C) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PIN_NOT_SET');
  });

  it('issues a kid token for a parent with a PIN', async () => {
    const res = await t.request('/auth/kid-mode', { method: 'POST', token: await t.login(PARENT_A) });
    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.email).toBe(PARENT_A);
  });

  it('is parent-only', async () => {
    const res = await t.request('/auth/kid-mode', { method: 'POST', token: await t.login(CREATOR) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('answers 403 KID_MODE_FORBIDDEN on everything a kid may not do', async () => {
    const kid = await t.kidToken(PARENT_A);
    const attempts: Array<[string, string]> = [
      ['GET', '/me'],
      ['PUT', '/me/pin'],
      ['POST', '/auth/kid-mode'],
      ['GET', '/creator/books'],
      ['POST', '/books'],
      ['PATCH', '/books/anything'],
      ['DELETE', '/books/anything'],
      ['GET', '/plans'],
      ['POST', '/orders'],
      ['POST', '/orders/anything/pay'],
      ['GET', '/orders'],
      ['POST', '/subscriptions/current/cancel'],
      ['POST', '/books/anything/pages'], // wrong method on a readable path
    ];
    for (const [method, path] of attempts) {
      const res = await t.request(path, { method, token: kid, json: {} });
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.error.code, `${method} ${path}`).toBe('KID_MODE_FORBIDDEN');
    }
  });

  it('lets a kid token past the guard on the read and event paths', async () => {
    const kid = await t.kidToken(PARENT_A);
    for (const [method, path] of [
      ['GET', '/books'],
      ['GET', '/books/some-id'],
      ['GET', '/books/some-id/pages'],
      ['GET', '/books/some-id/pages/1'],
      ['POST', '/events'],
    ] as const) {
      const res = await t.request(path, { method, token: kid, json: {} });
      expect(res.body?.error?.code, `${method} ${path}`).not.toBe('KID_MODE_FORBIDDEN');
    }
  });

  it('a kid token cannot be used as a parent token on /me after the swap', async () => {
    const kid = await t.kidToken(PARENT_A);
    expect((await t.request('/me', { token: kid })).status).toBe(403);
  });
});

describe('leaving Kid mode', () => {
  it('returns a working parent token for the right PIN', async () => {
    const res = await unlock(await t.kidToken(PARENT_A), DEMO_PIN);
    expect(res.status).toBe(200);
    const me = await t.request('/me', { token: authResponseSchema.parse(res.body).token });
    expect(me.status).toBe(200);
  });

  it('only works from a kid token', async () => {
    const res = await unlock(await t.login(PARENT_A), DEMO_PIN);
    expect(res.status).toBe(403);
  });

  it('401 PIN_INVALID for a wrong PIN, counting down the attempts', async () => {
    const kid = await t.kidToken(PARENT_A);
    const first = await unlock(kid, WRONG_PIN);
    expect(first.status).toBe(401);
    expect(first.body.error.code).toBe('PIN_INVALID');
    expect(first.body.error.details.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1);
    const second = await unlock(kid, WRONG_PIN);
    expect(second.body.error.details.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 2);
  });

  it('400s a PIN that is not 4 to 6 digits, without counting an attempt', async () => {
    const kid = await t.kidToken(PARENT_A);
    expect((await unlock(kid, '12')).status).toBe(400);
    expect((await unlock(kid, 'abcd')).status).toBe(400);
    const next = await unlock(kid, WRONG_PIN);
    expect(next.body.error.details.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1);
  });

  it('locks after 5 wrong PINs: the 5th answers 429, and even the right PIN waits', async () => {
    const kid = await t.kidToken(PARENT_A);
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      expect((await unlock(kid, WRONG_PIN)).status).toBe(401);
    }
    const fifth = await unlock(kid, WRONG_PIN);
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('PIN_LOCKED');
    expect(new Date(fifth.body.error.details.retryAt).getTime()).toBe(t.clock.now() + PIN_LOCK_MS);

    const rightButLocked = await unlock(kid, DEMO_PIN);
    expect(rightButLocked.status).toBe(429);
  });

  it('unlocks again after the lock expires, with a fresh set of attempts', async () => {
    const kid = await t.kidToken(PARENT_A);
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) await unlock(kid, WRONG_PIN);

    t.clock.advance(PIN_LOCK_MS + 1);
    const wrong = await unlock(kid, WRONG_PIN);
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.details.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1);
    expect((await unlock(kid, DEMO_PIN)).status).toBe(200);
  });

  it('a right PIN resets the failure counter', async () => {
    const kid = await t.kidToken(PARENT_A);
    await unlock(kid, WRONG_PIN);
    await unlock(kid, WRONG_PIN);
    expect((await unlock(kid, DEMO_PIN)).status).toBe(200);
    const after = await unlock(kid, WRONG_PIN);
    expect(after.body.error.details.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1);
  });

  it('keeps the lock in the database, not in the app instance', async () => {
    const kid = await t.kidToken(PARENT_A);
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) await unlock(kid, WRONG_PIN);

    // A second app instance over the same database, as a new serverless invocation would be.
    const { createApp } = await import('../src/app');
    const second = createApp({ corsOrigin: 'http://localhost:5173', jwtSecret: JWT_SECRET, db: t.db, clock: t.clock });
    const res = await second.request('/api/v1/auth/parent-unlock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${kid}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: DEMO_PIN }),
    });
    expect(res.status).toBe(429);
  });
});

describe('setting a PIN', () => {
  const setPin = (token: string, json: unknown) => t.request('/me/pin', { method: 'PUT', token, json });

  it('sets a first PIN without a current one, which then enables Kid mode', async () => {
    const token = await t.login(PARENT_C);
    expect((await setPin(token, { pin: '4321' })).status).toBe(200);
    expect((await t.request('/auth/kid-mode', { method: 'POST', token })).status).toBe(200);
    const kid = await t.kidToken(PARENT_C);
    expect((await unlock(kid, '4321')).status).toBe(200);
  });

  it('stores a hash, never the PIN', async () => {
    await setPin(await t.login(PARENT_C), { pin: '4321' });
    const { users } = await import('../src/db/schema');
    const rows = await t.db.select({ pinHash: users.pinHash }).from(users);
    expect(rows.some((r) => r.pinHash?.includes('4321'))).toBe(false);
    expect(rows.some((r) => r.pinHash?.startsWith('scrypt$'))).toBe(true);
  });

  it('requires the current PIN to change an existing one', async () => {
    const token = await t.login(PARENT_A);
    const missing = await setPin(token, { pin: '4321' });
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('PIN_INVALID');

    const wrong = await setPin(token, { pin: '4321', currentPin: WRONG_PIN });
    expect(wrong.status).toBe(401);

    expect((await setPin(token, { pin: '4321', currentPin: DEMO_PIN })).status).toBe(200);
    const kid = await t.kidToken(PARENT_A);
    expect((await unlock(kid, DEMO_PIN)).status).toBe(401);
    expect((await unlock(kid, '4321')).status).toBe(200);
  });

  it('counts wrong current PINs toward the same lockout', async () => {
    const token = await t.login(PARENT_A);
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
      await setPin(token, { pin: '4321', currentPin: WRONG_PIN });
    }
    const res = await setPin(token, { pin: '4321', currentPin: DEMO_PIN });
    expect(res.status).toBe(429);
  });

  it('400s a PIN that is not 4 to 6 digits', async () => {
    const token = await t.login(PARENT_C);
    for (const pin of ['123', '1234567', 'abcd', 1234]) {
      expect((await setPin(token, { pin })).status, String(pin)).toBe(400);
    }
  });

  it('is parent-only', async () => {
    const res = await setPin(await t.login(CREATOR), { pin: '4321' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });
});
