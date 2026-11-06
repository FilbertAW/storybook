import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { purchases } from '../../db/schema';

export class PurchasesRepository {
  constructor(private readonly db: Db) {}

  async listBookIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ bookId: purchases.bookId })
      .from(purchases)
      .where(eq(purchases.userId, userId));
    return rows.map((r) => r.bookId);
  }
}
