# Query Flags

Common flags you can combine in the URL.

| Flag | Example | Purpose |
|---|---|---|
| `test` | `?test=1` | Disable SW registration; expose debug vars; stub media |
| `mock` | `?mock=1` | Test API & mocks (enables `window.__testAPI.normalize`) |
| `seed` | `?seed=alpha` | Deterministic RNG |
| `qp` | `?qp=1` | Year-bucket order pipeline |
| `daily` | `?daily=1` / `?daily=2000-01-01` | 1-question mode (JST or fixed date) |
| `autostart` | `?autostart=0` | Require manual Start |
| `lhci` | `?lhci=1` | Stub media for Lighthouse |
| `nomedia` | `?nomedia=1` | Manually stub media |
| `lives` | `?lives=on` / `?lives=5` | End immediately when misses reach limit |
