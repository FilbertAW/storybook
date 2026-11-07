import { createMiddleware } from 'hono/factory';
import { BASE_LOCALE, localeSchema, type Locale } from '@storylib/shared';
import type { AppEnv } from './app-env';

// The first language in Accept-Language that we have; otherwise the books' original language.
export function parseLocale(header: string | undefined): Locale {
  for (const part of (header ?? '').split(',')) {
    const primary = part.split(';')[0]?.trim().toLowerCase().split('-')[0];
    const parsed = localeSchema.safeParse(primary);
    if (parsed.success) return parsed.data;
  }
  return BASE_LOCALE;
}

export const localeMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('locale', parseLocale(c.req.header('accept-language')));
  await next();
});
