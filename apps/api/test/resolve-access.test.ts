import { describe, expect, it } from 'vitest';
import {
  isSubscriptionActive,
  resolveAccess,
  type AccessBook,
  type AccessSubject,
  type SubscriptionInfo,
} from '../src/modules/access/resolve-access';

const NOW = 1_000_000;

const subject = (overrides: Partial<AccessSubject> = {}): AccessSubject => ({
  userId: 'reader',
  purchasedBookIds: new Set(),
  subscription: null,
  ...overrides,
});
const book = (overrides: Partial<AccessBook> = {}): AccessBook => ({
  id: 'book-1',
  creatorId: 'creator',
  status: 'published',
  ...overrides,
});
const subscription = (currentPeriodEnd: number, cancelAtPeriodEnd = false): SubscriptionInfo => ({
  planName: 'Monthly',
  currentPeriodEnd,
  cancelAtPeriodEnd,
});

describe('resolveAccess, first match wins', () => {
  describe('1. creator of the book', () => {
    it.each(['published', 'archived'] as const)('has full access to their own %s book', (status) => {
      const result = resolveAccess(subject({ userId: 'creator' }), book({ status }), NOW);
      expect(result).toEqual({ level: 'full', reason: 'owner' });
    });
  });

  describe('2. purchase', () => {
    it('gives full access to a published book', () => {
      const s = subject({ purchasedBookIds: new Set(['book-1']) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'full', reason: 'purchased' });
    });

    it('survives the creator archiving the book', () => {
      const s = subject({ purchasedBookIds: new Set(['book-1']) });
      expect(resolveAccess(s, book({ status: 'archived' }), NOW)).toEqual({ level: 'full', reason: 'purchased' });
    });

    it('outranks an active subscription, so the book shows as owned', () => {
      const s = subject({ purchasedBookIds: new Set(['book-1']), subscription: subscription(NOW + 1000) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'full', reason: 'purchased' });
    });

    it('does not carry over from a different book', () => {
      const s = subject({ purchasedBookIds: new Set(['another-book']) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'preview', reason: 'locked' });
    });
  });

  describe('3. archived', () => {
    it('is not found for someone who did not buy it', () => {
      expect(resolveAccess(subject(), book({ status: 'archived' }), NOW)).toBeNull();
    });

    it('stays hidden despite an active subscription', () => {
      const s = subject({ subscription: subscription(NOW + 1000) });
      expect(resolveAccess(s, book({ status: 'archived' }), NOW)).toBeNull();
    });
  });

  describe('4. active subscription', () => {
    it('gives full access while the period end is in the future', () => {
      const s = subject({ subscription: subscription(NOW + 1) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'full', reason: 'subscription' });
    });

    it('keeps access after cancelling until the period actually ends', () => {
      const s = subject({ subscription: subscription(NOW + 1000, true) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'full', reason: 'subscription' });
    });

    it('ends exactly at the period end (strictly later than now)', () => {
      const s = subject({ subscription: subscription(NOW) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'preview', reason: 'locked' });
    });

    it('treats a row still marked active but past its end as expired, with no cron needed', () => {
      const s = subject({ subscription: subscription(NOW - 1) });
      expect(resolveAccess(s, book(), NOW)).toEqual({ level: 'preview', reason: 'locked' });
      expect(isSubscriptionActive(s.subscription, NOW)).toBe(false);
    });

    it('is decided from the time passed in, so moving the clock moves access', () => {
      const s = subject({ subscription: subscription(NOW + 1000) });
      expect(resolveAccess(s, book(), NOW)?.reason).toBe('subscription');
      expect(resolveAccess(s, book(), NOW + 1000)?.reason).toBe('locked');
    });
  });

  describe('5. otherwise', () => {
    it('gives preview access, reason locked', () => {
      expect(resolveAccess(subject(), book(), NOW)).toEqual({ level: 'preview', reason: 'locked' });
    });
  });
});
