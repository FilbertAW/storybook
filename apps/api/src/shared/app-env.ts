import type { Locale } from '@storylib/shared';
import type { users } from '../db/schema';

export type UserRow = typeof users.$inferSelect;
export type Scope = 'full' | 'kid';

// Hono context variables set by the authenticate middleware.
export type AppEnv = {
  Variables: {
    user: UserRow;
    scope: Scope;
    locale: Locale;
  };
};
