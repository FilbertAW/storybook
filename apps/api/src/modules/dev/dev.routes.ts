import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { devClockRequestSchema, type DevClockResponse } from '@storylib/shared';
import type { AppEnv } from '../../shared/app-env';
import type { OffsetClock } from '../../shared/clock';
import { validationHook } from '../../shared/validate';

// Only mounted when ENABLE_DEV_CLOCK is on. The offset lives in this process, so it
// holds on a local server but not across separate serverless invocations.
export function devRoutes(clock: OffsetClock) {
  const current = (): DevClockResponse => ({
    now: new Date(clock.now()).toISOString(),
    offsetDays: clock.offsetDays,
  });
  return new Hono<AppEnv>()
    .get('/clock', (c) => c.json(current()))
    .post('/clock', zValidator('json', devClockRequestSchema, validationHook), (c) => {
      clock.offsetDays = c.req.valid('json').offsetDays;
      return c.json(current());
    });
}
