import { z } from 'zod';

export const roleSchema = z.enum(['parent', 'creator']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
});
export type UserDto = z.infer<typeof userSchema>;

export const loginRequestSchema = z.object({ email: z.email() });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authResponseSchema = z.object({ token: z.string(), user: userSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits.');

export const setPinRequestSchema = z.object({
  pin: pinSchema,
  currentPin: z.string().optional(),
});
export type SetPinRequest = z.infer<typeof setPinRequestSchema>;

export const parentUnlockRequestSchema = z.object({ pin: pinSchema });
export type ParentUnlockRequest = z.infer<typeof parentUnlockRequestSchema>;

export const meResponseSchema = z.object({ user: userSchema, pinSet: z.boolean() });
export type MeResponse = z.infer<typeof meResponseSchema>;

export const setPinResponseSchema = z.object({ pinSet: z.literal(true) });
export type SetPinResponse = z.infer<typeof setPinResponseSchema>;
