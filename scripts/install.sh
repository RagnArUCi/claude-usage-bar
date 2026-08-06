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

# Primer browser_download_url del release que casa con el patrón dado.
asset_url() {
  curl -fsSL "$API" \
    | grep 'browser_download_url' \
    | grep -oE 'https://[^"]+' \
    | grep -E "$1" \
    | head -n1
}

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64) pat='arm64\.dmg$' ;;
      *)     pat='[0-9]\.dmg$' ;;
    esac
    url="$(asset_url "$pat")"
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
