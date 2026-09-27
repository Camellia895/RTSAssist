# verify_fixed_scripts.ps1 - field-test the repaired shared scripts on real RTSAssist data.
# ASCII-only on purpose: PowerShell 5.1 reads BOM-less .ps1 as ANSI/GBK and mangles CJK.
# Everything happens under _work\_tmp\rtsa_scriptcheck; the delivered jar/work dirs are not touched.
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$S = Join-Path $g '_work\skills\shared\scripts'
$mw = Join-Path $g '_work\mod_work\RTSAssist'
$T = Join-Path $g '_work\_tmp\rtsa_scriptcheck'
if (Test-Path $T) { Remove-Item $T -Recurse -Force }
New-Item -ItemType Directory -Force -Path $T | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem
$un = Join-Path $T 'unpacked'
[System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $mw 'build\RTSAssist.jar'), $un)

function Run($title, [scriptblock]$sb) {
  Write-Host ''
  Write-Host ('===== ' + $title + ' =====')
  & $sb
  Write-Host ('exit=' + $LASTEXITCODE)
}

Run 'extract_jar_constants.js <jarDir> <out>' { node (Join-Path $S 'extract_jar_constants.js') $un (Join-Path $T 'jar_constants.json') }
Run 'analyze_jar_strings.js <jarDir> <out>' { node (Join-Path $S 'analyze_jar_strings.js') $un (Join-Path $T 'analysis.json') }
Run 'scan_stragglers.js <classDir> [out]' { node (Join-Path $S 'scan_stragglers.js') $un (Join-Path $T 'stragglers.json') }

# build EN->ZH map from the delivered corpora (key = English, value = Chinese)
$map = @{}
foreach ($f in @('worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json')) {
  $arr = Get-Content (Join-Path $g "mods\RTSAssist\ai\zh\$f") -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($e in $arr) { $map[$e.en] = $e.zh }
}
$mapFile = Join-Path $T 'translations.json'
[System.IO.File]::WriteAllText($mapFile, ($map | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ''
Write-Host ('translations.json entries: ' + $map.Count)

Run 'check_u0001.js <translations.json> [out]' { node (Join-Path $S 'check_u0001.js') $mapFile (Join-Path $T 'u0001.json') }
Run 'verify_u0001_jar.js <jc> <tc> <classDir>' { node (Join-Path $S 'verify_u0001_jar.js') (Join-Path $T 'jar_constants.json') $mapFile $un }
Run 'sweep_sentences.js <jc> <tc> [out]' { node (Join-Path $S 'sweep_sentences.js') (Join-Path $T 'jar_constants.json') $mapFile (Join-Path $T 'sweep.json') }
Run 'check_encoding.js <modRoot>' { node (Join-Path $S 'check_encoding.js') (Join-Path $g 'mods\RTSAssist') }
Run 'verify_all_data.js <dataDir>' { node (Join-Path $S 'verify_all_data.js') (Join-Path $g 'mods\RTSAssist\data') }

Write-Host ''
Write-Host '===== --help self-check (expect exit 0 + usage line) ====='
# NOTE: do NOT name the loop variable $s - PowerShell variable names are case-insensitive,
# so $s would clobber $S (the scripts dir). Cost this session one debugging round.
$scriptNames = @('extract_jar_constants.js', 'scan_stragglers.js', 'sweep_sentences.js', 'check_u0001.js', 'verify_u0001_jar.js', 'patchdir.js', 'check_encoding.js', 'build_worklist2.js', 'migrate_json.js', 'migrate_faction2.js', 'migrate_rules_script.js', 'translate_missions.js', 'verify_all_data.js')
foreach ($name in $scriptNames) {
  $out = (node (Join-Path $S $name) --help 2>&1 | Out-String)
  $code = $LASTEXITCODE
  $first = ($out -split "`n")[0]
  Write-Host ('  ' + $name.PadRight(28) + ' exit=' + $code + '  ' + $first.Trim())
}
