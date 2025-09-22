'use client';
import React from 'react';
import { getInlinePlayback, setInlinePlayback } from '@/src/lib/inlinePlayback';

export default function InlinePlaybackToggle() {
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    setOn(getInlinePlayback());
  }, []);

  function toggle() {
    const v = !on;
    setOn(v);
    setInlinePlayback(v);
  }

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <label htmlFor="inlinePlayback" className="text-gray-700">Inline playback</label>
      <button
        id="inlinePlayback"
        type="button"
        onClick={toggle}
        className={`w-12 h-6 rounded-full transition ${on ? 'bg-black' : 'bg-gray-300'}`}
        aria-pressed={on}
      >
        <span
          className={`block w-5 h-5 bg-white rounded-full transform transition ${on ? 'translate-x-6' : 'translate-x-1'} mt-0.5`}
        />
      </button>
    </div>
  );
}
