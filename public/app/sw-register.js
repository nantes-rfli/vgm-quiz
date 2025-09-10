// Service Worker registration (extracted by v1.12 UI-slim Phase 1)
export async function registerSW(version, onWaiting) {
  try {
    const reg = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(version)}`);
    if (reg && reg.waiting) {
      try { onWaiting && onWaiting(); } catch {}
    }
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (reg.waiting) {
            try { onWaiting && onWaiting(); } catch {}
          }
        });
      }
    });
    return reg;
  } catch (e) {
    // ignore registration errors to keep app boot resilient
    return null;
  }
}
