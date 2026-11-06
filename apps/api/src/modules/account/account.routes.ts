import { Hono } from 'hono';
import type { AppEnv } from '../../shared/app-env';
import type { AccountService } from './account.service';

export function accountRoutes(service: AccountService) {
  return new Hono<AppEnv>().get('/', async (c) => c.json(await service.me(c.get('user'))));
}
