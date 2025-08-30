# Troubleshooting

## version.json shows 404 in Network

Cause: SW polling the wrong path under `/app` scope.  
Fix: The app→SW handshake sets the absolute URL; ensure you’re on the latest `sw.js` and reload/Update SW.

## `window.loadVersionPublic` is undefined

Cause: older `app.js`.  
Fix: hard-reload; verify in console `typeof window.loadVersionPublic === "function"`.

## YouTube embed says “動画を再生できません”

Cause: the video ID disallows embeds or has region restrictions.  
Fix: use an alternative ID; use the fallback “別ドメイン” button or “Open in YouTube” link.

## Same-seed but different order?

Verify you are checking after Start, and that `window.__rng` is `"function"`; use `?qp=1` and compare `window.__questionIds`.
