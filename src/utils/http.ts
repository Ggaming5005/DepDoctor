import { HTTP_TIMEOUT_MS, HTTP_MAX_RETRIES } from "../config/defaults.js";

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson<T>(
  url: string,
  options?: {
    timeout?: number;
    retries?: number;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const timeout = options?.timeout ?? HTTP_TIMEOUT_MS;
  const maxRetries = options?.retries ?? HTTP_MAX_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: options?.headers,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx errors (client errors)
      if (error instanceof HttpError && error.statusCode < 500) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) break;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
