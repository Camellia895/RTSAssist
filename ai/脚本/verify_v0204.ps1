# verify_v0204.ps1 - ASCII-only. Offline checks on the new v0.2.04exp payload before touching anything installed.
# 1) full-tree hash compare: release zip vs nothing-installed-yet (sanity: payload complete)
# 2) offline LoadTest of the new jar (game JRE 17, -noverify)
# 3) identifier-CJK check (baseline for later)
# 4) shader files referenced by code all present?
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$S = Join-Path $g '_work\skills\shared\scripts'
$T = Join-Path $g '_work\_tmp\rtsassist_v0204'
$REL = Join-Path $T 'rel\RTSAssist'
$mw = Join-Path $g '_work\mod_work\RTSAssist'

Write-Host '=== payload inventory ==='
Get-ChildItem -Recurse -File $REL | Group-Object { $_.Directory.Name } | Sort-Object Count -Descending | Select-Object -First 12 | ForEach-Object { Write-Host ('  ' + $_.Name.PadRight(18) + ' ' + $_.Count) }
Write-Host ('  total files: ' + (Get-ChildItem -Recurse -File $REL).Count)

Write-Host ''
Write-Host '=== unpack new jar for checks ==='
Add-Type -AssemblyName System.IO.Compression.FileSystem
$un = Join-Path $T 'unpacked'
if (Test-Path $un) { Remove-Item $un -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $REL 'jars\RTSAssist.jar'), $un)
Write-Host ('  classes: ' + (Get-ChildItem -Recurse -File $un -Filter *.class).Count)

Write-Host ''
Write-Host '=== identifier CJK check (must be 0) ==='
node (Join-Path $S 'verify_identifiers.js') $un
Write-Host ('  exit=' + $LASTEXITCODE)

Write-Host ''
Write-Host '=== shaders referenced by code but missing from data\shaders ==='
$shaderDir = Join-Path $REL 'data\shaders'
$refs = Select-String -Path (Get-ChildItem -Recurse -File (Join-Path $REL 'src') -Filter *.java).FullName -Pattern '"data/shaders/([^"]+)"' -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = 0
foreach ($r in $refs) {
  $p = Join-Path $shaderDir ($r -replace '/', '\')
  if (-not (Test-Path $p)) { Write-Host ('  MISSING ' + $r); $missing++ }
}
Write-Host ('  referenced shaders: ' + $refs.Count + '  missing: ' + $missing)

Write-Host ''
Write-Host '=== offline LoadTest on the NEW jar ==='
# build a fileset that mimics the installed mod so the classpath matches: copy payload to a temp mod dir
$fake = Join-Path $T 'fakemod'
if (Test-Path $fake) { Remove-Item $fake -Recurse -Force }
New-Item -ItemType Directory -Force -Path $fake | Out-Null
Copy-Item (Join-Path $REL '*') $fake -Recurse -Force
$core = Join-Path $g 'starsector-core'
$cp = @(
  "$core\starfarer.api.jar", "$core\starfarer_obf.jar", "$core\json.jar", "$core\log4j-1.2.9.jar",
  "$core\lwjgl.jar", "$core\lwjgl_util.jar", "$core\fs.common_obf.jar", "$core\fs.sound_obf.jar",
  "$core\commons-compiler.jar", "$core\commons-compiler-jdk.jar", "$core\janino.jar",
  "$core\jaxb-api-2.4.0-b180830.0359.jar", "$core\txw2-3.0.2.jar", "$core\xstream-1.4.10.jar",
  "$core\jinput.jar", "$core\jogg-0.0.7.jar", "$core\jorbis-0.0.15.jar", "$core\webp-imageio-0.1.6.jar",
  "$g\mods\LazyLib\jars\LazyLib.jar", "$g\mods\LazyLib\jars\LazyLib-Kotlin.jar", "$g\mods\LazyLib\jars\internal\Kotlin-Runtime.jar",
  "$g\mods\LunaLib\jars\LunaLib.jar", "$g\mods\LunaLib\jars\fuzzywuzzy-1.3.0.jar"
) -join ';'
$jbr = 'C:\Program Files\Android\Android Studio\jbr\bin'
$java = Join-Path $g 'jre\bin\java.exe'
$lt = Join-Path $mw 'out\loadtest'
$logs = Join-Path $T 'ltlogs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
if (-not (Test-Path (Join-Path $lt 'LoadTestRTS.class'))) {
  New-Item -ItemType Directory -Force -Path $lt | Out-Null
  & "$jbr\javac.exe" -nowarn --release 17 -encoding UTF-8 -d $lt (Join-Path $mw 'tools\LoadTestRTS.java') 2>&1 | Out-String | Write-Host
}
& $java -noverify "-Dcom.fs.starfarer.settings.paths.logs=$logs" -cp "$lt;$cp;$(Join-Path $fake 'jars\RTSAssist.jar')" LoadTestRTS (Join-Path $fake 'jars\RTSAssist.jar') 2>&1 | Select-String -Pattern 'classes in jar|load ok|instantiate|RESULT|FAILURES|LOAD |INST ' | ForEach-Object { Write-Host ('  ' + $_.Line) }
Write-Host ('  exit=' + $LASTEXITCODE)
