import { Hono } from 'hono';
import type { AppEnv } from '../../shared/app-env';
import { requireRole } from '../auth/middleware';
import type { SubscriptionService } from './subscriptions.service';

export function subscriptionsRoutes(service: SubscriptionService) {
  return new Hono<AppEnv>().post('/current/cancel', requireRole('parent'), async (c) =>
    c.json(await service.cancel(c.get('user'))),
  );
}
