#!/bin/bash
# Double-click this file (or run ./start.command) to start Minute to Win It.
# It runs a small web server on this computer and opens the game in Brave.
# Close this window (or press Ctrl+C) to stop the server.

cd "$(dirname "$0")"
PORT=8060
URL="http://localhost:$PORT"

if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Minute to Win It is already running at $URL"
  open -a "Brave Browser" "$URL" 2>/dev/null || open "$URL"
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM
sleep 0.8

open -a "Brave Browser" "$URL" 2>/dev/null || open "$URL"
echo ""
echo "  Minute to Win It is running at $URL"
echo "  Leave this window open while you play. Close it to stop."
echo ""
wait $SERVER_PID
