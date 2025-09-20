'use client';

import { useState } from 'react';

export default function PlayPage() {
  const [log, setLog] = useState<string>('');

  const callStart = async () => {
    const res = await fetch('/v1/rounds/start', { method: 'POST' });
    setLog(`${res.status} ${res.statusText}\n` + JSON.stringify(await res.json(), null, 2));
  };

  const callNext = async () => {
    const res = await fetch('/v1/rounds/next', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'tok_0001' }),
    });
    setLog(`${res.status} ${res.statusText}\n` + JSON.stringify(await res.json(), null, 2));
  };

  const sendMetrics = async () => {
    const res = await fetch('/v1/metrics', { method: 'POST', body: '[]' });
    setLog(`${res.status} ${res.statusText}`);
  };

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Play</h1>
      <div className="space-x-2">
        <button className="rounded px-3 py-1 border" onClick={callStart}>/v1/rounds/start</button>
        <button className="rounded px-3 py-1 border" onClick={callNext}>/v1/rounds/next</button>
        <button className="rounded px-3 py-1 border" onClick={sendMetrics}>/v1/metrics</button>
      </div>
      {log && <pre className="text-xs bg-black/5 p-3 rounded whitespace-pre-wrap">{log}</pre>}
    </main>
  );
}
