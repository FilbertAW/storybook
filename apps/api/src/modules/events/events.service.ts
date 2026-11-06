import type { CreateEventRequest } from '@storylib/shared';
import type { UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import type { BooksRepository } from '../books/books.repository';
import type { EventsRepository } from './events.repository';

export class EventService {
  constructor(
    private readonly events: EventsRepository,
    private readonly books: BooksRepository,
    private readonly clock: Clock,
  ) {}

  async log(user: UserRow, input: CreateEventRequest): Promise<void> {
    if (input.bookId && !(await this.books.findById(input.bookId))) {
      throw new AppError('NOT_FOUND', 'Book not found.');
    }
    await this.events.insert({
      userId: user.id,
      name: input.name,
      bookId: input.bookId ?? null,
      props: input.props ? JSON.stringify(input.props) : null,
      createdAt: this.clock.now(),
    });
  }
}
