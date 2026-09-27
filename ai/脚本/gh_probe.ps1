$ErrorActionPreference = 'Continue'
function Gh-Get($path) {
  $raw = & gh api $path 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { Write-Host ("ERR " + $path + " :: " + $raw); return $null }
  try { return ($raw | ConvertFrom-Json) } catch { Write-Host ("PARSE ERR " + $path); return $null }
}
Write-Host '=== recent commits on upstream main ==='
$c = Gh-Get 'repos/Raatle/RTSAssist/commits?per_page=20'
if ($c) { foreach ($x in $c) { Write-Host ($x.sha.Substring(0,8) + ' ' + $x.commit.author.date + ' ' + ($x.commit.message -split "`n")[0]) } }
Write-Host '=== tags ==='
$t = Gh-Get 'repos/Raatle/RTSAssist/tags?per_page=50'
if ($t) { foreach ($x in $t) { Write-Host ($x.name + ' ' + $x.commit.sha.Substring(0,8)) } }
Write-Host '=== releases ==='
$r = Gh-Get 'repos/Raatle/RTSAssist/releases?per_page=50'
if ($r) { foreach ($x in $r) { $a = ($x.assets | ForEach-Object { $_.name + '(' + $_.size + ')' }) -join ','; Write-Host ($x.tag_name + ' ' + $x.published_at + ' assets=' + $a) } }
