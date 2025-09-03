// JSON parse worker (module)
self.onmessage = (ev) => {
  try {
    const text = ev.data;
    const data = JSON.parse(text);
    self.postMessage({ ok: true, data });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
