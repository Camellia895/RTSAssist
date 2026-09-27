# loadtest.ps1 — 离线类加载验证（原官方 jar 基线 vs 新建中文 jar）。
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$mw = Join-Path $g '_work\mod_work\RTSAssist'
$core = Join-Path $g 'starsector-core'
$jbr = 'C:\Program Files\Android\Android Studio\jbr\bin'
$java = Join-Path $g 'jre\bin\java.exe'
$logs = Join-Path $g '_work\_tmp\rtsa_loadtest_logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$cp = @(
  "$core\starfarer.api.jar", "$core\starfarer_obf.jar", "$core\json.jar", "$core\log4j-1.2.9.jar",
  "$core\lwjgl.jar", "$core\lwjgl_util.jar", "$core\fs.common_obf.jar", "$core\fs.sound_obf.jar",
  "$core\commons-compiler.jar", "$core\commons-compiler-jdk.jar", "$core\janino.jar",
  "$core\jaxb-api-2.4.0-b180830.0359.jar", "$core\txw2-3.0.2.jar", "$core\xstream-1.4.10.jar",
  "$core\jinput.jar", "$core\jogg-0.0.7.jar", "$core\jorbis-0.0.15.jar", "$core\webp-imageio-0.1.6.jar",
  "$g\mods\LazyLib\jars\LazyLib.jar", "$g\mods\LazyLib\jars\LazyLib-Kotlin.jar", "$g\mods\LazyLib\jars\internal\Kotlin-Runtime.jar",
  "$g\mods\LunaLib\jars\LunaLib.jar", "$g\mods\LunaLib\jars\fuzzywuzzy-1.3.0.jar"
) -join ';'

$out = Join-Path $mw 'out\loadtest'
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host '=== 编译 LoadTestRTS (--release 17) ==='
& "$jbr\javac.exe" -nowarn --release 17 -encoding UTF-8 -d $out (Join-Path $mw 'tools\LoadTestRTS.java') 2>&1 | Out-String | Write-Host

foreach ($case in @(
    @{ name = 'EN 官方原版 jar'; jar = (Join-Path $mw 'jarwork\RTSAssist_orig.jar') },
    @{ name = 'ZH 新建中文 jar'; jar = (Join-Path $mw 'build\RTSAssist.jar') }
  )) {
  Write-Host ''
  Write-Host ("=== LoadTest: " + $case.name + " ===")
  $cpFull = "$out;$cp;" + $case.jar
  & $java -noverify "-Dcom.fs.starfarer.settings.paths.logs=$logs" -cp $cpFull LoadTestRTS $case.jar 2>&1 | Out-String | Write-Host
  Write-Host ("exit=" + $LASTEXITCODE)
}
