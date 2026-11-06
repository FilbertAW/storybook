import type { AuthResponse, SetPinResponse, UserDto } from '@storylib/shared';
import type { Scope, UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import { hashPin, verifyPin } from '../../shared/pin';
import type { TokenService } from './token.service';
import type { UsersRepository } from './users.repository';

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;

export function toUserDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly clock: Clock,
  ) {}

  async login(email: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) throw new AppError('NOT_FOUND', 'No account uses that email.');
    return this.session(user, 'full');
  }

  async enterKidMode(user: UserRow): Promise<AuthResponse> {
    if (!user.pinHash) {
      throw new AppError('PIN_NOT_SET', 'Set a PIN before using Kid mode.');
    }
    return this.session(user, 'kid');
  }

  async parentUnlock(user: UserRow, pin: string): Promise<AuthResponse> {
    await this.checkPin(user, pin);
    return this.session(user, 'full');
  }

  async setPin(user: UserRow, pin: string, currentPin?: string): Promise<SetPinResponse> {
    if (user.pinHash) {
      if (!currentPin) throw new AppError('PIN_INVALID', 'Enter your current PIN to change it.');
      await this.checkPin(user, currentPin);
    }
    await this.users.setPin(user.id, hashPin(pin));
    return { pinSet: true };
  }

  private async session(user: UserRow, scope: Scope): Promise<AuthResponse> {
    return { token: await this.tokens.issue(user.id, scope), user: toUserDto(user) };
  }

  // Shared by unlock and PIN change. The attempt counter lives in the database,
  // so it holds across serverless invocations.
  private async checkPin(user: UserRow, pin: string): Promise<void> {
    const now = this.clock.now();
    if (user.pinLockedUntil !== null && user.pinLockedUntil > now) {
      throw this.locked(user.pinLockedUntil);
    }
    if (!user.pinHash) throw new AppError('PIN_NOT_SET', 'Set a PIN first.');

    if (verifyPin(pin, user.pinHash)) {
      if (user.pinFailedAttempts > 0 || user.pinLockedUntil !== null) {
        await this.users.resetPinFailures(user.id);
      }
      return;
    }

    const attempts = await this.users.incrementPinFailures(user.id);
    if (attempts >= MAX_PIN_ATTEMPTS) {
      const until = now + PIN_LOCK_MS;
      await this.users.lockPin(user.id, until);
      throw this.locked(until);
    }
    throw new AppError('PIN_INVALID', 'That PIN is not correct.', {
      attemptsRemaining: MAX_PIN_ATTEMPTS - attempts,
    });
  }

  private locked(until: number) {
    return new AppError('PIN_LOCKED', 'Too many wrong PIN attempts. Try again in a few minutes.', {
      retryAt: new Date(until).toISOString(),
    });
  }
}
