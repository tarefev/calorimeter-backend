type Counter = { count: number; expiresAt: number };

export class InMemoryRateLimiter {
  private ipStore = new Map<string, Counter>();
  private emailStore = new Map<string, Counter>();

  // ip limit: 10 req / 60s
  consumeIp(
    key: string,
    limit = 10,
    windowMs = 60_000
  ): { allowed: boolean; retryAfterSec?: number } {
    const now = Date.now();
    const cur = this.ipStore.get(key);
    if (!cur || cur.expiresAt <= now) {
      this.ipStore.set(key, { count: 1, expiresAt: now + windowMs });
      return { allowed: true };
    }
    if (cur.count < limit) {
      cur.count += 1;
      return { allowed: true };
    }
    return {
      allowed: false,
      retryAfterSec: Math.ceil((cur.expiresAt - now) / 1000),
    };
  }

  // email failed login limit: 5 fails / 1h
  consumeFailedLogin(
    email: string,
    limit = 5,
    windowMs = 60 * 60_000
  ): { allowed: boolean; retryAfterSec?: number } {
    const now = Date.now();
    const cur = this.emailStore.get(email);
    if (!cur || cur.expiresAt <= now) {
      this.emailStore.set(email, { count: 1, expiresAt: now + windowMs });
      return { allowed: true };
    }
    if (cur.count < limit) {
      cur.count += 1;
      return { allowed: true };
    }
    return {
      allowed: false,
      retryAfterSec: Math.ceil((cur.expiresAt - now) / 1000),
    };
  }

  resetFailedLogin(email: string): void {
    this.emailStore.delete(email);
  }
}

export const rateLimiter = new InMemoryRateLimiter();
