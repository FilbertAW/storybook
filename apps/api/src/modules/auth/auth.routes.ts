import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  loginRequestSchema,
  parentUnlockRequestSchema,
  setPinRequestSchema,
} from '@storylib/shared';
import type { AppEnv } from '../../shared/app-env';
import { validationHook } from '../../shared/validate';
import type { AuthService } from './auth.service';
import { requireRole, requireScope } from './middleware';

// Mounted before the authenticate middleware: login needs no token.
export function loginRoutes(service: AuthService) {
  return new Hono<AppEnv>().post(
    '/login',
    zValidator('json', loginRequestSchema, validationHook),
    async (c) => c.json(await service.login(c.req.valid('json').email)),
  );
}

export function sessionRoutes(service: AuthService) {
  return new Hono<AppEnv>()
    .post('/kid-mode', requireRole('parent'), async (c) =>
      c.json(await service.enterKidMode(c.get('user'))),
    )
    .post(
      '/parent-unlock',
      requireScope('kid'),
      zValidator('json', parentUnlockRequestSchema, validationHook),
      async (c) => c.json(await service.parentUnlock(c.get('user'), c.req.valid('json').pin)),
    );
}

export function meRoutes(service: AuthService) {
  return new Hono<AppEnv>()
    .get('/', (c) => c.json(service.me(c.get('user'))))
    .put(
      '/pin',
      requireRole('parent'),
      zValidator('json', setPinRequestSchema, validationHook),
      async (c) => {
        const { pin, currentPin } = c.req.valid('json');
        return c.json(await service.setPin(c.get('user'), pin, currentPin));
      },
    );
}
