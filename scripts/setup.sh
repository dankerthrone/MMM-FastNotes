#!/usr/bin/env bash
#
# MMM-FastNotes setup:
#   1. Python virtualenv + dependencies
#   2. Node dependencies (python-shell, sqlite3) + verify the native binding
#   3. (optional, needs root) advertise the web UI via DNS-SD and clean up
#      leftovers of the /etc/avahi/hosts alias approach
#
# The web UI itself is started by the MagicMirror node_helper, no extra
# service/daemon is installed here.
#
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MODULE_DIR"

SERVICE_SOURCE="$MODULE_DIR/scripts/notes.service"
SERVICE_TARGET="/etc/avahi/services/notes.service"
HOSTS_FILE="/etc/avahi/hosts"
DISPATCHER_TARGET="/etc/NetworkManager/dispatcher.d/50-avahi-notes"
SUDO=""

log()  { printf '%s\n' "$*"; }
warn() { printf '!!! %s\n' "$*" >&2; }

current_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]\{1,\}\).*/\1/p' | head -n 1
}

log "=== MMM-FastNotes Setup ==="

# ---------------------------------------------------------------- 1. Python
log "1. Python venv"
if [ ! -d .venv ]; then
  log "   Creating Python venv..."
  python3 -m venv .venv
fi

log "2. Python dependencies"
.venv/bin/pip install -q -r requirements.txt

# ------------------------------------------------------------- 3. Node deps
log "3. Node dependencies (python-shell, sqlite3)"
if ! command -v npm >/dev/null 2>&1; then
  warn "npm not found - cannot install the node dependencies."
  warn "MagicMirror² requires Node.js anyway, so this is unexpected."
  warn "Install Node.js/npm, then re-run:"
  warn ""
  warn "    $MODULE_DIR/scripts/setup.sh"
  warn ""
  exit 1
fi

# package.json sets allowScripts so sqlite3's native build is allowed to run
# (npm >= 11 gates install scripts and would otherwise skip it silently).
npm install --no-audit --no-fund

# Verify, don't assume: a sqlite3 install without a working native binding
# looks successful but leaves the module unable to read its notes database.
# Failing loudly here beats a mirror that quietly shows no notes.
if node -e "require('sqlite3')" >/dev/null 2>&1; then
  log "   sqlite3 native binding OK"
else
  warn "sqlite3 installed, but its native binding did NOT load."
  warn "Try an explicit rebuild, then verify:"
  warn ""
  warn "    cd $MODULE_DIR && npm rebuild sqlite3 && npm run check:sqlite"
  warn ""
  warn "If that fails you are likely missing build tools:"
  warn "Debian / Raspberry Pi OS: sudo apt install build-essential python3"
  warn "Arch / CachyOS:           sudo pacman -S base-devel python"
  warn ""
  exit 1
fi

# ---------------------------------------------------------------- 4. name
log "4. Web UI name / DNS-SD"
ROOT_OK=0
if [ "$(id -u)" -eq 0 ]; then
  ROOT_OK=1
  SUDO=""
elif command -v sudo >/dev/null 2>&1 && [ -t 0 ] && sudo -v 2>/dev/null; then
  ROOT_OK=1
  SUDO="sudo"
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  ROOT_OK=1
  SUDO="sudo"
fi

HOST="$(hostname)"
log "   Reachable as:    http://${HOST}.local:5000  (published by Avahi itself)"
[ -n "$(current_ip)" ] && log "   Reachable as:    http://$(current_ip):5000"

if [ "$ROOT_OK" -ne 1 ]; then
  warn "No root permissions - skipped the DNS-SD install and cleanup."
  warn "Everything above works without it. To install/clean up run once:"
  warn ""
  warn "    sudo $MODULE_DIR/scripts/setup.sh"
  warn ""
  log "=== Setup complete (name/DNS-SD step skipped) ==="
  exit 0
fi

CHANGED=0

# Old releases wrote "<ip> notes.local" into /etc/avahi/hosts. Avahi refuses a
# second local name for an address it already owns:
#   "Static host name notes.local: avahi_server_add_address failure: Local
#    name collision"
# Remove it so every avahi start stays quiet.
if [ -f "$HOSTS_FILE" ] && grep -q "notes\.local" "$HOSTS_FILE" 2>/dev/null; then
  log "   Removing the old notes.local entry from $HOSTS_FILE (causes 'Local name collision')"
  $SUDO sed -i "/notes\.local/d" "$HOSTS_FILE"
  CHANGED=1
fi

# Same for the dispatcher script that used to rewrite that entry (it would
# bring the collision back on every DHCP event).
if [ -f "$DISPATCHER_TARGET" ]; then
  log "   Removing the obsolete IP-sync dispatcher"
  $SUDO rm -f "$DISPATCHER_TARGET"
  CHANGED=1
fi

log "   Installing DNS-SD service definition (follows the system hostname)"
$SUDO install -o root -g root -m 644 "$SERVICE_SOURCE" "$SERVICE_TARGET"
CHANGED=1

if [ "$CHANGED" -eq 1 ]; then
  log "   Reloading avahi-daemon..."
  $SUDO systemctl try-restart avahi-daemon.service >/dev/null 2>&1 || true
fi

log ""
log "   One name per address: Avahi only publishes the system hostname for"
log "   this machine's IP. Want the web UI under a different name? Change it"
log "   once (the name then follows DHCP automatically, nothing to maintain):"
log ""
log "       sudo hostnamectl set-hostname notes      # -> http://notes.local:5000"
log ""
log "=== Setup complete ==="
