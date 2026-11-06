import type { MeResponse } from '@storylib/shared';
import type { UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import type { AccessService } from '../access/access.service';
import { toUserDto } from '../auth/auth.service';
import { toSubscriptionSummary } from '../subscriptions/subscriptions.service';

export class AccountService {
  constructor(
    private readonly access: AccessService,
    private readonly clock: Clock,
  ) {}

  async me(user: UserRow): Promise<MeResponse> {
    const subject = await this.access.subjectFor(user);
    return {
      user: toUserDto(user),
      pinSet: user.pinHash !== null,
      subscription: toSubscriptionSummary(subject.subscription, this.clock.now()),
      ownedBookIds: [...subject.purchasedBookIds],
    };
  }
}
