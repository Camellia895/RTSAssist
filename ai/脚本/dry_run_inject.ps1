# dry_run_inject.ps1 — 阶段3 注入器自检：先把官方 jar 备份到工作区，再跑 dry-run（不写任何文件）。
$ErrorActionPreference = 'Stop'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$mw = Join-Path $g '_work\mod_work\RTSAssist'

# 官方 jar 备份（*.orig），供 D4 校验与回滚（注意：PowerShell 的 $W 是自动变量，别拿来当变量名）
$orig = Join-Path $mw 'jarwork\RTSAssist_orig.jar'
if (-not (Test-Path -LiteralPath $orig)) {
  Copy-Item -LiteralPath (Join-Path $g 'mods\RTSAssist\jars\RTSAssist.jar') -Destination $orig -Force
  Write-Host "jar 原版备份 -> $orig"
} else { Write-Host "jar 原版备份已存在: $orig" }

Write-Host ''
Write-Host '=== 注入器 dry-run ==='
node (Join-Path $mw 'tools\build_inject.js') $mw
Write-Host "exit=$LASTEXITCODE"
