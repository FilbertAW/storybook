import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HealthResponse } from '@storylib/shared';
import type { Db } from './db/client';
import { AccessService } from './modules/access/access.service';
import { AccountService } from './modules/account/account.service';
import { accountRoutes } from './modules/account/account.routes';
import { loginRoutes, meRoutes, sessionRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { authenticate, kidScopeGuard } from './modules/auth/middleware';
import { TokenService } from './modules/auth/token.service';
import { UsersRepository } from './modules/auth/users.repository';
import { BooksRepository } from './modules/books/books.repository';
import { booksRoutes, creatorRoutes } from './modules/books/books.routes';
import { BookService } from './modules/books/books.service';
import { ordersRoutes, plansRoutes } from './modules/checkout/checkout.routes';
import { CheckoutService } from './modules/checkout/checkout.service';
import { OrdersRepository } from './modules/checkout/orders.repository';
import { MockPaymentGateway, type PaymentGateway } from './modules/checkout/payment-gateway';
import { PlansRepository } from './modules/checkout/plans.repository';
import { PurchasesRepository } from './modules/checkout/purchases.repository';
import { devRoutes } from './modules/dev/dev.routes';
import { EventsRepository } from './modules/events/events.repository';
import { eventsRoutes } from './modules/events/events.routes';
import { EventService } from './modules/events/events.service';
import { SubscriptionsRepository } from './modules/subscriptions/subscriptions.repository';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { SubscriptionService } from './modules/subscriptions/subscriptions.service';
import type { AppEnv } from './shared/app-env';
import type { Clock, OffsetClock } from './shared/clock';
import { errorHandler, notFoundHandler } from './shared/error-middleware';
import { localeMiddleware } from './shared/locale';

export interface AppDeps {
  corsOrigin: string;
  jwtSecret: string;
  db: Db;
  clock: Clock;
  // Defaults to the mock; a Midtrans or Xendit adapter plugs in here.
  gateway?: PaymentGateway;
  // When set, mounts the dev-only clock endpoint.
  devClock?: OffsetClock;
}

const BASE_PATH = '/api/v1';

export function createApp({ corsOrigin, jwtSecret, db, clock, gateway, devClock }: AppDeps) {
  const usersRepo = new UsersRepository(db);
  const booksRepo = new BooksRepository(db);
  const subscriptionsRepo = new SubscriptionsRepository(db);

  const tokens = new TokenService(jwtSecret, clock);
  const accessService = new AccessService(new PurchasesRepository(db), subscriptionsRepo, clock);
  const authService = new AuthService(usersRepo, tokens, clock);
  const accountService = new AccountService(accessService, clock);
  const bookService = new BookService(booksRepo, accessService, clock);
  const checkoutService = new CheckoutService(
    new OrdersRepository(db),
    new PlansRepository(db),
    booksRepo,
    accessService,
    gateway ?? new MockPaymentGateway(),
    clock,
  );
  const subscriptionService = new SubscriptionService(subscriptionsRepo, clock);
  const eventService = new EventService(new EventsRepository(db), booksRepo, clock);

  const app = new Hono<AppEnv>().basePath(BASE_PATH);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.use('*', cors({ origin: corsOrigin }));
  app.use('*', localeMiddleware);

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
  app.route('/me', accountRoutes(accountService));
  app.route('/me', meRoutes(authService));
  app.route('/books', booksRoutes(bookService));
  app.route('/creator', creatorRoutes(bookService));
  app.route('/plans', plansRoutes(checkoutService));
  app.route('/orders', ordersRoutes(checkoutService));
  app.route('/subscriptions', subscriptionsRoutes(subscriptionService));
  app.route('/events', eventsRoutes(eventService));
  if (devClock) app.route('/dev', devRoutes(devClock));

  return app;
}
