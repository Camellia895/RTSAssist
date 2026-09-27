# step2_new_baseline.ps1 - ASCII-only. Switch the working baseline from 0.1.9c to 0.2.04exp.
# 1) new pristine EN backup of the NEW version -> _work\mod_bak\RTSAssist_0.2.04exp_EN_backup
# 2) refresh read-only baselines: baseline\src (147 java) and baseline_mod\ (payload root files)
# 3) update mods\RTSAssist to the new version (EN) so subsequent injection/sync targets the right version
#    NOTE: the 0.1.9c Chinese build is already duplicated in mod_work\RTSAssist\ver_0.1.9c_zh_2026-09-11
$ErrorActionPreference = 'Stop'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$mw = Join-Path $g '_work\mod_work\RTSAssist'
$REL = Join-Path $g '_work\_tmp\rtsassist_v0204\rel\RTSAssist'
$mod = Join-Path $g 'mods\RTSAssist'

Write-Host '=== 1) pristine EN backup of 0.2.04exp ==='
$bak = Join-Path $g '_work\mod_bak\RTSAssist_0.2.04exp_EN_backup'
if (Test-Path $bak) { Write-Host ('  exists: ' + $bak) }
else {
  Copy-Item -LiteralPath $REL -Destination $bak -Recurse -Force
  Write-Host ('  -> ' + $bak + '  (' + (Get-ChildItem -Recurse -File $bak).Count + ' files)')
}

Write-Host ''
Write-Host '=== 2) refresh read-only baselines ==='
$bs = Join-Path $mw 'baseline\src'
if (Test-Path $bs) { Remove-Item -LiteralPath $bs -Recurse -Force }
New-Item -ItemType Directory -Force -Path $bs | Out-Null
Copy-Item (Join-Path $REL 'src\*') $bs -Recurse -Force
Write-Host ('  baseline\src : ' + (Get-ChildItem -Recurse -File $bs -Filter *.java).Count + ' java files')

$bm = Join-Path $mw 'baseline_mod'
if (Test-Path $bm) { Remove-Item -LiteralPath $bm -Recurse -Force }
New-Item -ItemType Directory -Force -Path $bm | Out-Null
foreach ($f in @('Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt', 'RTSAssist.version')) {
  Copy-Item (Join-Path $REL $f) (Join-Path $bm $f) -Force
}
Copy-Item (Join-Path $REL 'FOR MODDERS!!!') (Join-Path $bm 'FOR MODDERS!!!') -Recurse -Force
Write-Host ('  baseline_mod : ' + (Get-ChildItem -Recurse -File $bm).Count + ' files')

Write-Host ''
Write-Host '=== 3) install the NEW version payload into mods\RTSAssist (replacing 0.1.9c) ==='
# keep a copy of what we are replacing so the swap is auditable
$pre = Join-Path $g '_work\mod_bak\RTSAssist_0.1.9c_replaced_by_0.2.04exp'
if (-not (Test-Path $pre)) {
  Copy-Item -LiteralPath $mod -Destination $pre -Recurse -Force
  Write-Host ('  previous mods\RTSAssist snapshot -> ' + $pre)
}
# wipe and re-copy (keeps the tree clean of 0.1.9c-only files such as ai\ zzTestMod leftovers)
Get-ChildItem -LiteralPath $mod -Force | Remove-Item -Recurse -Force
Copy-Item (Join-Path $REL '*') $mod -Recurse -Force
Write-Host ('  mods\RTSAssist now: ' + (Get-ChildItem -Recurse -File $mod).Count + ' files')
Write-Host ('  mod_info version: ' + (((Get-Content (Join-Path $mod 'mod_info.json') -Raw -Encoding UTF8) -split '"version":"')[1] -split '"')[0])

Write-Host ''
Write-Host '=== 4) sanity: jar hash vs release zip ==='
$h1 = (Get-FileHash (Join-Path $REL 'jars\RTSAssist.jar') -Algorithm SHA256).Hash
$h2 = (Get-FileHash (Join-Path $mod 'jars\RTSAssist.jar') -Algorithm SHA256).Hash
Write-Host ('  release: ' + $h1.Substring(0, 16) + '   installed: ' + $h2.Substring(0, 16) + '   equal=' + ($h1 -eq $h2))

Write-Host ''
Write-Host '=== 5) 0.1.9c rollback still available? ==='
$old = Join-Path $mw 'ver_0.1.9c_zh_2026-09-11'
Write-Host ('  ' + $old + '  exists=' + (Test-Path $old) +
            '  jar=' + $(if (Test-Path (Join-Path $old 'jars\RTSAssist.jar')) { (Get-FileHash (Join-Path $old 'jars\RTSAssist.jar') -Algorithm SHA256).Hash.Substring(0,16) } else { 'MISSING' }))
