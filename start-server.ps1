
param(
  [int]$StartPort = 8000,
  [int]$MaxAttempts = 50
)

$port = $StartPort

for ($i = 0; $i -lt $MaxAttempts; $i++) {
  $inUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

  if (-not $inUse) {
    Write-Host "Serving MPU app at http://localhost:$port"
    python -m http.server $port --bind 127.0.0.1
    exit $LASTEXITCODE
  }

  Write-Host "Port $port is in use, trying $($port + 1)..."
  $port++
}

Write-Error "No free port found from $StartPort to $($StartPort + $MaxAttempts - 1)."
exit 1
