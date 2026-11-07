import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  createOrderRequestSchema,
  idempotencyHeaderSchema,
  payOrderRequestSchema,
} from '@storylib/shared';
import type { AppEnv } from '../../shared/app-env';
import { validationHook } from '../../shared/validate';
import { requireRole } from '../auth/middleware';
import type { CheckoutService } from './checkout.service';

export function plansRoutes(service: CheckoutService) {
  return new Hono<AppEnv>().get('/', requireRole('parent'), async (c) => c.json(await service.listPlans()));
}

export function ordersRoutes(service: CheckoutService) {
  return new Hono<AppEnv>()
    .post(
      '/',
      requireRole('parent'),
      zValidator('header', idempotencyHeaderSchema, validationHook),
      zValidator('json', createOrderRequestSchema, validationHook),
      async (c) => {
        const key = c.req.valid('header')['idempotency-key'];
        const { order, created } = await service.createOrder(c.get('user'), key, c.req.valid('json'));
        return c.json(order, created ? 201 : 200);
      },
    )
    .post(
      '/:id/pay',
      requireRole('parent'),
      zValidator('json', payOrderRequestSchema, validationHook),
      async (c) => c.json(await service.pay(c.get('user'), c.req.param('id'), c.req.valid('json').simulate)),
    )
    .get('/', requireRole('parent'), async (c) => c.json(await service.listOrders(c.get('user'), c.get('locale'))));
}
