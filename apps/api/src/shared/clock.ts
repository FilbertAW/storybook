export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

const DAY_MS = 24 * 60 * 60 * 1000;

// The system clock shifted forward, for demoing subscription expiry in development.
export class OffsetClock implements Clock {
  offsetDays = 0;

  now() {
    return Date.now() + this.offsetDays * DAY_MS;
  }
}
