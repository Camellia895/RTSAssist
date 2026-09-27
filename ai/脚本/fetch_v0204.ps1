# fetch_v0204.ps1 - ASCII-only. Fetch v0.2.04exp via multiple channels + the v0.2.04exp tag source tarball.
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$tmp = Join-Path $g '_work\_tmp\rtsassist_v0204'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'RTSAssist_v0.2.04exp.zip'
$tgz = Join-Path $tmp 'src_v0.2.04exp.tar.gz'

# ---- 1) release zip (asset id 431202424) ----
if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 1000000) {
  if (Test-Path $zip) { Remove-Item $zip -Force }
  $urls = @(
    'https://ghproxy.net/https://github.com/Raatle/RTSAssist/releases/download/v0.2.04exp/RTSAssist.zip',
    'https://gh-proxy.com/https://github.com/Raatle/RTSAssist/releases/download/v0.2.04exp/RTSAssist.zip',
    'https://ghfast.top/https://github.com/Raatle/RTSAssist/releases/download/v0.2.04exp/RTSAssist.zip'
  )
  foreach ($u in $urls) {
    Write-Host ('trying ' + $u)
    & curl.exe -L -sS --max-time 300 -o $zip $u 2>&1 | Out-String | Write-Host
    if ((Test-Path $zip) -and (Get-Item $zip).Length -gt 1000000) { Write-Host ('  OK ' + (Get-Item $zip).Length); break }
    Write-Host '  failed'
    if (Test-Path $zip) { Remove-Item $zip -Force }
  }
}
Write-Host ('release zip: ' + $(if (Test-Path $zip) { (Get-Item $zip).Length } else { 'MISSING' }))

# ---- 2) tag source tarball (codeload) ----
if (-not (Test-Path $tgz) -or (Get-Item $tgz).Length -lt 10000) {
  if (Test-Path $tgz) { Remove-Item $tgz -Force }
  $u = 'https://codeload.github.com/Raatle/RTSAssist/tar.gz/refs/tags/v0.2.04exp'
  Write-Host ('trying ' + $u)
  & curl.exe -L -sS --max-time 300 -o $tgz $u 2>&1 | Out-String | Write-Host
}
Write-Host ('src tarball: ' + $(if (Test-Path $tgz) { (Get-Item $tgz).Length } else { 'MISSING' }))

# ---- 3) unpack release zip ----
$ex = Join-Path $tmp 'rel'
if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $zip) {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $ex)
  Write-Host ''
  Write-Host '=== release zip top level ==='
  Get-ChildItem -Force $ex | ForEach-Object { Write-Host ('  ' + $_.Name) }
  $root = (Get-ChildItem $ex -Directory | Select-Object -First 1).FullName
  Write-Host ('root=' + $root)
  Write-Host '=== mod_info.json ==='
  Get-Content (Join-Path $root 'mod_info.json') -Raw -Encoding UTF8
  Write-Host '=== version file ==='
  Get-ChildItem $root -Filter '*.version' | ForEach-Object { Write-Host ('--- ' + $_.Name); Get-Content $_.FullName -Raw -Encoding UTF8 }
  Write-Host '=== jars ==='
  Get-ChildItem -Recurse -File $root -Filter *.jar | ForEach-Object { Write-Host ('  ' + $_.FullName.Substring($root.Length + 1) + '  ' + $_.Length) }
  Write-Host '=== has src? ==='
  Write-Host ('  src dir: ' + (Test-Path (Join-Path $root 'src')))
  Write-Host '=== data tree ==='
  Get-ChildItem -Recurse -File (Join-Path $root 'data') -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('  ' + $_.FullName.Substring($root.Length + 1) + '  ' + $_.Length) }
}

# ---- 4) class file major version of the new jar ----
$jar = Get-ChildItem -Recurse -File $root -Filter 'RTSAssist.jar' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jar) {
  $z = [System.IO.Compression.ZipFile]::OpenRead($jar.FullName)
  $cls = $z.Entries | Where-Object { $_.FullName -like '*RTSAssistModPlugin.class' } | Select-Object -First 1
  if (-not $cls) { $cls = $z.Entries | Where-Object { $_.FullName -like '*.class' } | Select-Object -First 1 }
  $ms = New-Object System.IO.MemoryStream
  $cls.Open().CopyTo($ms)
  $b = $ms.ToArray()
  Write-Host ''
  Write-Host ('=== new jar class major = ' + ($b[6] * 256 + $b[7]) + ' minor = ' + ($b[4] * 256 + $b[5]) + '  (' + $cls.FullName + ')')
  Write-Host ('=== new jar entry count = ' + $z.Entries.Count)
  $z.Dispose()
}

# ---- 5) unpack source tarball ----
$sex = Join-Path $tmp 'src'
if (Test-Path $sex) { Remove-Item $sex -Recurse -Force }
if (Test-Path $tgz) {
  New-Item -ItemType Directory -Force -Path $sex | Out-Null
  & tar -xzf $tgz -C $sex 2>&1 | Out-String | Write-Host
  $sr = (Get-ChildItem $sex -Directory | Select-Object -First 1)
  Write-Host ('src root=' + $sr.FullName)
  Write-Host ('src java count=' + (Get-ChildItem -Recurse -File $sr.FullName -Filter *.java).Count)
}
