'use client';
import React from 'react';

declare global {
  interface Window { __MSW_READY__?: boolean }
}

export default function MSW() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NEXT_PUBLIC_API_MOCK !== '1') return;

    import('../mocks/browser')
      .then(({ worker }) =>
        worker.start({
          onUnhandledRequest: 'bypass',
          serviceWorker: { url: '/mockServiceWorker.js' }
        })
      )
      .then(() => {
        window.__MSW_READY__ = true;
      })
      .catch(() => {});
  }, []);

  return null;
}
