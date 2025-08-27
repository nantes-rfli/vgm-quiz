#!/bin/sh
mode="$1"
status=0

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1"
  status=1
}

optfail() {
  printf 'FAIL: %s (optional)\n' "$1"
}

case "$mode" in
  web)
    [ -f "public/index.html" ] && pass public/index.html || fail public/index.html
    [ -f "public/app.js" ] && pass public/app.js || fail public/app.js
    [ -f "public/app/sw.js" ] && pass public/app/sw.js || optfail public/app/sw.js
    [ -f "public/manifest.webmanifest" ] && pass public/manifest.webmanifest || optfail public/manifest.webmanifest
    ;;
  build)
    if [ -f "build.clj" ]; then
      pass build.clj
      grep -q "dataset_version" build.clj && pass "build.clj: dataset_version" || fail "build.clj: dataset_version"
      grep -q "publish" build.clj && pass "build.clj: publish" || fail "build.clj: publish"
      grep -q "track/id" build.clj && pass "build.clj: track/id" || fail "build.clj: track/id"
    else
      fail build.clj
    fi
    ;;
  aliases)
    if [ -f "public/build/aliases.json" ]; then
      pass public/build/aliases.json
    else
      optfail public/build/aliases.json
    fi
    if [ -f "public/app.js" ]; then
      if grep -q "aliases" public/app.js; then
        pass "public/app.js: aliases"
      else
        optfail "public/app.js: aliases"
      fi
    else
      optfail public/app.js
    fi
    ;;
  *)
    echo "usage: $0 {web|build|aliases}" >&2
    exit 2
    ;;
esac

exit $status
