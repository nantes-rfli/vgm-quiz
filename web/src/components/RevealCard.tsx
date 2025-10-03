// Show reveal links with optional inline embed (YouTube supported)
import React from 'react';
import type { Reveal, RevealLink } from '@/src/features/quiz/api/types';
import type { Outcome } from '@/src/lib/resultStorage';
import { getInlinePlayback } from '@/src/lib/inlinePlayback';
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient';
import { msToSeconds } from '@/src/lib/timeUtils';
import { getOutcomeDisplay } from '@/src/lib/outcomeUtils';

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

type RevealTelemetry = {
  roundId?: string;
  questionIdx?: number;
  questionId?: string;
};

export default function RevealCard({ reveal, result, telemetry }: { reveal?: Reveal; result?: ResultInfo; telemetry?: RevealTelemetry }) {
  const [inline] = React.useState<boolean>(getInlinePlayback());
  const primary = pickPrimaryLink(reveal);

  const embedUrl = primary?.provider === 'youtube' ? toYouTubeEmbed(primary.url) : null;

  const meta = reveal?.meta;
  const outcome = result ? getOutcomeDisplay(result.outcome) : undefined;
  const [fallbackLogged, setFallbackLogged] = React.useState(false);
  const [errorLogged, setErrorLogged] = React.useState(false);

  React.useEffect(() => {
    setFallbackLogged(false);
    setErrorLogged(false);
  }, [reveal?.questionId, telemetry?.questionId]);

  React.useEffect(() => {
    if (!inline) {
      setFallbackLogged(false);
      return;
    }
    if (!primary) return;
    if (embedUrl) {
      setFallbackLogged(false);
      return;
    }
    if (fallbackLogged) return;
    recordMetricsEvent('embed_fallback_to_link', {
      roundId: telemetry?.roundId,
      questionIdx: telemetry?.questionIdx,
      attrs: {
        questionId: telemetry?.questionId,
        provider: primary.provider,
        reason: 'no_embed_available',
      },
    });
    setFallbackLogged(true);
  }, [inline, primary, embedUrl, fallbackLogged, telemetry?.roundId, telemetry?.questionIdx, telemetry?.questionId]);

  const handleEmbedError = React.useCallback(() => {
    if (errorLogged || !primary) return;
    setErrorLogged(true);
    recordMetricsEvent('embed_error', {
      roundId: telemetry?.roundId,
      questionIdx: telemetry?.questionIdx,
      attrs: {
        questionId: telemetry?.questionId,
        provider: primary.provider,
        reason: 'load_error',
      },
    });
  }, [errorLogged, primary, telemetry?.roundId, telemetry?.questionIdx, telemetry?.questionId]);

  const handleExternalClick = React.useCallback(() => {
    if (!primary) return;
    recordMetricsEvent('reveal_open_external', {
      roundId: telemetry?.roundId,
      questionIdx: telemetry?.questionIdx,
      attrs: {
        questionId: telemetry?.questionId,
        provider: primary.provider,
      },
    });
  }, [primary, telemetry?.roundId, telemetry?.questionIdx, telemetry?.questionId]);

  return (
    <div className="mt-6 bg-white rounded-2xl shadow p-6">
      {result ? (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
          <div className={`text-sm font-semibold ${outcome?.className ?? 'text-gray-600'}`}>{outcome?.label}</div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
            <span>Points {result.points}</span>
            <span>Remaining {msToSeconds(result.remainingMs)}s</span>
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
            onError={handleEmbedError}
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
          onClick={handleExternalClick}
        >
          Open in {primary.provider}
        </a>
      ) : (
        <span className="text-sm text-gray-500">No links available</span>
      )}
    </div>
  );
}
