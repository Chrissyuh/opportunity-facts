import "server-only";

export const SHARED_REDIS_TIMEOUT_MS = 1_500;

interface UpstashRestResponse {
  readonly result?: unknown;
  readonly error?: string;
}

export interface SharedRedis {
  command(command: readonly unknown[], signal?: AbortSignal): Promise<unknown>;
}

/** Minimal Upstash REST client shared by analysis caches, sessions, and admission control. */
export class UpstashRestRedis implements SharedRedis {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = SHARED_REDIS_TIMEOUT_MS,
  ) {}

  async command(command: readonly unknown[], signal?: AbortSignal): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: combinedSignal,
    });
    if (!response.ok) throw new SharedRedisUnavailableError();
    const payload = await response.json() as UpstashRestResponse;
    if (payload.error) throw new SharedRedisUnavailableError();
    return payload.result;
  }
}

export class SharedRedisUnavailableError extends Error {
  constructor() {
    super("Shared analysis controls are unavailable.");
    this.name = "SharedRedisUnavailableError";
  }
}

export function createSharedRedis(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = fetch,
): SharedRedis | null {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? new UpstashRestRedis(url, token, fetchImpl) : null;
}
