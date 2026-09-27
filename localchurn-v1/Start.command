#!/bin/bash
# Double-click in Finder to launch Butterchurn: starts a local web server for
# this folder and opens the control panel in your default browser.
# Close this Terminal window (or press Ctrl+C) to stop the server.

cd "$(dirname "$0")" || exit 1

# Prefer 8080: browser-saved settings (e.g. effects) are tied to the address,
# so a stable port keeps them between launches.
PORTS="8080 8081 8082 8083 8084 8085"

is_ours() {
  curl -s --max-time 1 "http://localhost:$1/effects.js" | grep -q "EffectsPass"
}

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

for PORT in $PORTS; do
  if is_ours "$PORT"; then
    echo "Butterchurn is already running at http://localhost:$PORT/ - opening it."
    open "http://localhost:$PORT/"
    exit 0
  fi
done

PORT=""
for CANDIDATE in $PORTS; do
  if ! port_in_use "$CANDIDATE"; then
    PORT=$CANDIDATE
    break
  fi
done

if [ -z "$PORT" ]; then
  echo "Couldn't find a free port ($PORTS are all in use)."
  read -r -p "Press Enter to close."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed to serve the app but wasn't found."
  echo "Install it from https://www.python.org/downloads/ and try again."
  read -r -p "Press Enter to close."
  exit 1
fi

# Bind to this machine only, so the server isn't reachable from the network.
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM HUP

# Wait for the server to come up before opening the browser.
for _ in $(seq 1 50); do
  if is_ours "$PORT"; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "The web server failed to start."
    read -r -p "Press Enter to close."
    exit 1
  fi
  sleep 0.1
done

open "http://localhost:$PORT/"

echo "Butterchurn is running at http://localhost:$PORT/"
echo
echo "If the display window doesn't appear, click \"Open display\" in the"
echo "control panel (or allow popups for localhost)."
echo
echo "Close this window or press Ctrl+C to stop."
wait "$SERVER_PID"
