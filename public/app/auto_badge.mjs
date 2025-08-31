// AUTO mode badge: shows a small pill when ?auto=1 (or ?daily_auto=1) and __DAILY_AUTO_CHOSEN is present.
// A11y: role="status", aria-live polite, contrast-safe colors.

function isEnabled() {
  const sp = new URLSearchParams(location.search);
  return sp.get('auto') === '1' || sp.get('daily_auto') === '1';
}

function injectBadge(text = 'AUTO') {
  if (document.getElementById('auto-mode-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'auto-mode-badge';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.style.position = 'fixed';
  badge.style.top = '12px';
  badge.style.right = '12px';
  badge.style.zIndex = '9999';
  badge.style.padding = '4px 10px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '12px';
  badge.style.fontWeight = '700';
  badge.style.letterSpacing = '0.03em';
  badge.style.background = '#0ea5e9';   // sky-500
  badge.style.color = 'white';
  badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  badge.style.userSelect = 'none';
  badge.textContent = text;
  document.body.appendChild(badge);
}

function updateTooltip(entry) {
  const el = document.getElementById('auto-mode-badge');
  if (!el) return;
  if (entry) {
    el.title = `AUTO: ${entry.title} / ${entry.game} (${entry.composer})`;
  } else {
    el.title = 'AUTO mode';
  }
}

function bootstrap() {
  if (!isEnabled()) return;
  const tryShow = () => {
    const entry = (typeof window !== 'undefined') && window.__DAILY_AUTO_CHOSEN;
    injectBadge('AUTO');
    updateTooltip(entry || null);
  };
  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryShow);
  } else {
    tryShow();
  }
}

bootstrap();
