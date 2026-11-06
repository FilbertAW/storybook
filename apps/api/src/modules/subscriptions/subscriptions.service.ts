import type { SubscriptionSummary } from '@storylib/shared';
import type { UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import { isSubscriptionActive, type SubscriptionInfo } from '../access/resolve-access';
import type { SubscriptionsRepository } from './subscriptions.repository';

export function toSubscriptionSummary(
  subscription: SubscriptionInfo | null,
  now: number,
): SubscriptionSummary {
  if (!subscription || !isSubscriptionActive(subscription, now)) {
    return { active: false, planName: null, endsAt: null, cancelAtPeriodEnd: false };
  }
  return {
    active: true,
    planName: subscription.planName,
    endsAt: new Date(subscription.currentPeriodEnd).toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export class SubscriptionService {
  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly clock: Clock,
  ) {}

  // Access continues until the period ends; nothing is refunded. Cancelling twice is a no-op.
  async cancel(user: UserRow): Promise<SubscriptionSummary> {
    const now = this.clock.now();
    const current = await this.subscriptions.findActive(user.id);
    if (!current || !isSubscriptionActive(current, now)) {
      throw new AppError('NO_ACTIVE_SUBSCRIPTION', 'There is no active subscription to cancel.');
    }
    if (!current.cancelAtPeriodEnd) await this.subscriptions.markCancelling(current.id);
    return toSubscriptionSummary({ ...current, cancelAtPeriodEnd: true }, now);
  }
}
