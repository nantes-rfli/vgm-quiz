// Show reveal links with optional inline embed (YouTube supported)
import React from 'react';
import type { Reveal, RevealLink } from '@/src/features/quiz/api/types';
import { getInlinePlayback } from '@/src/lib/inlinePlayback';

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === 'youtu.be' && u.pathname.length > 1) {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}`;
    }
    // www.youtube.com/watch?v=<id>
    if (u.hostname.endsWith('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

function pickPrimaryLink(reveal?: Reveal): RevealLink | undefined {
  const links = reveal?.links ?? [];
  // Prefer youtube for inline
  const yt = links.find(l => l.provider === 'youtube');
  return yt ?? links[0];
}

export default function RevealCard({ reveal }: { reveal?: Reveal }) {
  const [inline] = React.useState<boolean>(getInlinePlayback());
  const primary = pickPrimaryLink(reveal);

  if (!primary) {
    return null;
  }

  const embedUrl = primary.provider === 'youtube' ? toYouTubeEmbed(primary.url) : null;

  return (
    <div className="mt-6 bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold mb-3">Listen / Watch</h2>
      {inline && embedUrl ? (
        <div className="aspect-video w-full mb-3">
          <iframe
            src={embedUrl}
            title="Player"
            className="w-full h-full rounded-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : null}
      <a
        href={primary.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 rounded-xl bg-black text-white"
      >
        Open in {primary.provider}
      </a>
    </div>
  );
}
