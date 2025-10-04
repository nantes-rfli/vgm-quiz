'use client';
import React from 'react';
import { useI18n } from '@/src/lib/i18n';
import { getInlinePlayback, setInlinePlayback } from '@/src/lib/inlinePlayback';
import { recordMetricsEvent } from '@/src/lib/metrics/metricsClient';

export default function InlinePlaybackToggle() {
  const { t } = useI18n();
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    setOn(getInlinePlayback());
  }, []);

  function toggle() {
    const v = !on;
    setOn(v);
    setInlinePlayback(v);
    recordMetricsEvent('settings_inline_toggle', {
      attrs: { enabled: v },
    });
  }

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <label htmlFor="inlinePlayback" className="text-foreground">{t('settings.inlinePlayback')}</label>
      <button
        id="inlinePlayback"
        type="button"
        onClick={toggle}
        className={`w-12 h-6 rounded-full transition ${on ? 'bg-primary' : 'bg-muted'}`}
        aria-pressed={on}
      >
        <span
          className={`block w-5 h-5 bg-background rounded-full transform transition ${on ? 'translate-x-6' : 'translate-x-1'} mt-0.5`}
        />
      </button>
    </div>
  );
}
