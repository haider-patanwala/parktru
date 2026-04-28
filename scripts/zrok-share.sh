#!/usr/bin/env bash
set -euo pipefail
ZROK_BIN="/opt/data/home/.local/opt/zrok/2.0.2/zrok2"
$ZROK_BIN share public http://127.0.0.1:3000 -n public:parktru --headless
