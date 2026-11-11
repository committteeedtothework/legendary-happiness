#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -f DCSMCRAFT-Standalone.html ]; then
  export DCSMCRAFT_HTML="$PWD/DCSMCRAFT-Standalone.html"
else
  export DCSMCRAFT_HTML="$PWD/dist/DCSMCRAFT-Standalone.html"
fi
exec node server/public-relay.mjs
