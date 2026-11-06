import { z } from 'zod';

export const createEventRequestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, 'Use lower_snake_case, up to 64 characters.'),
  bookId: z.string().min(1).optional(),
  props: z
    .record(z.string(), z.unknown())
    .refine((p) => JSON.stringify(p).length <= 2000, 'props is too large.')
    .optional(),
});
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;
