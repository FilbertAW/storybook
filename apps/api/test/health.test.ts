import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@storylib/shared';
import { createApp } from '../src/app';

describe('GET /api/v1/health', () => {
  const app = createApp({ CORS_ORIGIN: 'http://localhost:5173' });

  it('answers ok', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json())).toEqual({ status: 'ok' });
  });

  it('allows the configured web origin', async () => {
    const res = await app.request('/api/v1/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
