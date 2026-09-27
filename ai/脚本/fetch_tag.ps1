$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$inst = "$g\mods\RTSAssist"
$tmp = "$g\_work\_tmp\rtsassist_tagcheck"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

foreach ($tag in @('v0.1.9c_98a')) {
    $safe = $tag -replace '[^0-9A-Za-z._-]', '_'
    $tgz = Join-Path $tmp "$safe.tar.gz"
    $url = "https://codeload.github.com/Raatle/RTSAssist/tar.gz/refs/tags/$tag"
    Write-Host "downloading $url"
    & curl.exe -L -sS -o $tgz $url
    if (-not (Test-Path $tgz) -or (Get-Item $tgz).Length -eq 0) { Write-Host "  FAILED/empty"; continue }
    Write-Host ("  size=" + (Get-Item $tgz).Length)
    $ex = Join-Path $tmp $safe
    if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $ex | Out-Null
    & tar -xzf $tgz -C $ex
    $sub = (Get-ChildItem $ex -Directory | Select-Object -First 1).FullName
    Write-Host "  extracted: $sub"
    Write-Host '  --- top level ---'
    Get-ChildItem -Force $sub | ForEach-Object { Write-Host ('    ' + $_.Name) }
    Write-Host '  --- src java compare vs installed ---'
    $same = 0; $diff = @(); $miss = @()
    Get-ChildItem -Recurse -File "$sub\src" -Filter *.java | ForEach-Object {
        $rel = $_.FullName.Substring("$sub\src".Length + 1)
        $t = Join-Path "$inst\src" $rel
        if (-not (Test-Path $t)) { $miss += $rel }
        elseif ((Get-FileHash $_.FullName -Algorithm SHA256).Hash -eq (Get-FileHash $t -Algorithm SHA256).Hash) { $same++ }
        else { $diff += $rel }
    }
    Write-Host ("    same=$same diff=" + $diff.Count + " missing_in_installed=" + $miss.Count)
    $diff | ForEach-Object { Write-Host ('    DIFF: ' + $_) }
    $miss | ForEach-Object { Write-Host ('    MISSING: ' + $_) }
    Write-Host '  --- installed-only java ---'
    Get-ChildItem -Recurse -File "$inst\src" -Filter *.java | ForEach-Object {
        $rel = $_.FullName.Substring("$inst\src".Length + 1)
        if (-not (Test-Path (Join-Path "$sub\src" $rel))) { Write-Host ('    EXTRA_INSTALLED: ' + $rel) }
    }
    Write-Host '  --- data/config compare ---'
    foreach ($f in @('mod_info.json', 'RTSAssist.version', 'Config.ini', 'Hotkeys.ini', 'data\config\settings.json', 'data\config\sounds.json', 'data\config\version\version_files.csv')) {
        $a = Join-Path $sub $f; $b = Join-Path $inst $f
        if (-not (Test-Path $a)) { Write-Host "    $f : ABSENT in tag"; continue }
        if (-not (Test-Path $b)) { Write-Host "    $f : ABSENT installed"; continue }
        $ha = (Get-FileHash $a -Algorithm SHA256).Hash; $hb = (Get-FileHash $b -Algorithm SHA256).Hash
        Write-Host ("    $f : " + $(if ($ha -eq $hb) { 'SAME' } else { 'DIFF' }))
    }
    Write-Host '  --- jar in tag? ---'
    Get-ChildItem -Recurse -File $sub -Filter *.jar | ForEach-Object { Write-Host ('    ' + $_.FullName.Substring($sub.Length + 1) + ' ' + $_.Length) }
}
