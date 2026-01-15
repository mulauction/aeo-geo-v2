#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PORT="${PORT:-3001}"

echo "[dev-server] starting server on :$PORT"
node server/index.js
