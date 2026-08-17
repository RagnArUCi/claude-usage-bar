#!/usr/bin/env sh
# Instala Claude Usage en macOS o Linux con el último release de GitHub.
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/RagnArUCi/claude-usage-bar/main/scripts/install.sh | sh
set -eu

REPO="RagnArUCi/claude-usage-bar"
API="https://api.github.com/repos/$REPO/releases/latest"

log() { printf '%s\n' "$*" >&2; }
die() { log "Error: $*"; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl no está instalado."

# Primer browser_download_url del release que casa con $1 y, si se pasa $2,
# que NO casa con $2.
#
# La exclusión no es un adorno: para Mac Intel el patrón por sufijo también
# casaba con el .dmg de Apple Silicon (…-arm64.dmg acaba en "4.dmg", que
# encaja en [0-9]\.dmg$), así que un Intel podía acabar instalando la build
# equivocada según el orden que devolviera la API.
asset_url() {
  curl -fsSL "$API" \
    | grep 'browser_download_url' \
    | grep -oE 'https://[^"]+' \
    | grep -E "$1" \
    | { if [ -n "${2:-}" ]; then grep -vE "$2"; else cat; fi; } \
    | head -n1
}

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64) url="$(asset_url 'arm64\.dmg$')" ;;
      *)     url="$(asset_url '\.dmg$' 'arm64')" ;;
    esac
    [ -n "$url" ] || die "no encontré un .dmg para $ARCH en el último release."

    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    log "Descargando $url"
    curl -fL "$url" -o "$tmp/claude-usage.dmg"

    mnt="$(hdiutil attach "$tmp/claude-usage.dmg" -nobrowse -readonly | tail -n1 | awk '{print $NF}')"
    appname="$(ls "$mnt" | grep '\.app$' | head -n1)"
    [ -n "$appname" ] || { hdiutil detach "$mnt" >/dev/null 2>&1 || true; die "el .dmg no contiene ninguna .app."; }

    log "Instalando en /Applications/$appname"
    rm -rf "/Applications/$appname"
    cp -R "$mnt/$appname" /Applications/
    hdiutil detach "$mnt" >/dev/null 2>&1 || true
    # Quita la cuarentena para que no la bloquee Gatekeeper (build sin firmar).
    xattr -cr "/Applications/$appname" 2>/dev/null || true

    log "Listo. Abriendo la app…"
    open "/Applications/$appname"
    ;;

  Linux)
    url="$(asset_url 'AppImage$')"
    [ -n "$url" ] || die "no encontré un .AppImage en el último release."

    dest="${XDG_BIN_HOME:-$HOME/.local/bin}"
    mkdir -p "$dest"
    out="$dest/claude-usage.AppImage"
    log "Descargando $url"
    curl -fL "$url" -o "$out"
    chmod +x "$out"

    log "Instalado en $out"
    log "Lanzando la app (se configurará para iniciarse al encender)…"
    "$out" >/dev/null 2>&1 &
    ;;

  *)
    die "sistema no soportado: $OS (usa install.ps1 en Windows)."
    ;;
esac
