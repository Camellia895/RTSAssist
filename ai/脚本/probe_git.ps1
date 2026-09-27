$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$src = "$g\_work\mod_src\RTSAssist"
$inst = "$g\mods\RTSAssist"
$tmp = "$g\_work\_tmp\rtsassist_repo"

Write-Host '=== git fetch tags/commits in mod_src ==='
git -C $src fetch origin --tags 2>&1 | Out-String
Write-Host '=== installed version vs tag files ==='
Write-Host ('HEAD: ' + (git -C $src rev-parse --short HEAD 2>&1))
Write-Host ('v0.1.9c_98a: ' + (git -C $src rev-parse --short v0.1.9c_98a 2>&1))
Write-Host ('v0.2.04exp: ' + (git -C $src rev-parse --short v0.2.04exp 2>&1))
Write-Host '--- diff stat: installed src vs tag v0.1.9c_98a (files changed) ---'
git -C $src diff --stat v0.1.9c_98a -- . 2>&1 | Out-String
Write-Host '--- does tag contain RTS_Arma.java? ---'
git -C $src ls-tree -r --name-only v0.1.9c_98a 2>&1 | Select-String -Pattern 'RTS_Arma|RTS_Volantian|FOR MODDERS' | Out-String
