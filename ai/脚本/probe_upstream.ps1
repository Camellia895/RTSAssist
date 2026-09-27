# probe_upstream.ps1 - ASCII-only. List upstream releases/tags and compare with the installed mod.
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
function Get-Api($url) {
  try { return Invoke-RestMethod -Uri $url -Headers @{ 'User-Agent' = 'probe'; 'Accept' = 'application/vnd.github+json' } -TimeoutSec 60 }
  catch { Write-Host ('ERR ' + $url + ' :: ' + $_.Exception.Message); return $null }
}
function Gh-Get($path) {
  $raw = & gh api $path 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { Write-Host ('ERR gh api ' + $path + ' :: ' + $raw); return $null }
  try { return ($raw | ConvertFrom-Json) } catch { Write-Host 'PARSE ERR'; return $null }
}

Write-Host '=== INSTALLED (mods\RTSAssist) ==='
$mi = Get-Content (Join-Path $g 'mods\RTSAssist\mod_info.json') -Raw -Encoding UTF8
Write-Host $mi
Write-Host ('installed jar sha256: ' + (Get-FileHash (Join-Path $g 'mods\RTSAssist\jars\RTSAssist.jar') -Algorithm SHA256).Hash)

Write-Host ''
Write-Host '=== releases (newest first) ==='
$r = Gh-Get 'repos/Raatle/RTSAssist/releases?per_page=50'
if ($r) {
  $i = 0
  foreach ($x in $r) {
    $i++
    $a = ($x.assets | ForEach-Object { $_.name + '(' + $_.size + ')#' + $_.id }) -join ','
    Write-Host (('{0,2}. {1,-14} published={2} prerelease={3} draft={4}  assets={5}' -f $i, $x.tag_name, $x.published_at, $x.prerelease, $x.draft, $a))
    if ($i -le 3) { Write-Host ('     notes: ' + (($x.body -split "`n" | Select-Object -First 6) -join ' | ')) }
  }
}
Write-Host ''
Write-Host '=== tags (newest first, first 12) ==='
$t = Gh-Get 'repos/Raatle/RTSAssist/tags?per_page=50'
if ($t) { $k = 0; foreach ($x in $t) { $k++; if ($k -le 12) { Write-Host ('  ' + $x.name + '  ' + $x.commit.sha.Substring(0,8)) } } }
Write-Host ''
Write-Host '=== default branch latest commits ==='
$c = Gh-Get 'repos/Raatle/RTSAssist/commits?per_page=8'
if ($c) { foreach ($x in $c) { Write-Host ('  ' + $x.sha.Substring(0,8) + ' ' + $x.commit.author.date + ' ' + ($x.commit.message -split "`n")[0]) } }
