#!/usr/bin/env bash
# Share this Mac's website on the internet through Tailscale Funnel (n8n stays private): a fixed https://<mac-name>.<tailnet>.ts.net address,
# no router or firewall changes. Other people only need a browser.
#   ./share.sh on       start sharing, keep the Mac awake while shared
#   ./share.sh off      stop sharing
#   ./share.sh status   show whether it is shared and the addresses
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
envget() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
envset() {   # replace or append KEY=value in .env (no sed -i: differs between macOS and Linux)
  if grep -q "^$1=" .env; then
    awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > .env.tmp && mv .env.tmp .env
  else printf '%s=%s\n' "$1" "$2" >> .env; fi
  chmod 600 .env
}

[ -f .env ] || die "No .env yet. Run ./setup.sh first."
TS=$(command -v tailscale || true)
[ -z "$TS" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
[ -n "$TS" ] || die "Tailscale not found. Install it from https://tailscale.com/download/mac , open it and sign in, then run this again."
PIDFILE=.share-caffeinate.pid

tailnet_host() {   # this Mac's name in the tailnet, e.g. gejingze-mac.tail1234.ts.net
  local json; json=$("$TS" status --json 2>/dev/null) || return 1
  osascript -l JavaScript -e 'function run(a){ return JSON.parse(a[0]).Self.DNSName.replace(/\.$/, "") }' "$json" 2>/dev/null
}

print_addresses() {
  local base="${1%/}"
  cat <<EOF

  Share this address: $base
  People register there as a visitor or an expert. The n8n editor stays on this Mac (http://localhost:5678).

EOF
}

case "${1:-status}" in
  on)
    curl -fsS http://localhost:3001/api/health >/dev/null 2>&1 \
      || die "The website is not running on this Mac. Start Docker Desktop, then run: docker compose up -d   (wait a minute, then retry)"
    host=$(tailnet_host) || true
    [ -n "${host:-}" ] || die "Tailscale is not signed in. Open the Tailscale app, sign in, then run this again."
    url="https://$host/"

    say "Opening $url (the first time, Tailscale may print a link to allow Funnel for your account: open it, approve, rerun)"
    "$TS" funnel --https=443 localhost:5678 off 2>/dev/null || true   # older versions of this script shared n8n itself
    "$TS" funnel --bg --https=443 localhost:3001

    if [ "$(envget PUBLIC_URL)" != "$url" ]; then
      say "Telling the website its public address (restarts it, about 20 seconds)"
      envset PUBLIC_URL "$url"
      docker compose up -d web >/dev/null
      for i in $(seq 1 90); do curl -fsS http://localhost:3001/api/health >/dev/null 2>&1 && break; sleep 2; done
    fi

    # keep the Mac from sleeping while shared (a closed lid still sleeps unless an external display is attached)
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null || true
    nohup caffeinate -dimsu >/dev/null 2>&1 &
    echo $! > "$PIDFILE"

    say "Shared. Keep this Mac on, awake and online, with Docker Desktop running."
    print_addresses "$url"
    ;;
  off)
    "$TS" funnel --https=443 localhost:3001 off 2>/dev/null || "$TS" funnel reset
    [ -f "$PIDFILE" ] && { kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; }
    say "Stopped sharing. The website keeps running locally at http://localhost:3001"
    ;;
  status)
    "$TS" funnel status || true
    pub=$(envget PUBLIC_URL)
    [ -n "$pub" ] && print_addresses "$pub"
    ;;
  *) die "Usage: ./share.sh on | off | status" ;;
esac
