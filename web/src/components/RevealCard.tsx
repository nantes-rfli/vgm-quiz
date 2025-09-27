// Show reveal links with optional inline embed (YouTube supported)
import React from 'react';
import type { Reveal, RevealLink } from '@/src/features/quiz/api/types';
import type { Outcome } from '@/src/lib/resultStorage';
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

type ResultInfo = {
  outcome: Outcome;
  points: number;
  remainingMs: number;
  choiceLabel?: string;
  correctLabel?: string;
};

function outcomeText(outcome: Outcome): { label: string; className: string } {
  switch (outcome) {
    case 'correct':
      return { label: 'Correct', className: 'text-green-600' };
    case 'wrong':
      return { label: 'Wrong', className: 'text-red-600' };
    case 'timeout':
      return { label: 'Timeout', className: 'text-orange-500' };
    case 'skip':
      return { label: 'Skipped', className: 'text-gray-500' };
    default:
      return { label: outcome, className: 'text-gray-500' };
  }
}

function toSeconds(ms: number): number {
  return Math.max(0, Math.floor(ms / 1000));
}

export default function RevealCard({ reveal, result }: { reveal?: Reveal; result?: ResultInfo }) {
  const [inline] = React.useState<boolean>(getInlinePlayback());
  const primary = pickPrimaryLink(reveal);

  const embedUrl = primary?.provider === 'youtube' ? toYouTubeEmbed(primary.url) : null;

  const meta = reveal?.meta;
  const outcome = result ? outcomeText(result.outcome) : undefined;

  return (
    <div className="mt-6 bg-white rounded-2xl shadow p-6">
      {result ? (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
          <div className={`text-sm font-semibold ${outcome?.className ?? 'text-gray-600'}`}>{outcome?.label}</div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
            <span>Points {result.points}</span>
            <span>Remaining {toSeconds(result.remainingMs)}s</span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <div>Your answer: {result.choiceLabel ?? '—'}</div>
            {result.correctLabel ? <div>Correct answer: {result.correctLabel}</div> : null}
          </div>
        </div>
      ) : null}

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
      {meta ? (
        <div className="mb-3 text-sm text-gray-700">
          {meta.workTitle ? <div><span className="font-medium">Work:</span> {meta.workTitle}</div> : null}
          {meta.trackTitle ? <div><span className="font-medium">Track:</span> {meta.trackTitle}</div> : null}
          {meta.composer ? <div><span className="font-medium">Composer:</span> {meta.composer}</div> : null}
        </div>
      ) : null}
      {primary ? (
        <a
          href={primary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 rounded-xl bg-black text-white"
        >
          Open in {primary.provider}
        </a>
      ) : (
        <span className="text-sm text-gray-500">No links available</span>
      )}
    </div>
  );
}
