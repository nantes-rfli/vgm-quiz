# vgm-quiz Makefile helpers
# Usage:
#   make publish   # build static site into public/
#   make smoke     # lightweight HTML contract test
#   make e2e       # run Playwright E2E locally (uses TEST_MODE + seed via test.js)
#   make trace     # open last Playwright trace.zip

.PHONY: publish smoke e2e trace

publish:
	clojure -T:build publish

smoke:
	npm run smoke

e2e:
	APP_URL="http://127.0.0.1:8080/app/" node e2e/test.js

trace:
        npx playwright show-trace artifacts/trace.zip
