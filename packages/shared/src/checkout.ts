import { z } from 'zod';

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceIdr: z.number(),
  periodDays: z.number(),
});
export type PlanDto = z.infer<typeof planSchema>;

export const plansResponseSchema = z.object({ plans: z.array(planSchema) });
export type PlansResponse = z.infer<typeof plansResponseSchema>;

export const subscriptionSummarySchema = z.object({
  active: z.boolean(),
  planName: z.string().nullable(),
  endsAt: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionSummary = z.infer<typeof subscriptionSummarySchema>;

export const createOrderRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('book'),
    bookId: z.string().min(1),
    acknowledgeSubscriptionOverlap: z.boolean().optional(),
  }),
  z.object({ type: z.literal('subscription'), planId: z.string().min(1) }),
]);
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const idempotencyHeaderSchema = z.object({
  'idempotency-key': z.string().trim().min(1).max(128),
});

export const payOrderRequestSchema = z.object({ simulate: z.enum(['success', 'fail']) });
export type PayOrderRequest = z.infer<typeof payOrderRequestSchema>;

export const orderSchema = z.object({
  id: z.string(),
  type: z.enum(['book', 'subscription']),
  status: z.enum(['pending', 'paid', 'failed']),
  bookId: z.string().nullable(),
  bookTitle: z.string().nullable(),
  planId: z.string().nullable(),
  planName: z.string().nullable(),
  amountIdr: z.number(),
  subscriptionOverlapAck: z.boolean(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
});
export type OrderDto = z.infer<typeof orderSchema>;

export const ordersResponseSchema = z.object({ orders: z.array(orderSchema) });
export type OrdersResponse = z.infer<typeof ordersResponseSchema>;
