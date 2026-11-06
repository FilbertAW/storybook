import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import type { Scope } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const claimsSchema = z.object({
  sub: z.string(),
  scope: z.enum(['full', 'kid']),
});

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly clock: Clock,
  ) {}

  issue(userId: string, scope: Scope): Promise<string> {
    const exp = Math.floor(this.clock.now() / 1000) + TOKEN_TTL_SECONDS;
    return sign({ sub: userId, scope, exp }, this.secret, 'HS256');
  }

  async verify(token: string): Promise<{ sub: string; scope: Scope }> {
    try {
      return claimsSchema.parse(await verify(token, this.secret, 'HS256'));
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Please log in again.');
    }
  }
}
