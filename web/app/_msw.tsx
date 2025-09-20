'use client';

import { useEffect } from 'react';

// グローバルに安全なフラグを追加（型だけ）
declare global {
  interface Window {
    __MSW_STARTED__?: boolean;
  }
}

export default function MswBoot() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MOCK === '1' && typeof window !== 'undefined') {
      import('../mocks/browser').then(({ worker }) => {
        if (!window.__MSW_STARTED__) {
          window.__MSW_STARTED__ = true;
          // Promise を握りつぶさない（lint対策）
          void worker.start({ onUnhandledRequest: 'bypass' });
        }
      });
    }
  }, []);
  return null;
}
