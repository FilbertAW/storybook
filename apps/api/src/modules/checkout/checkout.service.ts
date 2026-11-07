import type { CreateOrderRequest, OrderDto, OrdersResponse, PlansResponse } from '@storylib/shared';
import type { UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import type { AccessService } from '../access/access.service';
import type { BooksRepository } from '../books/books.repository';
import type { OrderRow, OrdersRepository } from './orders.repository';
import type { PaymentGateway } from './payment-gateway';
import type { PlansRepository } from './plans.repository';

const iso = (ms: number) => new Date(ms).toISOString();

function toOrderDto(order: OrderRow): OrderDto {
  return {
    id: order.id,
    type: order.type,
    status: order.status,
    bookId: order.bookId,
    bookTitle: order.bookTitle,
    planId: order.planId,
    planName: order.planName,
    amountIdr: order.amountIdr,
    subscriptionOverlapAck: order.subscriptionOverlapAck,
    failureReason: order.failureReason,
    createdAt: iso(order.createdAt),
    paidAt: order.paidAt === null ? null : iso(order.paidAt),
  };
}

type OrderDraft =
  | { type: 'book'; bookId: string; amountIdr: number; subscriptionOverlapAck: boolean }
  | { type: 'subscription'; planId: string; amountIdr: number };

export class CheckoutService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly plans: PlansRepository,
    private readonly books: BooksRepository,
    private readonly access: AccessService,
    private readonly gateway: PaymentGateway,
    private readonly clock: Clock,
  ) {}

  async listPlans(): Promise<PlansResponse> {
    const rows = await this.plans.listActive();
    return {
      plans: rows.map((p) => ({ id: p.id, name: p.name, priceIdr: p.priceIdr, periodDays: p.periodDays })),
    };
  }

  async listOrders(user: UserRow): Promise<OrdersResponse> {
    return { orders: (await this.orders.listByUser(user.id)).map(toOrderDto) };
  }

  // The same Idempotency-Key returns the same order, so a double-click or a retry
  // after a dropped response never creates a second one.
  async createOrder(
    user: UserRow,
    idempotencyKey: string,
    request: CreateOrderRequest,
  ): Promise<{ order: OrderDto; created: boolean }> {
    const existing = await this.orders.findByKey(user.id, idempotencyKey);
    if (existing) {
      this.assertSameRequest(existing, request);
      return { order: toOrderDto(existing), created: false };
    }

    const draft =
      request.type === 'book' ? await this.draftBookOrder(user, request) : await this.draftSubscriptionOrder(user, request);
    const { order, created } = await this.orders.insertPending({
      ...draft,
      userId: user.id,
      idempotencyKey,
      status: 'pending',
      provider: this.gateway.name,
      createdAt: this.clock.now(),
    });
    if (!created) this.assertSameRequest(order, request);
    return { order: toOrderDto(order), created };
  }

  async pay(user: UserRow, orderId: string, simulate: 'success' | 'fail'): Promise<OrderDto> {
    const order = await this.orders.findOwned(orderId, user.id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found.');
    if (order.status === 'paid') return toOrderDto(order); // paying twice is a no-op
    if (order.status === 'failed') {
      throw new AppError('ORDER_NOT_PENDING', 'This order has already failed. Start a new one to retry.');
    }

    const result = await this.gateway.charge({ orderId: order.id, amountIdr: order.amountIdr, simulate });
    if (result.status === 'failed') {
      if (await this.orders.markFailed(order.id, result.reason)) {
        throw new AppError('PAYMENT_FAILED', 'Your payment did not go through.', { orderId: order.id });
      }
      return this.settledOrConflict(user, order.id);
    }

    const plan = order.planId ? await this.plans.findById(order.planId) : undefined;
    const outcome = await this.orders.settlePaid({
      order,
      providerRef: result.providerRef,
      now: this.clock.now(),
      periodDays: plan?.periodDays,
    });
    if (outcome === 'already_owned' || outcome === 'already_subscribed') {
      // Another order granted this first. This one will never be payable, so close it.
      await this.orders.markFailed(order.id, 'Already owned or subscribed when payment completed.');
      throw new AppError(
        outcome === 'already_owned' ? 'ALREADY_OWNED' : 'ALREADY_SUBSCRIBED',
        outcome === 'already_owned' ? 'You already own this book.' : 'You already have an active subscription.',
      );
    }
    return this.settledOrConflict(user, order.id);
  }

  // A concurrent request may have settled the order first; report what is true now.
  private async settledOrConflict(user: UserRow, orderId: string): Promise<OrderDto> {
    const order = await this.orders.findOwned(orderId, user.id);
    if (order?.status === 'paid') return toOrderDto(order);
    throw new AppError('ORDER_NOT_PENDING', 'This order is no longer pending.');
  }

  private async draftBookOrder(
    user: UserRow,
    request: Extract<CreateOrderRequest, { type: 'book' }>,
  ): Promise<OrderDraft> {
    const book = await this.books.findById(request.bookId);
    if (!book) throw new AppError('NOT_FOUND', 'Book not found.');

    const subject = await this.access.subjectFor(user);
    if (book.creatorId === user.id || subject.purchasedBookIds.has(book.id)) {
      throw new AppError('ALREADY_OWNED', 'You already own this book.');
    }
    if (book.status !== 'published') {
      throw new AppError('BOOK_NOT_PURCHASABLE', 'This book is not available to buy.');
    }

    const subscriptionEnd = this.access.activeSubscriptionEnd(subject);
    if (subscriptionEnd !== null && !request.acknowledgeSubscriptionOverlap) {
      throw new AppError(
        'SUBSCRIPTION_OVERLAP_ACK_REQUIRED',
        'You already have an active subscription. Confirm that you still want to buy this book.',
        { subscriptionEndsAt: iso(subscriptionEnd) },
      );
    }
    return {
      type: 'book',
      bookId: book.id,
      amountIdr: book.priceIdr,
      subscriptionOverlapAck: subscriptionEnd !== null,
    };
  }

  private async draftSubscriptionOrder(
    user: UserRow,
    request: Extract<CreateOrderRequest, { type: 'subscription' }>,
  ): Promise<OrderDraft> {
    const plan = await this.plans.findById(request.planId);
    if (!plan || !plan.isActive) throw new AppError('NOT_FOUND', 'Plan not found.');

    const subscriptionEnd = this.access.activeSubscriptionEnd(await this.access.subjectFor(user));
    if (subscriptionEnd !== null) {
      throw new AppError('ALREADY_SUBSCRIBED', 'You already have an active subscription.', {
        subscriptionEndsAt: iso(subscriptionEnd),
      });
    }
    return { type: 'subscription', planId: plan.id, amountIdr: plan.priceIdr };
  }

  private assertSameRequest(order: OrderRow, request: CreateOrderRequest) {
    const same =
      request.type === 'book'
        ? order.type === 'book' && order.bookId === request.bookId
        : order.type === 'subscription' && order.planId === request.planId;
    if (!same) {
      throw new AppError('VALIDATION_ERROR', 'This Idempotency-Key was already used for a different order.');
    }
  }
}
