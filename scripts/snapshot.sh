#!/bin/sh
set -eu

OUT=site
rm -rf "$OUT"
mkdir -p "$OUT"

files="build.clj deps.edn PROJECT_STATUS.md README.md .github/workflows/ci.yml public/index.html public/app.js public/app/sw.js public/manifest.webmanifest"

for dir in src test; do
  if [ -d "$dir" ]; then
    files="$files $(find "$dir" -type f -name '*.clj' | sort)"
  fi
done

included=""

for f in $files; do
  if [ -f "$f" ]; then
    included="$included $f"
    rel=$(printf '%s' "$f" | sed 's#^\.##')
    html="$OUT/$rel.html"
    mkdir -p "$(dirname "$html")"
    {
      printf '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>%s</title><style> pre{white-space:pre-wrap; word-wrap:break-word;} code{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;} </style></head><body><pre><code>' "$f"
      sed -e 's/&/&amp;/g; s/</&lt;/g; s/>/&gt;/g; s/"/&quot;/g' "$f"
      printf '</code></pre></body></html>\n'
    } > "$html"
  fi
done

commit=$(git rev-parse --short HEAD 2>/dev/null || echo "")
{
  printf '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Snapshot</title><style> pre{white-space:pre-wrap; word-wrap:break-word;} code{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;} </style></head><body>\n'
  printf '<h1>Code Snapshot</h1>\n'
  if [ -n "$commit" ]; then
    printf '<p>Commit: %s</p>\n' "$commit"
  fi
  printf '<ul>\n'
  for f in $included; do
    rel=$(printf '%s' "$f" | sed 's#^\.##')
    link="$rel.html"
    text=$(printf '%s' "$f" | sed 's/&/&amp;/g; s/</&lt;/g; s/>/&gt;/g; s/"/&quot;/g')
    printf '<li><a href="%s">%s</a></li>\n' "$link" "$text"
  done
  printf '</ul>\n'
  printf '</body></html>\n'
} > "$OUT/index.html"

mkdir -p "$OUT/app"
cp -r public/* "$OUT/app/"
