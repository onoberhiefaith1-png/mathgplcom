export class RequestTimeoutError extends Error {
  constructor(message = "This request took too long. Please try again.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

/** Bound UI-facing work so a delayed network request cannot hold the app forever. */
export async function withTimeout<T>(work: PromiseLike<T>, timeoutMs: number, message?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(message)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(work), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}