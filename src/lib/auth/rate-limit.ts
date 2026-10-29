type Attempt = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function assertLoginAllowed(identifier: string) {
  const key = identifier.trim().toLowerCase();
  const now = Date.now();
  const attempt = attempts.get(key);

  if (!attempt || attempt.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (attempt.count >= MAX_ATTEMPTS) {
    throw new Error("Too many login attempts. Try again later.");
  }

  attempt.count += 1;
  attempts.set(key, attempt);
}

export function clearLoginAttempts(identifier: string) {
  attempts.delete(identifier.trim().toLowerCase());
}
