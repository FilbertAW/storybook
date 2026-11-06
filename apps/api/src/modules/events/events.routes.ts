import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createEventRequestSchema } from '@storylib/shared';
import type { AppEnv } from '../../shared/app-env';
import { validationHook } from '../../shared/validate';
import type { EventService } from './events.service';

// Open to every signed-in mode, including a kid token.
export function eventsRoutes(service: EventService) {
  return new Hono<AppEnv>().post(
    '/',
    zValidator('json', createEventRequestSchema, validationHook),
    async (c) => {
      await service.log(c.get('user'), c.req.valid('json'));
      return c.body(null, 204);
    },
  );
}
