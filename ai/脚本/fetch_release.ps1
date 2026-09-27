$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$tmp = "$g\_work\_tmp\rtsassist_release"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$out = Join-Path $tmp 'RTSAssist_0.1.9c_98a.zip'
if (Test-Path $out) { Remove-Item $out -Force }

$candidates = @(
  'https://api.github.com/repos/Raatle/RTSAssist/releases/assets/{ASSETID}',
  'https://ghproxy.net/https://github.com/Raatle/RTSAssist/releases/download/v0.1.9c_98a/RTSAssist.zip',
  'https://gh-proxy.com/https://github.com/Raatle/RTSAssist/releases/download/v0.1.9c_98a/RTSAssist.zip',
  'https://ghfast.top/https://github.com/Raatle/RTSAssist/releases/download/v0.1.9c_98a/RTSAssist.zip',
  'https://hub.gitmirror.com/https://github.com/Raatle/RTSAssist/releases/download/v0.1.9c_98a/RTSAssist.zip'
)

foreach ($u in $candidates) {
  $url = $u
  if ($url -like '*{ASSETID}*') {
    Write-Host "resolving asset id via gh api ..."
    $raw = & gh api repos/Raatle/RTSAssist/releases/tags/v0.1.9c_98a 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Write-Host ("  gh api failed: " + $raw); continue }
    $rel = $raw | ConvertFrom-Json
    $asset = $rel.assets | Where-Object { $_.name -eq 'RTSAssist.zip' } | Select-Object -First 1
    if (-not $asset) { Write-Host '  asset not found'; continue }
    Write-Host ("  asset id=" + $asset.id + " size=" + $asset.size)
    $url = $url.Replace('{ASSETID}', $asset.id)
  }
  Write-Host "trying $url"
  & curl.exe -L -sS --max-time 240 -o $out $url 2>&1 | Out-String | Write-Host
  if ((Test-Path $out) -and (Get-Item $out).Length -gt 500000) {
    Write-Host ("  OK size=" + (Get-Item $out).Length)
    break
  }
  Write-Host ("  failed/too small: " + $(if (Test-Path $out) { (Get-Item $out).Length } else { 'n/a' }))
  if (Test-Path $out) { Remove-Item $out -Force }
}
if (-not (Test-Path $out)) { Write-Host 'ALL CHANNELS FAILED'; exit 2 }
Write-Host '=== verify zip is a zip ==='
$bytes = [System.IO.File]::ReadAllBytes($out)[0..3]
Write-Host ('magic: ' + ($bytes -join ','))
