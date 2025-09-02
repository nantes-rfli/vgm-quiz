// Media player: Apple Music preview > YouTube fallback (+ test/LHCI stubbing)
function secOf(ms) { return Math.max(0, Math.floor((ms || 0) / 1000)); }
function q(name, d=location.search){ try{ return new URLSearchParams(d).get(name); }catch{ return null; } }
function isFlagOn(name) { const v = q(name); return v === '1' || v === 'true'; }

function chooseProvider(media){
  const forced = (q('provider') || '').toLowerCase(); // dev flag: apple|youtube|auto
  if (forced === 'apple' || forced === 'itunes') return 'apple';
  if (forced === 'youtube' || forced === 'yt') return 'youtube';
  // auto
  if (media && media.apple && (media.apple.embedUrl || media.apple.previewUrl)) return 'apple';
  return media && media.provider ? media.provider : 'youtube';
}

function buildAppleEmbed(media){
  const root = document.createElement('div');
  root.id = 'media-root';
  root.dataset.provider = 'apple';
  root.setAttribute('role','group');
  root.setAttribute('aria-label','Media player (Apple Music)');
  const slot = document.createElement('div'); slot.id = 'media-slot'; root.appendChild(slot);

  const stubOnly = isFlagOn('test') || isFlagOn('lhci') || isFlagOn('nomedia');
  if (stubOnly){
    const stub = document.createElement('div');
    stub.id = 'media-stub';
    stub.textContent = '[media stub: apple]';
    slot.replaceChildren(stub);
    window.__mediaPlayed = true;
    return root;
  }

  // Prefer official embed
  const embedUrl = media.apple && media.apple.embedUrl;
  const previewUrl = media.apple && media.apple.previewUrl;
  if (embedUrl){
    const iframe = document.createElement('iframe');
    iframe.id = 'apple-music-embed';
    iframe.allow = 'autoplay *; encrypted-media *;';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    // start param is not officially supported on Apple embed; use default playback.
    iframe.src = embedUrl;
    iframe.style.width = '100%';
    iframe.style.height = '150px';
    iframe.style.border = '0';
    slot.replaceChildren(iframe);
  } else if (previewUrl){
    const audio = document.createElement('audio');
    audio.id = 'apple-music-preview';
    audio.controls = true;
    audio.preload = 'none';
    audio.src = previewUrl;
    // Seek to start if provided
    if (media.start_ms) {
      audio.addEventListener('loadedmetadata', () => { try{ audio.currentTime = secOf(media.start_ms); }catch{} });
    }
    slot.replaceChildren(audio);
  } else {
    // Fallback to text if apple data missing
    const note = document.createElement('div');
    note.textContent = 'Apple Music preview not available.';
    slot.replaceChildren(note);
  }

  const open = document.createElement('a');
  open.id = 'media-open-original';
  open.target = '_blank'; open.rel = 'noopener';
  open.style.display = 'inline-block'; open.style.marginTop = '4px';
  open.textContent = 'Open in Apple Music';
  open.href = (media.apple && media.apple.url) || (media.apple && media.apple.embedUrl) || '#';
  root.appendChild(open);
  return root;
}

function buildYouTubeEmbed(media){
  const root = document.createElement('div');
  root.id = 'media-root';
  root.dataset.provider = 'youtube';
  root.setAttribute('role','group');
  root.setAttribute('aria-label','Media player (YouTube)');
  const slot = document.createElement('div'); slot.id = 'media-slot'; root.appendChild(slot);

  const stubOnly = isFlagOn('test') || isFlagOn('lhci') || isFlagOn('nomedia');
  if (stubOnly){
    const stub = document.createElement('div');
    stub.id = 'media-stub';
    stub.textContent = '[media stub: youtube]';
    slot.replaceChildren(stub);
    window.__mediaPlayed = true;
    return root;
  }

  const start = secOf(media.start_ms);
  const nocookie = true;
  const base = nocookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  const iframe = document.createElement('iframe');
  iframe.id = 'youtube-embed';
  iframe.width = '560'; iframe.height = '315';
  iframe.src = `${base}/embed/${encodeURIComponent(media.id)}?autoplay=1&start=${start}`;
  iframe.title = 'YouTube video player';
  iframe.frameBorder = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  slot.replaceChildren(iframe);

  const open = document.createElement('a');
  open.id = 'media-open-original';
  open.target = '_blank'; open.rel = 'noopener';
  open.style.display = 'inline-block'; open.style.marginTop = '4px';
  open.textContent = 'Open on YouTube';
  open.href = media?.id ? `https://www.youtube.com/watch?v=${encodeURIComponent(media.id)}` : '#';
  root.appendChild(open);
  return root;
}

export function createMediaControl(media, opts = {}){
  // media: { provider?, id?, start_ms?, duration_ms?, apple?: { embedUrl?, previewUrl?, url? } }
  // opts preserved for compatibility (testMode/lhciMode handled by flags)
  const prov = chooseProvider(media);
  return prov === 'apple' ? buildAppleEmbed(media) : buildYouTubeEmbed(media);
}

export default { createMediaControl };

