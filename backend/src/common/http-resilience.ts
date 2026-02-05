/**
 * Retry with exponential backoff and optional circuit breaker.
 * Use for external API calls (Geo, Translation) to avoid cascading failures.
 */

const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 500;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60_000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; backoffMs?: number } = {},
): Promise<T> {
  const { retries = DEFAULT_RETRIES, backoffMs = DEFAULT_BACKOFF_MS } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureAt = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold = CIRCUIT_FAILURE_THRESHOLD,
    private readonly openMs = CIRCUIT_OPEN_MS,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureAt >= this.openMs) {
        this.state = 'half-open';
      } else {
        throw new Error('CircuitBreaker open');
      }
    }
    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.failures = 0;
        this.state = 'closed';
      }
      return result;
    } catch (e) {
      this.failures++;
      this.lastFailureAt = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      throw e;
    }
  }
}
