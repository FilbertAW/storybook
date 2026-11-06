import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HealthResponse } from '@storylib/shared';
import type { Db } from './db/client';
import { loginRoutes, meRoutes, sessionRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { authenticate, kidScopeGuard } from './modules/auth/middleware';
import { TokenService } from './modules/auth/token.service';
import { UsersRepository } from './modules/auth/users.repository';
import { BooksRepository } from './modules/books/books.repository';
import { booksRoutes, creatorRoutes } from './modules/books/books.routes';
import { BookService } from './modules/books/books.service';
import type { AppEnv } from './shared/app-env';
import type { Clock } from './shared/clock';
import { errorHandler, notFoundHandler } from './shared/error-middleware';

export interface AppDeps {
  corsOrigin: string;
  jwtSecret: string;
  db: Db;
  clock: Clock;
}

const BASE_PATH = '/api/v1';

export function createApp({ corsOrigin, jwtSecret, db, clock }: AppDeps) {
  const usersRepo = new UsersRepository(db);
  const tokens = new TokenService(jwtSecret, clock);
  const authService = new AuthService(usersRepo, tokens, clock);
  const bookService = new BookService(new BooksRepository(db), clock);

  const app = new Hono<AppEnv>().basePath(BASE_PATH);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.use('*', cors({ origin: corsOrigin }));

  // Public routes come first: handlers run in registration order, so these
  // answer before the authenticate middleware below.
  app.get('/health', (c) => {
    const body: HealthResponse = { status: 'ok' };
    return c.json(body);
  });
  app.route('/auth', loginRoutes(authService));

  app.use('*', authenticate(tokens, usersRepo));
  app.use('*', kidScopeGuard(BASE_PATH));

  app.route('/auth', sessionRoutes(authService));
  app.route('/me', meRoutes(authService));
  app.route('/books', booksRoutes(bookService));
  app.route('/creator', creatorRoutes(bookService));

  return app;
}
