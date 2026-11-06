import type { Db } from '../../db/client';
import { events } from '../../db/schema';

export class EventsRepository {
  constructor(private readonly db: Db) {}

  async insert(values: typeof events.$inferInsert) {
    await this.db.insert(events).values(values);
  }
}
