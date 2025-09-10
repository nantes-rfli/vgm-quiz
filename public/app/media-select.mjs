// media-select.mjs
// Provider selection logic: Apple preference → YouTube fallback (+ ?provider override)
// Keep DOM-free and UI-agnostic to allow unit tests.
function q(name, d=location.search){ try{ return new URLSearchParams(d).get(name); }catch{ return null; } }

export function chooseProvider(media){
  const forced = (q('provider') || '').toLowerCase(); // dev flag: apple|youtube|auto
  if (forced === 'apple' || forced === 'itunes') return 'apple';
  if (forced === 'youtube' || forced === 'yt') return 'youtube';
  // auto
  if (media && media.apple && (media.apple.embedUrl || media.apple.previewUrl || media.apple.url)) return 'apple';
  return media && media.provider ? media.provider : 'youtube';
}

export function createMediaSelector(/* deps */){
  return {
    pickFor(trackOrMedia){
      const media = trackOrMedia && (trackOrMedia.media || trackOrMedia);
      return { provider: chooseProvider(media), media };
    },
    currentProvider(media){
      return chooseProvider(media && (media.media || media));
    }
  };
}

export default { createMediaSelector, chooseProvider };
