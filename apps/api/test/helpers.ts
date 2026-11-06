import { createApp } from '../src/app';
import { createDb } from '../src/db/client';
import { migrateDb } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { DEMO_PIN } from '../src/db/seed-data';
import type { Clock } from '../src/shared/clock';

export { DEMO_PIN };
export const JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
export const WEB_ORIGIN = 'http://localhost:5173';

export class TestClock implements Clock {
  constructor(private time = Date.now()) {}
  now() {
    return this.time;
  }
  advance(ms: number) {
    this.time += ms;
  }
}

interface RequestOptions {
  method?: string;
  token?: string;
  json?: unknown;
}

// A fresh in-memory database, migrated and seeded, behind the real app.
export async function buildTestApp() {
  const db = createDb(':memory:');
  await migrateDb(db);
  const clock = new TestClock();
  await seedDatabase(db, clock.now());
  const app = createApp({ corsOrigin: WEB_ORIGIN, jwtSecret: JWT_SECRET, db, clock });

  async function request(path: string, { method = 'GET', token, json }: RequestOptions = {}) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const hasBody = json !== undefined && method !== 'GET' && method !== 'HEAD';
    if (hasBody) headers['Content-Type'] = 'application/json';
    const res = await app.request(`/api/v1${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(json) : undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as any };
  }

  async function login(email: string): Promise<string> {
    const { body } = await request('/auth/login', { method: 'POST', json: { email } });
    return body.token as string;
  }

  async function kidToken(email: string): Promise<string> {
    const { body } = await request('/auth/kid-mode', { method: 'POST', token: await login(email) });
    return body.token as string;
  }

  return { app, db, clock, request, login, kidToken };
}

export type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

export const newBook = (overrides: Record<string, unknown> = {}) => ({
  title: 'The Brave Little Gecko',
  description: 'A gecko finds courage on a stormy night.',
  coverUrl: 'https://picsum.photos/seed/gecko-cover/600/800',
  ageMin: 3,
  ageMax: 6,
  priceIdr: 18_000,
  pages: [
    { text: 'Gecko lived behind the kitchen clock.', imageUrl: 'https://picsum.photos/seed/gecko-1/800/600' },
    { text: 'One night the thunder came.', imageUrl: 'https://picsum.photos/seed/gecko-2/800/600' },
  ],
  ...overrides,
});
