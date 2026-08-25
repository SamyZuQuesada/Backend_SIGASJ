export const isTransientDbError = (error: unknown): boolean => {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      current = current.cause;
      continue;
    }

    parts.push(String(current));
    break;
  }

  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|Connection lost|ConnectionError|Failed to connect|Timeout/i.test(
    parts.join(' '),
  );
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts) {
        throw error;
      }

      await wait(400 * attempt);
    }
  }

  throw lastError;
}
