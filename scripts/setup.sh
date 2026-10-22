#!/usr/bin/env bash
#
# MMM-FastNotes setup:
#   1. Python virtualenv + dependencies
#   2. (optional, needs root) publish "notes.local" via mDNS and keep the
#      record in sync with the current IP of this machine.
#
# The web UI itself is started by the MagicMirror node_helper, no extra
# service/daemon is installed here.
#
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MODULE_DIR"

DISPATCHER_SOURCE="$MODULE_DIR/scripts/avahi-notes-dispatcher"
DISPATCHER_TARGET="/etc/NetworkManager/dispatcher.d/50-avahi-notes"
SERVICE_SOURCE="$MODULE_DIR/scripts/notes.service"
SERVICE_TARGET="/etc/avahi/services/notes.service"
SUDO=""

log()  { printf '%s\n' "$*"; }
warn() { printf '!!! %s\n' "$*" >&2; }

log "=== MMM-FastNotes Setup ==="

# ---------------------------------------------------------------- 1. Python
log "1. Python venv"
if [ ! -d .venv ]; then
  log "   Creating Python venv..."
  python3 -m venv .venv
fi

log "2. Python dependencies"
.venv/bin/pip install -q -r requirements.txt

# ---------------------------------------------------------------- 2. mDNS
log "3. mDNS name (notes.local)"
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1 && [ -t 0 ] && sudo -v 2>/dev/null; then
  SUDO="sudo"
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  SUDO="sudo"
fi

if [ -z "$SUDO" ]; then
  warn "No root permissions - skipping the 'notes.local' setup."
  warn "Without it the web UI is only reachable by IP (e.g. http://192.168.178.36:5000)."
  warn "To enable the name run this once:"
  warn ""
  warn "    sudo $MODULE_DIR/scripts/setup.sh"
  warn ""
  log "=== Setup complete (mDNS step skipped) ==="
  exit 0
fi

log "   Installing Avahi service definition..."
$SUDO install -o root -g root -m 644 "$SERVICE_SOURCE" "$SERVICE_TARGET"

log "   Installing NetworkManager dispatcher (keeps the IP in sync)..."
$SUDO install -o root -g root -m 755 "$DISPATCHER_SOURCE" "$DISPATCHER_TARGET"

log "   Publishing notes.local and reloading Avahi..."
$SUDO "$DISPATCHER_TARGET" "$(ip route show default 2>/dev/null | awk '{print $5; exit}')" up \
  || warn "Could not run the dispatcher hook - check $DISPATCHER_TARGET manually."

log "=== Setup complete ==="
