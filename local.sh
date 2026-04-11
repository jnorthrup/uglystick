#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/graphique-2026"
DOCS_DIR="$SCRIPT_DIR/docs"

port_available() {
  python3 - "$1" "$2" <<'PY'
import socket
import sys

port = int(sys.argv[1])
host = sys.argv[2]

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    try:
        sock.bind((host, port))
    except OSError:
        sys.exit(1)
PY
}

case "$MODE" in
  dev)
    cd "$APP_DIR"
    PORT="${PORT:-3000}" bun run dev
    ;;
  ghpages|static)
    cd "$APP_DIR"
    rm -rf "$DOCS_DIR"
    mkdir -p "$DOCS_DIR"
    BUILD_DIR= "$APP_DIR/node_modules/.bin/next" build
    touch "$DOCS_DIR/.nojekyll"

    PORT="${PORT:-4173}"
    BIND="${BIND:-127.0.0.1}"
    START_PORT="$PORT"
    while ! port_available "$PORT" "$BIND"; do
      PORT=$((PORT + 1))
    done

    if [[ "$PORT" != "$START_PORT" ]]; then
      echo "Port $START_PORT is busy, using $PORT instead."
    fi

    echo "Serving preview at http://${BIND}:${PORT}/"
    cd "$DOCS_DIR"
    python3 -m http.server "$PORT" --bind "$BIND"
    ;;
  *)
    echo "Usage: $0 [dev|ghpages]" >&2
    exit 1
    ;;
esac
