# verify_write_scripts.ps1 - dry-run / temp-copy tests for the repaired WRITE scripts.
# ASCII-only (PowerShell 5.1 reads BOM-less .ps1 as ANSI).
# Nothing here touches mods\RTSAssist or the delivered jar: all writes go to _work\_tmp\rtsa_scriptcheck\write.
$ErrorActionPreference = 'Continue'
$g = 'C:\game\StarSector.v0.9.8a-RC8'
$S = Join-Path $g '_work\skills\shared\scripts'
$W = Join-Path $g '_work\_tmp\rtsa_scriptcheck\write'
if (Test-Path $W) { Remove-Item $W -Recurse -Force }
New-Item -ItemType Directory -Force -Path $W | Out-Null

function Run($title, [scriptblock]$sb) {
  Write-Host ''
  Write-Host ('===== ' + $title + ' =====')
  & $sb
  Write-Host ('exit=' + $LASTEXITCODE)
}

# ---------- 1) migrate_json.js : plan.json ----------
$jsonDir = Join-Path $W 'json'
New-Item -ItemType Directory -Force -Path $jsonDir | Out-Null
$sample = @'
{
  # keep me: comment must survive (pseudo-JSON, no ConvertTo-Json rewrite)
  "name":"Sacred Word",
  "note":"keep",
}
'@
[System.IO.File]::WriteAllText((Join-Path $jsonDir 'custom_entities.json'), $sample, (New-Object System.Text.UTF8Encoding($false)))
$plan = @{
  root = $jsonDir
  ops  = @(
    @{ file = 'custom_entities.json'; find = '"name":"Sacred Word"'; repl = '"name":"sheng yan"'; note = 'defaultName -> zh' },
    @{ file = 'custom_entities.json'; find = '"note":"keep"'; repl = '"note":"kept"'; required = $false }
  )
} | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $W 'plan.json'), $plan, (New-Object System.Text.UTF8Encoding($false)))

Run 'migrate_json.js <plan.json> --dry' { node (Join-Path $S 'migrate_json.js') (Join-Path $W 'plan.json') --dry }
Run 'migrate_json.js <plan.json>' { node (Join-Path $S 'migrate_json.js') (Join-Path $W 'plan.json') }
Write-Host '--- result file (comment must still be there) ---'
Get-Content (Join-Path $jsonDir 'custom_entities.json') -Encoding UTF8

# ---------- 2) migrate_faction2.js : --dry on two copies ----------
$facDir = Join-Path $W 'fac'
New-Item -ItemType Directory -Force -Path $facDir | Out-Null
$oldF = @'
{
    "displayName":"Sheng Dian Qi Shi Tuan",
    "fleetTypeNames":{
        "patrolSmall":{"name":"Xun Luo Dui"},
    },
}
'@
$newF = @'
{
    "displayName":"Knights Templar",
    "fleetTypeNames":{
        "patrolSmall":{"name":"Patrol"},
    },
}
'@
# use real CJK via unicode escapes so this test file stays ASCII
$oldF = $oldF.Replace('Sheng Dian Qi Shi Tuan', [char]0x5723 + [char]0x6BBF + [char]0x9A91 + [char]0x58EB)
$oldF = $oldF.Replace('Xun Luo Dui', [char]0x5DE1 + [char]0x903B + [char]0x961F)
[System.IO.File]::WriteAllText((Join-Path $facDir 'old.faction'), $oldF, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $facDir 'new.faction'), $newF, (New-Object System.Text.UTF8Encoding($false)))

Run 'migrate_faction2.js <old> <new> --dry' { node (Join-Path $S 'migrate_faction2.js') (Join-Path $facDir 'old.faction') (Join-Path $facDir 'new.faction') --dry }
Write-Host '--- new.faction after DRY (must be unchanged / still English) ---'
Get-Content (Join-Path $facDir 'new.faction') -Encoding UTF8
Run 'migrate_faction2.js <old> <new>' { node (Join-Path $S 'migrate_faction2.js') (Join-Path $facDir 'old.faction') (Join-Path $facDir 'new.faction') }
Write-Host '--- new.faction after real run (displayName/patrolSmall should be CJK now) ---'
Get-Content (Join-Path $facDir 'new.faction') -Encoding UTF8

# ---------- 3) translate_missions.js : dry-run with a missionsDir copy ----------
$misDir = Join-Path $W 'missions'
$m1 = Join-Path $misDir 'tem_demo'
New-Item -ItemType Directory -Force -Path $m1 | Out-Null
$java = @'
public class MissionDefinition {
    void x() {
        addToFleet("Persean League security detachment");
        addBriefingItem("Defeat all enemy forces");
    }
}
'@
[System.IO.File]::WriteAllText((Join-Path $m1 'MissionDefinition.java'), $java, (New-Object System.Text.UTF8Encoding($false)))
$mapJson = @{
  tem_demo = @{
    'Persean League security detachment' = ([char]0x82F1 + [char]0x4ED9 + [char]0x5EA7 + [char]0x8054 + [char]0x76DF + [char]0x5B89 + [char]0x5168 + [char]0x5206 + [char]0x961F)
    'Defeat all enemy forces' = ([char]0x6D88 + [char]0x706D + [char]0x6240 + [char]0x6709 + [char]0x654C + [char]0x65B9 + [char]0x529B + [char]0x91CF)
  }
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $W 'missions_map.json'), $mapJson, (New-Object System.Text.UTF8Encoding($false)))
Run 'translate_missions.js <missionsDir> <map.json> --dry' { node (Join-Path $S 'translate_missions.js') $misDir (Join-Path $W 'missions_map.json') --dry }
Write-Host '--- java after DRY (must still be English) ---'
Get-Content (Join-Path $m1 'MissionDefinition.java') -Encoding UTF8
Run 'translate_missions.js <missionsDir> <map.json>' { node (Join-Path $S 'translate_missions.js') $misDir (Join-Path $W 'missions_map.json') }
Write-Host '--- java after real run (must be CJK, Java syntax intact) ---'
Get-Content (Join-Path $m1 'MissionDefinition.java') -Encoding UTF8

# ---------- 4) patchdir.js on a COPY of the jar classes (never the delivered jar) ----------
$cls = Join-Path $W 'classes'
Copy-Item (Join-Path $g '_work\_tmp\rtsa_scriptcheck\unpacked') $cls -Recurse -Force
$mapping = @{ 'Toggle RTS mode' = 'QIE HUAN RTS MO SHI'; 'Save Formations' = 'BAO CUN ZHEN XING' } | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $W 'mapping.json'), $mapping, (New-Object System.Text.UTF8Encoding($false)))
Run 'patchdir.js <mapping.json> <classDir> [outDir]' { node (Join-Path $S 'patchdir.js') (Join-Path $W 'mapping.json') $cls $W }
Write-Host ('--- missing_keys.json exists: ' + (Test-Path (Join-Path $W 'missing_keys.json')))
Run 'patchdir.js --help' { node (Join-Path $S 'patchdir.js') --help }
