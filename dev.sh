#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON="$ROOT_DIR/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  printf 'Missing Python environment: %s\nInstall dependencies with: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt\n' "$PYTHON" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  printf 'npm is required to run the frontend.\n' >&2
  exit 1
fi
if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  printf 'Frontend dependencies are missing. Run: npm --prefix frontend install\n' >&2
  exit 1
fi
if ! command -v setsid >/dev/null 2>&1; then
  printf 'setsid is required to stop both dev servers cleanly.\n' >&2
  exit 1
fi

backend_pid=''
frontend_pid=''
cleanup() {
  trap - EXIT INT TERM
  [[ -z "$frontend_pid" ]] || kill -TERM -- "-$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || kill -TERM -- "-$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || wait "$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || wait "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Starting API at http://127.0.0.1:5001\n'
setsid "$PYTHON" backend/server.py &
backend_pid=$!

printf 'Starting web at http://127.0.0.1:5173\nPress Ctrl+C to stop both servers.\n'
setsid npm --prefix frontend run dev -- --host 127.0.0.1 --strictPort &
frontend_pid=$!

wait -n "$backend_pid" "$frontend_pid"
