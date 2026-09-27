# check_luna_diff.ps1 — Prove the patched Luna class differs ONLY by ldc string loads.
# NOTE: kept pure-ASCII on purpose: PowerShell 5.1 reads BOM-less .ps1 as ANSI/GBK, which mangles CJK.
$ErrorActionPreference = 'Continue'
$mw = 'C:\game\StarSector.v0.9.8a-RC8\_work\mod_work\RTSAssist'
$o = Join-Path $mw 'jarwork\RTSAssist_orig.jar'
$n = Join-Path $mw 'build\RTSAssist.jar'
$t = Join-Path $mw 'tools\compare_one_class.js'

$out = node $t $o $n 'data.scripts.modInitilisation.RTS_LunaIntegration' 2>&1 | Out-String
$lines = $out -split "`r?`n"

$minus = @($lines | Where-Object { $_ -match '^\s+- ' })
$plus = @($lines | Where-Object { $_ -match '^\s+\+ ' })
$nonLdcMinus = @($minus | Where-Object { $_ -notmatch 'ldc\s+#' })
$nonLdcPlus = @($plus | Where-Object { $_ -notmatch 'ldc\s+#' })

Write-Host ("diff lines: orig-side=" + $minus.Count + "  new-side=" + $plus.Count)
Write-Host ("non-ldc diffs: orig-side=" + $nonLdcMinus.Count + "  new-side=" + $nonLdcPlus.Count)
if ($nonLdcMinus.Count -or $nonLdcPlus.Count) {
  Write-Host 'WARN: non-string differences present:'
  $nonLdcMinus | Select-Object -First 10 | ForEach-Object { Write-Host ('  - ' + $_) }
  $nonLdcPlus | Select-Object -First 10 | ForEach-Object { Write-Host ('  + ' + $_) }
} else {
  Write-Host 'PASS: every difference is an ldc string load -> instruction sequence identical.'
}

$posA = @($minus | ForEach-Object { if ($_ -match ':\s*(\d+):') { $matches[1] } })
$posB = @($plus | ForEach-Object { if ($_ -match ':\s*(\d+):') { $matches[1] } })
$mis = 0
for ($i = 0; $i -lt [Math]::Min($posA.Count, $posB.Count); $i++) { if ($posA[$i] -ne $posB[$i]) { $mis++ } }
Write-Host ("instruction-offset mismatches: " + $mis + " (expect 0)")
$lines | Where-Object { $_ -match 'instr|instruction|line' } | ForEach-Object { Write-Host $_ }
