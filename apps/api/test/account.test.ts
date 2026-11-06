import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { devClockResponseSchema, meResponseSchema } from '@storylib/shared';
import { createApp } from '../src/app';
import { events } from '../src/db/schema';
import { OffsetClock } from '../src/shared/clock';
import { JWT_SECRET, WEB_ORIGIN, buildTestApp, type TestApp } from './helpers';

const PARENT_A = 'parent.a@example.com';
const PARENT_B = 'parent.b@example.com';
const PARENT_C = 'parent.c@example.com';
const SARI = 'sari@example.com';

let t: TestApp;
beforeEach(async () => {
  t = await buildTestApp();
});

describe('GET /me', () => {
  const me = async (email: string) =>
    meResponseSchema.parse((await t.request('/me', { token: await t.login(email) })).body);

  it('shows parent A as unsubscribed, owning the book they bought', async () => {
    const body = await me(PARENT_A);
    expect(body.pinSet).toBe(true);
    expect(body.subscription).toEqual({ active: false, planName: null, endsAt: null, cancelAtPeriodEnd: false });
    expect(body.ownedBookIds).toEqual([await t.bookId('Kiko the Little Firefly')]);
  });

  it('shows parent B with an active subscription and when it ends', async () => {
    const { subscription } = await me(PARENT_B);
    expect(subscription).toMatchObject({ active: true, planName: 'Monthly', cancelAtPeriodEnd: false });
    expect(new Date(subscription.endsAt!).getTime()).toBe(t.clock.now() + 20 * 24 * 60 * 60 * 1000);
  });

  it('shows parent C as unsubscribed, because the period has ended, and still owning the retired book', async () => {
    const body = await me(PARENT_C);
    expect(body.subscription.active).toBe(false);
    expect(body.pinSet).toBe(false);
    expect(body.ownedBookIds).toEqual([await t.bookId('The Lost Kite')]);
  });

  it('shows a creator no subscription and no purchases', async () => {
    const body = await me(SARI);
    expect(body.user.role).toBe('creator');
    expect(body.ownedBookIds).toEqual([]);
    expect(body.subscription.active).toBe(false);
  });

  it('is closed to a kid token', async () => {
    const res = await t.request('/me', { token: await t.kidToken(PARENT_A) });
    expect(res.status).toBe(403);
  });
});

describe('POST /events', () => {
  const log = (token: string, json: unknown) => t.request('/events', { method: 'POST', token, json });

  it('stores an event for the signed-in user', async () => {
    const parent = await t.login(PARENT_A);
    const bookId = await t.bookId('The Rainy Day Parade');
    const res = await log(parent, { name: 'preview_completed', bookId, props: { pages: 2 } });
    expect(res.status).toBe(204);

    const [row] = await t.db.select().from(events).where(eq(events.name, 'preview_completed'));
    expect(row).toMatchObject({ bookId, createdAt: t.clock.now() });
    expect(JSON.parse(row!.props!)).toEqual({ pages: 2 });
    expect(row!.userId).toBe((await t.userRow(PARENT_A)).id);
  });

  it('accepts an event without a book or props', async () => {
    expect((await log(await t.login(PARENT_A), { name: 'app_opened' })).status).toBe(204);
  });

  it('accepts events from a kid token, attributed to the parent account', async () => {
    const res = await log(await t.kidToken(PARENT_A), { name: 'book_opened', bookId: await t.bookId('Kiko the Little Firefly') });
    expect(res.status).toBe(204);
  });

  it('404s an unknown book instead of failing on the foreign key', async () => {
    const res = await log(await t.login(PARENT_A), { name: 'book_opened', bookId: 'nope' });
    expect(res.status).toBe(404);
  });

  it('400s a bad name or oversized props', async () => {
    const token = await t.login(PARENT_A);
    for (const json of [{}, { name: '' }, { name: 'Book Opened' }, { name: 'x'.repeat(65) }, { name: 'ok', props: { big: 'x'.repeat(3000) } }]) {
      expect((await log(token, json)).status, JSON.stringify(json).slice(0, 40)).toBe(400);
    }
  });

  it('401s without a token', async () => {
    expect((await t.request('/events', { method: 'POST', json: { name: 'app_opened' } })).status).toBe(401);
  });
});

describe('dev clock', () => {
  it('is not mounted unless enabled', async () => {
    const res = await t.request('/dev/clock', { token: await t.login(PARENT_A) });
    expect(res.status).toBe(404);
  });

  describe('when enabled', () => {
    let dev: OffsetClock;
    let call: (path: string, token: string, init?: { method?: string; json?: unknown }) => Promise<{ status: number; body: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any

    beforeEach(() => {
      dev = new OffsetClock();
      const app = createApp({ corsOrigin: WEB_ORIGIN, jwtSecret: JWT_SECRET, db: t.db, clock: dev, devClock: dev });
      call = async (path, token, { method = 'GET', json } = {}) => {
        const res = await app.request(`/api/v1${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, ...(json === undefined ? {} : { 'Content-Type': 'application/json' }) },
          body: json === undefined ? undefined : JSON.stringify(json),
        });
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
      };
    });

    it('starts at no offset', async () => {
      const res = await call('/dev/clock', await t.login(PARENT_A));
      expect(devClockResponseSchema.parse(res.body).offsetDays).toBe(0);
    });

    it('moves time forward so a running subscription lapses, and back again', async () => {
      const token = await t.login(PARENT_B);
      const rainy = await t.bookId('The Rainy Day Parade');
      const access = async () => (await call(`/books/${rainy}`, token)).body.access.reason;
      expect(await access()).toBe('subscription');

      const moved = await call('/dev/clock', token, { method: 'POST', json: { offsetDays: 31 } });
      expect(moved.status).toBe(200);
      expect(devClockResponseSchema.parse(moved.body).offsetDays).toBe(31);
      expect(await access()).toBe('locked');
      expect((await call('/me', token)).body.subscription.active).toBe(false);

      await call('/dev/clock', token, { method: 'POST', json: { offsetDays: 0 } });
      expect(await access()).toBe('subscription');
    });

    it('400s an offset that is negative or not a number', async () => {
      const token = await t.login(PARENT_A);
      for (const json of [{ offsetDays: -1 }, { offsetDays: 'x' }, {}]) {
        expect((await call('/dev/clock', token, { method: 'POST', json })).status).toBe(400);
      }
    });

    it('needs a signed-in user, and is closed to a kid token', async () => {
      const anon = await call('/dev/clock', 'garbage');
      expect(anon.status).toBe(401);
      const kid = await call('/dev/clock', await t.kidToken(PARENT_A));
      expect(kid.status).toBe(403);
    });
  });
});
