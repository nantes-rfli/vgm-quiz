// Lightweight media player (YouTube only for now) with test/LHCI stubbing.

function secOf(ms) { return Math.max(0, Math.floor((ms || 0) / 1000)); }
function isFlagOn(name) {
  try {
    const v = new URLSearchParams(location.search).get(name);
    return v === '1' || v === 'true';
  } catch { return false; }
}

export function createMediaControl(media, opts = {}) {
  // media: { provider, id, start_ms?, duration_ms? }
  // opts: { testMode, lhciMode }
  const testMode = opts.testMode ?? isFlagOn('test');
  const lhciMode = opts.lhciMode ?? isFlagOn('lhci');
  const noMedia  = isFlagOn('nomedia');
  const stubOnly = testMode || lhciMode || noMedia;

  const root = document.createElement('div');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'audio preview');
  root.id = 'media-control';

  if (!media || !media.provider) {
    root.hidden = true;
    return root;
  }

  const btn = document.createElement('button');
  btn.textContent = '\u25B6\uFE0E \u518D\u751F\uFF08\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u5F37\u5316\uFF09';
  btn.setAttribute('data-testid', 'play-clip');
  btn.setAttribute('aria-label', '\u97F3\u6E90\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u518D\u751F\uFF08youtube-nocookie\uFF09');
  root.appendChild(btn);

  const alt = document.createElement('button');
  alt.textContent = '\u518D\u751F\u3067\u304D\u306A\u3044\uFF1F\uFF08\u5225\u30C9\u30E1\u30A4\u30F3\uFF09';
  alt.setAttribute('data-testid', 'play-clip-alt');
  alt.style.marginLeft = '8px';
  root.appendChild(alt);

  const slot = document.createElement('div');
  slot.id = 'media-embed-slot';
  slot.style.marginTop = '8px';
  root.appendChild(slot);

  const open = document.createElement('a');
  open.id = 'media-open-youtube';
  open.textContent = 'YouTube\u3067\u958B\u304F';
  open.target = '_blank';
  open.rel = 'noopener';
  open.style.display = 'inline-block';
  open.style.marginTop = '4px';
  open.href = media?.id ? `https://www.youtube.com/watch?v=${encodeURIComponent(media.id)}` : '#';
  root.appendChild(open);

  function embed(useNoCookie) {
    if (stubOnly) {
      // \u30c6\u30b9\u30c8/\u8a55\u4fa1\u6642\u306f\u5b9fiframe\u3092\u51fa\u3055\u305a\u306b\u30b9\u30bf\u30d6\u8868\u793a
      const stub = document.createElement('div');
      stub.id = 'media-stub';
      stub.textContent = '[media stub]';
      slot.replaceChildren(stub);
      window.__mediaPlayed = true;
      return;
    }
    if (media.provider === 'youtube' && media.id) {
      const start = secOf(media.start_ms);
      const end   = (media.duration_ms ? start + secOf(media.duration_ms) : undefined);
      const base  = (useNoCookie ? 'https://www.youtube-nocookie.com/embed/' : 'https://www.youtube.com/embed/')
                    + encodeURIComponent(media.id);
      const params = new URLSearchParams({
        autoplay: '1', controls: '0', modestbranding: '1', rel: '0',
        disablekb: '1', playsinline: '1', start: String(start || 0),
        origin: location.origin
      });
      if (end) params.set('end', String(end));
      const iframe = document.createElement('iframe');
      iframe.src = `${base}?${params.toString()}`;
      iframe.width = '320';
      iframe.height = '180';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.title = 'YouTube audio preview';
      iframe.setAttribute('frameborder', '0');
      slot.replaceChildren(iframe);
      window.__mediaPlayed = true;
    } else {
      const stub = document.createElement('div');
      stub.id = 'media-stub';
      stub.textContent = '[media unsupported]';
      slot.replaceChildren(stub);
      window.__mediaPlayed = true;
    }
  }

  btn.addEventListener('click', () => {
    embed(true); // \u307e\u305a\u306f nocookie \u30c9\u30e1\u30a4\u30f3
  }, { passive: true });

  alt.addEventListener('click', () => {
    embed(false); // youtube.com \u30c9\u30e1\u30a4\u30f3\u3067\u518d\u8a66\u884c
  }, { passive: true });

  return root;
}

export default { createMediaControl };

