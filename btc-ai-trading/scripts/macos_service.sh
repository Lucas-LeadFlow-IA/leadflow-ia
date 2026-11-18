#!/usr/bin/env bash
# =============================================================================
#  BTC AI Trading — run automatically on macOS (launchd user agent)
#
#  ./scripts/macos_service.sh install     setup if needed + start now + start at every login
#  ./scripts/macos_service.sh status      launchd state + /api/health + dashboard token
#  ./scripts/macos_service.sh logs        follow the logs (Ctrl+C to quit)
#  ./scripts/macos_service.sh stop        stop until the next login (or `start`)
#  ./scripts/macos_service.sh start       start / restart now
#  ./scripts/macos_service.sh uninstall   stop and remove the automatic start
#  ./scripts/macos_service.sh print-plist show the launchd file without installing it
#
#  Safety:
#  * only PAPER and TESTNET can be automated. LIVE is refused: it needs a human
#    at a terminal typing a random code (docs/GO_LIVE.md), by design.
#  * restarts on crash only (KeepAlive/SuccessfulExit=false); a manual stop stays stopped.
#  * the kill switch state is persisted in runtime/: a restart never un-halts it.
#  * the Mac is kept awake while the bot runs (caffeinate -i). Closing the lid on
#    battery still puts it to sleep: the bot then pauses and resumes on wake.
# =============================================================================
set -euo pipefail

LABEL="com.btc-ai-trading.bot"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/service.log"
PY="$ROOT/.venv/bin/python"
DOMAIN="gui/$(id -u)"

say()  { printf '\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\033[31mERREUR : %s\033[0m\n' "$*" >&2; exit 1; }

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || die "ce script est pour macOS (launchd). Sur Linux, utilisez Docker : docker compose up -d"
}

# Read a KEY=value from .env (last occurrence wins, quotes and comments stripped).
env_value() {
  local key="$1" file="$ROOT/.env"
  [[ -f "$file" ]] || return 0
  { grep -i -E "^[[:space:]]*${key}[[:space:]]*=" "$file" || true; } | tail -n 1 | cut -d= -f2- \
    | sed -e 's/[[:space:]]#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

xml_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<<"$1"; }

plist_content() {
  local root py log path
  root="$(xml_escape "$ROOT")"; py="$(xml_escape "$PY")"; log="$(xml_escape "$LOG_FILE")"
  # caffeinate -w keeps the Mac awake while the bot's PID lives; `exec` keeps that PID,
  # so launchd's SIGTERM reaches Python directly (clean shutdown).
  runner="$(xml_escape '/usr/bin/caffeinate -i -w $$ & exec "$0" main.py run')"
  path="$(xml_escape "$ROOT/.venv/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin")"
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>$runner</string>
    <string>$py</string>
  </array>
  <key>WorkingDirectory</key><string>$root</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$path</string>
    <key>PYTHONUNBUFFERED</key><string>1</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ExitTimeOut</key><integer>60</integer>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
EOF
}

setup_if_needed() {
  cd "$ROOT"
  if [[ ! -f .env ]]; then
    cp .env.example .env
    say "• .env créé à partir de .env.example (mode PAPER, aucune clé)."
  fi
  if [[ ! -x "$PY" ]]; then
    local base="" cand
    for cand in python3.13 python3.12 python3.11 python3; do
      if command -v "$cand" >/dev/null && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
        base="$cand"; break
      fi
    done
    [[ -n "$base" ]] || die "Python ≥ 3.11 introuvable (macOS fournit souvent 3.9). Installez-le : brew install python@3.13 (ou https://www.python.org), puis relancez."
    say "• Création de l'environnement Python (.venv) avec $("$base" --version)…"
    "$base" -m venv .venv
  fi
  if ! "$PY" -c "import fastapi, uvicorn, hyperliquid, sklearn" >/dev/null 2>&1; then
    say "• Installation des dépendances Python (quelques minutes la première fois)…"
    "$PY" -m pip install --quiet --upgrade pip
    "$PY" -m pip install --quiet -r requirements.txt
  fi
  if [[ ! -f dashboard/web/out/index.html ]]; then
    if command -v npm >/dev/null; then
      say "• Construction du dashboard (npm)…"
      (cd dashboard/web && npm ci --no-audit --no-fund --silent && NEXT_TELEMETRY_DISABLED=1 npx next build >/dev/null)
    else
      say "• npm introuvable : le bot tournera sans pages web (API seule). Pour le dashboard : brew install node, puis relancez install."
    fi
  fi
  mkdir -p "$LOG_DIR"
}

