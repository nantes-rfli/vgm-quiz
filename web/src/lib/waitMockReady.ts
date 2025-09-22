// Path: web/src/lib/waitMockReady.ts
type MswWindow = Window & { __MSW_READY__?: boolean };

export async function waitMockReady(opts: { timeoutMs?: number; pollMs?: number } = {}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_API_MOCK !== '1') return;

  const timeoutMs = opts.timeoutMs ?? 2000;
  const pollMs = opts.pollMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if ((window as MswWindow).__MSW_READY__ === true) {
      return;
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
  // proceed even if flag not seen; retry-on-404 path will handle the rest
}
