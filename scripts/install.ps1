# Instala Claude Usage en Windows con el último release de GitHub.
# Uso:
#   irm https://raw.githubusercontent.com/RagnArUCi/claude-usage-bar/main/scripts/install.ps1 | iex
$ErrorActionPreference = 'Stop'

$repo = 'RagnArUCi/claude-usage-bar'
$api = "https://api.github.com/repos/$repo/releases/latest"

Write-Host 'Buscando el último release…'
$release = Invoke-RestMethod $api -Headers @{ 'User-Agent' = 'claude-usage-bar' }

$asset = $release.assets | Where-Object { $_.name -like '*Setup*.exe' } | Select-Object -First 1
if (-not $asset) { throw 'No encontré el instalador .exe en el último release.' }

$out = Join-Path $env:TEMP $asset.name
Write-Host "Descargando $($asset.browser_download_url)"
Invoke-WebRequest $asset.browser_download_url -OutFile $out

Write-Host 'Ejecutando el instalador…'
# El instalador es de un clic y abre la app al terminar (runAfterFinish).
Start-Process -FilePath $out -Wait
Write-Host 'Listo.'
