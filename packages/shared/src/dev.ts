import { z } from 'zod';

// Dev-only clock shift, used to demo subscription expiry.
export const devClockRequestSchema = z.object({ offsetDays: z.number().min(0).max(3650) });
export type DevClockRequest = z.infer<typeof devClockRequestSchema>;

export const devClockResponseSchema = z.object({ now: z.string(), offsetDays: z.number() });
export type DevClockResponse = z.infer<typeof devClockResponseSchema>;
