import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { plans } from '../../db/schema';

export class PlansRepository {
  constructor(private readonly db: Db) {}

  listActive() {
    return this.db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.priceIdr));
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(plans).where(eq(plans.id, id));
    return row;
  }
}