preflight() {
  local mode
  mode="$(env_value TRADING_MODE | tr '[:upper:]' '[:lower:]')"
  mode="${mode:-paper}"
  case "$mode" in
    paper|testnet) ;;
    live) die "TRADING_MODE=live dans .env : le mode LIVE ne peut pas être automatisé (confirmation humaine obligatoire au terminal, voir docs/GO_LIVE.md). Remettez TRADING_MODE=paper ou testnet." ;;
    *) die "TRADING_MODE inconnu dans .env : '$mode' (paper | testnet)" ;;
  esac
  # Same checks as `python main.py run` (risk ceilings, testnet credentials) before installing.
  (cd "$ROOT" && "$PY" -c "
import sys
from config.settings import get_settings
from config.live_guard import validate_mode
try:
    validate_mode(get_settings(), cli_live_flag=False, interactive=False)
except Exception as exc:
    sys.exit(f'REFUSÉ : {exc}')
") || die "configuration refusée (voir le message ci-dessus) : corrigez .env puis relancez."
  say "• Mode : $(tr '[:lower:]' '[:upper:]' <<<"$mode")"
}

is_loaded() { launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; }

port() { local p; p="$(env_value API_PORT)"; echo "${p:-8000}"; }

wait_health() {
  local url="http://127.0.0.1:$(port)/api/health"
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      say "• Dashboard prêt : http://127.0.0.1:$(port)"
      return 0
    fi
    sleep 2
  done
  say "• Le bot n'a pas encore répondu après 2 min. Regardez les logs : ./scripts/macos_service.sh logs"
}

show_token() {
  local tok
  tok="$(env_value DASHBOARD_TOKEN)"
  if [[ -n "$tok" && ${#tok} -ge 16 && "$tok" != change-me* ]]; then
    say "• Jeton du dashboard : celui de DASHBOARD_TOKEN dans .env"
  elif [[ -f "$ROOT/runtime/dashboard_token.txt" ]]; then
    say "• Jeton du dashboard : $(cat "$ROOT/runtime/dashboard_token.txt")"
  fi
}

cmd_install() {
  require_macos
  setup_if_needed
  preflight
  mkdir -p "$(dirname "$PLIST")"
  if is_loaded; then launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true; sleep 1; fi
  plist_content > "$PLIST"
  plutil -lint "$PLIST" >/dev/null || die "fichier launchd invalide : $PLIST"
  launchctl bootstrap "$DOMAIN" "$PLIST"
  launchctl enable "$DOMAIN/$LABEL"
  say "• Service installé : il démarre maintenant et à chaque ouverture de session."
  wait_health
  show_token
  open "http://127.0.0.1:$(port)" 2>/dev/null || true
}

cmd_uninstall() {
  require_macos
  if is_loaded; then launchctl bootout "$DOMAIN/$LABEL" || true; fi
  rm -f "$PLIST"
  say "• Service retiré. Le bot ne démarrera plus tout seul."
  say "  Une position ouverte garde son stop-loss côté exchange (testnet). Vérifiez-la sur Hyperliquid."
}

cmd_start() {
  require_macos
  [[ -f "$PLIST" ]] || die "service non installé : ./scripts/macos_service.sh install"
  preflight
  if is_loaded; then
    launchctl kickstart -k "$DOMAIN/$LABEL"
  else
    launchctl bootstrap "$DOMAIN" "$PLIST"
  fi
  wait_health
  show_token
}

cmd_stop() {
  require_macos
  if is_loaded; then
    # bootout = SIGTERM (clean shutdown) and unload: no restart until `start` or the next login.
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    say "• Bot arrêté. Il redémarrera à la prochaine ouverture de session, ou avec : start"
  else
    say "• Le service n'est pas chargé."
  fi
}

cmd_status() {
  require_macos
  if is_loaded; then
    launchctl print "$DOMAIN/$LABEL" | grep -E "^[[:space:]]*(state|pid|last exit code|runs) =" | sed 's/^[[:space:]]*/  /' || true
  else
    say "Service non installé ou non chargé."
  fi
  local url="http://127.0.0.1:$(port)/api/health"
  if out="$(curl -fsS --max-time 3 "$url" 2>/dev/null)"; then
    say "Santé : $out"
  else
    say "Santé : le bot ne répond pas sur $url"
  fi
  show_token
}

cmd_logs() {
  mkdir -p "$LOG_DIR"; touch "$LOG_FILE"
  tail -n 100 -f "$LOG_FILE"
}

case "${1:-}" in
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  print-plist) plist_content ;;
  *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
