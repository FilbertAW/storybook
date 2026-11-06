import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';

export class UsersRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    return row;
  }

  async findByEmail(email: string) {
    const [row] = await this.db.select().from(users).where(eq(users.email, email));
    return row;
  }

  async setPin(id: string, pinHash: string) {
    await this.db
      .update(users)
      .set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null })
      .where(eq(users.id, id));
  }

  // Increments in SQL so concurrent wrong guesses cannot undercount.
  async incrementPinFailures(id: string): Promise<number> {
    const [row] = await this.db
      .update(users)
      .set({ pinFailedAttempts: sql`${users.pinFailedAttempts} + 1` })
      .where(eq(users.id, id))
      .returning({ attempts: users.pinFailedAttempts });
    return row!.attempts;
  }

  async lockPin(id: string, until: number) {
    await this.db
      .update(users)
      .set({ pinLockedUntil: until, pinFailedAttempts: 0 })
      .where(eq(users.id, id));
  }

  async resetPinFailures(id: string) {
    await this.db
      .update(users)
      .set({ pinFailedAttempts: 0, pinLockedUntil: null })
      .where(eq(users.id, id));
  }
}
