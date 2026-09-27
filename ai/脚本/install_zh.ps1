# install_zh.ps1 - Install the Chinese build into mods\RTSAssist\.
# ASCII-ONLY on purpose: PowerShell 5.1 reads a BOM-less .ps1 as ANSI/GBK, and a CJK comment
# inside it can silently break later statements (this file used to have one - do not reintroduce).
#
# What it does:
#   jars\RTSAssist.jar   <- build\RTSAssist.jar        (patched constant pool + translated embedded .java)
#   <root>\*             <- build\payload_mod\*        (every root-level translated text file)
#   src\**\*.java        <- build\src_zh\**            (only files whose bytes differ; keeps source in sync with jar)
# Verifies SHA-256 after each copy, and asserts the installed payload actually contains CJK
# (so a silent no-op can never pass again).
$ErrorActionPreference = 'Stop'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$mw = Join-Path $g '_work\mod_work\RTSAssist'
$mod = Join-Path $g 'mods\RTSAssist'
$build = Join-Path $mw 'build'
$payload = Join-Path $build 'payload_mod'

function Copy-Verified($src, $dst, $label) {
  $d = Split-Path $dst -Parent
  if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  Copy-Item -LiteralPath $src -Destination $dst -Force
  $h1 = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash
  $h2 = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
  if ($h1 -ne $h2) { throw ("SHA-256 mismatch after copy: " + $label) }
  Write-Host ("  OK  " + $label + "  " + $h1.Substring(0, 16) + "...")
}

Write-Host '=== install jar ==='
Copy-Verified (Join-Path $build 'RTSAssist.jar') (Join-Path $mod 'jars\RTSAssist.jar') 'jars/RTSAssist.jar'

Write-Host '=== install payload (data-layer text) ==='
$payloadNames = @(Get-ChildItem -LiteralPath $payload -File | Select-Object -ExpandProperty Name)
if ($payloadNames.Count -eq 0) { throw ('payload_mod is empty: ' + $payload) }
foreach ($name in $payloadNames) {
  Copy-Verified (Join-Path $payload $name) (Join-Path $mod $name) $name
}
Write-Host ('  files copied: ' + $payloadNames.Count)

Write-Host '=== sync source with jar ==='
$srcZhRoot = Join-Path $build 'src_zh'
$synced = 0
foreach ($item in (Get-ChildItem -LiteralPath $srcZhRoot -Recurse -File -Filter *.java)) {
  $rel = $item.FullName.Substring($srcZhRoot.Length + 1)
  $dst = Join-Path $mod ('src\' + $rel)
  if (-not (Test-Path -LiteralPath $dst)) { continue }
  $h1 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
  $h2 = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
  if ($h1 -ne $h2) { Copy-Verified $item.FullName $dst ('src\' + $rel); $synced++ }
}
Write-Host ('  source files synced: ' + $synced)

Write-Host '=== summary + post-condition ==='
Write-Host ('jar size: ' + (Get-Item (Join-Path $mod 'jars\RTSAssist.jar')).Length)
$mi = Get-Content (Join-Path $mod 'mod_info.json') -Raw -Encoding UTF8
# NOTE: mod_info.json contains a COMMENTED dependency line `#"version": "3.0.0"` - anchor at line start
$ver = ([regex]::Match($mi, '(?m)^\s*"version"\s*:\s*"([^"]+)"')).Groups[1].Value
Write-Host ('mod version: ' + $ver)

$totalCjk = 0
$emptyFiles = @()
foreach ($name in @('Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt')) {
  $p = Join-Path $mod $name
  if (-not (Test-Path -LiteralPath $p)) { continue }
  $txt = Get-Content -LiteralPath $p -Raw -Encoding UTF8
  $n = ([regex]::Matches($txt, '[\u4e00-\u9fff]')).Count
  Write-Host ('  CJK chars in ' + $name + ': ' + $n)
  if ($n -eq 0) { $emptyFiles += $name }
  $totalCjk += $n
}
Write-Host ('total CJK chars in payload: ' + $totalCjk)
if ($emptyFiles.Count -gt 0) { throw ('these installed files contain no CJK - installation did not take effect: ' + ($emptyFiles -join ', ')) }
if ($totalCjk -lt 1000) { throw ('suspiciously few CJK chars (' + $totalCjk + ') - check the payload') }
Write-Host 'POST-CONDITION OK: Chinese payload is installed.'

# embedded .java inside the jar must also be Chinese-only for the changed file
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $mod 'jars\RTSAssist.jar'))
$entry = $z.Entries | Where-Object { $_.FullName -eq 'data/scripts/modInitilisation/RTS_LunaIntegration.java' }
if ($entry) {
  $sr = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  $jarJava = $sr.ReadToEnd(); $sr.Close()
  $jarCjk = ([regex]::Matches($jarJava, '[\u4e00-\u9fff]')).Count
  Write-Host ('  CJK chars in jar-embedded RTS_LunaIntegration.java: ' + $jarCjk)
  if ($jarCjk -eq 0) { throw 'jar-embedded source has no CJK - the jar patch did not include the translated source' }
}
$z.Dispose()
Write-Host 'DONE.'
