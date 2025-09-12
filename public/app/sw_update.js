// SW update notifier & reload helper (progressive enhancement).
// Shows a small bottom banner when a new version is available.
// Accessible: role="status" aria-live="polite".
(function () {
  if (!('serviceWorker' in navigator)) return;

  function createBanner(reg) {
    const id = 'sw-update-banner';
    if (document.getElementById(id)) return null;

    const bar = document.createElement('div');
    bar.id = id;
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.setAttribute('data-testid', 'sw-update-banner');
    Object.assign(bar.style, {
      position: 'fixed',
      left: '16px',
      right: '16px',
      bottom: '16px',
      zIndex: 9999,
      background: 'rgba(20,20,20,0.92)',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 16px',
      boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, Helvetica, Arial',
      fontSize: '14px'
    });

    const msg = document.createElement('div');
    msg.textContent = '新しいバージョンが利用可能です。更新しますか？';
    msg.style.flex = '1';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '更新';
    btn.setAttribute('data-testid', 'sw-update-reload');
    Object.assign(btn.style, {
      appearance: 'none',
      background: '#10b981', // teal-500
      color: '#081c15',
      border: 'none',
      borderRadius: '10px',
      padding: '8px 12px',
      fontWeight: '600',
      cursor: 'pointer'
    });

    btn.addEventListener('click', async () => {
      try {
        // Ask SW to skip waiting if possible, then reload on controller change.
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (_) {}
      // If controller changes, the new SW has taken control.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
      // Fallback: reload anyway after short delay
      setTimeout(() => { if (!reloaded) location.reload(); }, 1500);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '後で';
    Object.assign(close.style, {
      appearance: 'none',
      background: 'transparent',
      color: '#d1d5db',
      border: '1px solid #374151',
      borderRadius: '10px',
      padding: '8px 12px',
      cursor: 'pointer'
    });
    close.addEventListener('click', () => bar.remove());

    bar.append(msg, btn, close);
    document.body.appendChild(bar);
    return bar;
  }

  function listenOnRegistration(reg) {
    if (!reg) return;
    // If already waiting, show banner immediately.
    if (reg.waiting) createBanner(reg);

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // New SW installed and waiting to activate (there is an existing controller)
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          createBanner(reg);
        }
      });
    });

    // Periodic manual check (does nothing harmful if SW handles polling)
    setInterval(() => reg.update().catch(() => {}), 60 * 1000);
  }

  // Wait until a registration exists (retry up to 30s)
  function waitForRegistration(timeoutMs = 30000, interval = 1000) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) return resolve(reg);
          if (Date.now() < deadline) setTimeout(tick, interval);
          else resolve(null);
        }).catch(() => {
          if (Date.now() < deadline) setTimeout(tick, interval);
          else resolve(null);
        });
      };
      tick();
    });
  }

  let attachedReg = null;
  function attach(reg) {
    if (!reg || reg === attachedReg) return;
    attachedReg = reg;
    listenOnRegistration(reg);
  }

  // Lazy attach: defer SW update wiring until idle or first interaction
  function __vgmquiz_sw_init__(){
    // Attach to any current registration
    navigator.serviceWorker.getRegistration().then(attach).catch(() => {});
    navigator.serviceWorker.ready.then(attach).catch(() => {});
    waitForRegistration().then(attach);
    window.addEventListener('sw-registered', (e) => attach(e.detail));

    // Also watch future registrations
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // No-op here; reload is handled on button click path.
    });
  }

  const __idle__ = (cb) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(cb, { timeout: 2500 });
    } else {
      requestAnimationFrame(() => setTimeout(cb, 0));
    }
  };

  let __armed__ = false;
  function __arm__(){
    if (__armed__) return;
    __armed__ = true;
    __idle__(__vgmquiz_sw_init__);
  }

  // First meaningful user interaction triggers immediately; otherwise idle fallback
  ['keydown','pointerdown','touchstart'].forEach(t =>
    window.addEventListener(t, __arm__, { once: true, passive: true })
  );
  setTimeout(__arm__, 1500);
})();

