import type { Access, BookStatus } from '@storylib/shared';

export interface SubscriptionInfo {
  planName: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

// Everything the rules need to know about one user, loaded once per request.
export interface AccessSubject {
  userId: string;
  purchasedBookIds: ReadonlySet<string>;
  // The row still marked active. Whether it has run out is decided by date, here.
  subscription: SubscriptionInfo | null;
}

export interface AccessBook {
  id: string;
  creatorId: string;
  status: BookStatus;
}

export function isSubscriptionActive(subscription: SubscriptionInfo | null, now: number) {
  return subscription !== null && subscription.currentPeriodEnd > now;
}

// The only place access is decided. First match wins; null means "not found for
// this user", so a retired book never confirms it exists.
export function resolveAccess(subject: AccessSubject, book: AccessBook, now: number): Access | null {
  if (book.creatorId === subject.userId) return { level: 'full', reason: 'owner' };
  if (subject.purchasedBookIds.has(book.id)) return { level: 'full', reason: 'purchased' };
  if (book.status === 'archived') return null;
  if (isSubscriptionActive(subject.subscription, now)) {
    return { level: 'full', reason: 'subscription' };
  }
  return { level: 'preview', reason: 'locked' };
}
