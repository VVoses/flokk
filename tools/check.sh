#!/bin/sh
# syntax-check every script, then load and start the game headless
cd "$(dirname "$0")/.." || exit 1
ok=0;for f in js/*.js;do node --check "$f" || ok=1;done
[ $ok -eq 0 ] && echo "syntax ok"
python3 tools/smoke.py
