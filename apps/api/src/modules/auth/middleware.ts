import { createMiddleware } from 'hono/factory';
import type { Role } from '@storylib/shared';
import type { AppEnv, Scope } from '../../shared/app-env';
import { AppError } from '../../shared/errors';
import type { TokenService } from './token.service';
import type { UsersRepository } from './users.repository';

export const authenticate = (tokens: TokenService, users: UsersRepository) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const [scheme, token] = c.req.header('Authorization')?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('UNAUTHENTICATED', 'Please log in.');
    }
    const claims = await tokens.verify(token);
    // The role comes from the database, not the token, and a reseeded
    // database invalidates old tokens instead of leaving dangling users.
    const user = await users.findById(claims.sub);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in again.');
    c.set('user', user);
    c.set('scope', claims.scope);
    await next();
  });

// The only requests a kid token may make: reading books, logging events, and
// leaving Kid mode. Everything else is KID_MODE_FORBIDDEN, decided in one place
// so a new route cannot be left open by accident.
const KID_ALLOWED: ReadonlyArray<{ method: string; path: RegExp }> = [
  { method: 'GET', path: /^\/books$/ },
  { method: 'GET', path: /^\/books\/[^/]+$/ },
  { method: 'GET', path: /^\/books\/[^/]+\/pages$/ },
  { method: 'GET', path: /^\/books\/[^/]+\/pages\/\d+$/ },
  { method: 'POST', path: /^\/events$/ },
  { method: 'POST', path: /^\/auth\/parent-unlock$/ },
];

export const kidScopeGuard = (basePath: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.get('scope') === 'kid') {
      const path = c.req.path.slice(basePath.length);
      const allowed = KID_ALLOWED.some((r) => r.method === c.req.method && r.path.test(path));
      if (!allowed) {
        throw new AppError('KID_MODE_FORBIDDEN', 'This is not available in Kid mode.');
      }
    }
    await next();
  });

export const requireRole = (role: Role) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.get('user').role !== role) {
      throw new AppError('FORBIDDEN_ROLE', `This is only available to ${role} accounts.`);
    }
    await next();
  });

export const requireScope = (scope: Scope) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.get('scope') !== scope) {
      throw new AppError('FORBIDDEN_ROLE', 'This is not available in the current mode.');
    }
    await next();
  });
