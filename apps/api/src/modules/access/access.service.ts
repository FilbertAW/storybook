import type { Access } from '@storylib/shared';
import type { UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import type { PurchasesRepository } from '../checkout/purchases.repository';
import type { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import {
  isSubscriptionActive,
  resolveAccess,
  type AccessBook,
  type AccessSubject,
} from './resolve-access';

export class AccessService {
  constructor(
    private readonly purchases: PurchasesRepository,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly clock: Clock,
  ) {}

  // Two small queries per request, however many books are being resolved.
  async subjectFor(user: UserRow): Promise<AccessSubject> {
    const [bookIds, subscription] = await Promise.all([
      this.purchases.listBookIds(user.id),
      this.subscriptions.findActive(user.id),
    ]);
    return {
      userId: user.id,
      purchasedBookIds: new Set(bookIds),
      subscription: subscription ?? null,
    };
  }

  resolve(subject: AccessSubject, book: AccessBook): Access | null {
    return resolveAccess(subject, book, this.clock.now());
  }

  // End of the subscription if it is still running, otherwise null.
  activeSubscriptionEnd(subject: AccessSubject): number | null {
    const sub = subject.subscription;
    return sub && isSubscriptionActive(sub, this.clock.now()) ? sub.currentPeriodEnd : null;
  }
}
