// inspect_commons.js — 判断 RTS_CommonsControl$1 的来源，并比对官方/新建 jar 的 MANIFEST。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TMP = process.argv[2];
const ORIG = process.argv[3];

const SRC = path.join(TMP, 'baseline', 'src', 'data/scripts/modInitilisation/RTS_CommonsControl.java');
const src = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
src.forEach((l, i) => {
  if (/switch|enum|JSONType|case\s/.test(l)) console.log(String(i + 1).padStart(4) + ': ' + l.trim());
});

console.log('\n=== 官方 jar 的 MANIFEST ===');
const unOrig = path.join(TMP, 'orig_unpack');
if (fs.existsSync(unOrig)) fs.rmSync(unOrig, { recursive: true, force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${ORIG}','${unOrig}')`], { stdio: 'inherit' });
const mf = path.join(unOrig, 'META-INF', 'MANIFEST.MF');
console.log(fs.existsSync(mf) ? fs.readFileSync(mf, 'utf8') : '(官方 jar 无 MANIFEST)');

console.log('\n=== 新建 jar 的 MANIFEST ===');
const mf2 = path.join(TMP, 'verify_unpack', 'META-INF', 'MANIFEST.MF');
console.log(fs.existsSync(mf2) ? fs.readFileSync(mf2, 'utf8') : '(新建 jar 无 MANIFEST)');

console.log('\n=== RTS_CommonsControl$1.class 在官方 jar 里的反编译（javap -p -c 摘要）===');
const javap = 'C:/Program Files/Android/Android Studio/jbr/bin/javap.exe';
try {
  const out = execFileSync(javap, ['-p', '-c', '-classpath', ORIG, 'data.scripts.modInitilisation.RTS_CommonsControl$1'], { encoding: 'utf8' });
  console.log(out.split(/\r?\n/).slice(0, 60).join('\n'));
} catch (e) { console.log('javap 失败: ' + e.message); }
