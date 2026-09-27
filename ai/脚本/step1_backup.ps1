# step1_backup.ps1 - ASCII-only. Freeze the 0.1.9c Chinese delivery before switching to 0.2.04exp.
# 1) duplicate the currently-installed mod (0.1.9c Chinese) to ver_0.1.9c_zh_2026-09-11
# 2) freeze the 0.1.9c translation worklists + ai corpus
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$mw = Join-Path $g '_work\mod_work\RTSAssist'
$mod = Join-Path $g 'mods\RTSAssist'

Write-Host '=== 1) duplicate the installed 0.1.9c Chinese build ==='
$dst = Join-Path $mw 'ver_0.1.9c_zh_2026-09-11'
if (Test-Path $dst) { Write-Host ('  already exists: ' + $dst) }
else {
  Copy-Item -LiteralPath $mod -Destination $dst -Recurse -Force
  Write-Host ('  -> ' + $dst)
  Write-Host ('  files: ' + (Get-ChildItem -Recurse -File $dst).Count)
}
# also keep the plain jar + payload for a quick rollback
$jarbak = Join-Path $mw 'ver_0.1.9c_zh_jar_backup'
New-Item -ItemType Directory -Force -Path $jarbak | Out-Null
Copy-Item (Join-Path $mod 'jars\RTSAssist.jar') (Join-Path $jarbak 'RTSAssist_0.1.9c_zh.jar') -Force
foreach ($f in @('Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt', 'RTSAssist.version')) {
  Copy-Item (Join-Path $mod $f) (Join-Path $jarbak $f) -Force
}
Write-Host ('  jar+payload rollback copy -> ' + $jarbak)

Write-Host ''
Write-Host '=== 2) freeze the 0.1.9c translation worklists ==='
$frz = Join-Path $mw 'out\zh_corrected_0.1.9c'
if (Test-Path $frz) { Write-Host ('  already exists: ' + $frz) }
else {
  New-Item -ItemType Directory -Force -Path $frz | Out-Null
  Copy-Item (Join-Path $mw 'out\zh_corrected\*') $frz -Force
  Write-Host ('  -> ' + $frz + '  (' + (Get-ChildItem $frz -File).Count + ' files)')
}
$fro = Join-Path $mw 'out\en_0.1.9c'
if (-not (Test-Path $fro)) {
  New-Item -ItemType Directory -Force -Path $fro | Out-Null
  foreach ($f in @('worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json')) {
    Copy-Item (Join-Path $mw "out\$f") $fro -Force
  }
  Write-Host ('  -> ' + $fro)
}

Write-Host ''
Write-Host '=== rollback check ==='
$chk = Get-ChildItem -Recurse -File $dst -ErrorAction SilentlyContinue
Write-Host ('  duplicate files: ' + $chk.Count + '   jar sha256: ' + (Get-FileHash (Join-Path $dst 'jars\RTSAssist.jar') -Algorithm SHA256).Hash.Substring(0, 16))
Write-Host '  (that jar is the 0.1.9c CHINESE jar; the pristine EN backup stays in _work\mod_bak\RTSAssist_0.1.9c_EN_backup)'
