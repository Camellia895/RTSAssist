// self_test_pipeline.js — 端到端自检：在**独立临时工作区**用占位译文跑完 注入→编译→重建 jar→自检。
// 不触碰真实 mod 目录，也不改动用户待译的 out\worklist_*.json。
// 用法: node self_test_pipeline.js <realModWorkDir> <tempTestWorkDir>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REAL = process.argv[2];
const TMP = process.argv[3];
if (!REAL || !TMP) { console.error('usage: node self_test_pipeline.js <realModWorkDir> <tempTestWorkDir>'); process.exit(1); }

// 1) 复制工作区（只复制必要部分）
if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const copy = (rel) => execFileSync('powershell', ['-NoProfile', '-Command',
  `Copy-Item -Recurse -Force '${path.join(REAL, rel)}' '${path.join(TMP, rel)}'`], { stdio: 'inherit' });
for (const d of ['out', 'baseline', 'baseline_mod', 'jarwork', 'tools']) copy(d);

// 2) 给 out\worklist_0*.json 填占位译文（[ZH] 前缀，纯 ASCII+中文标记，便于肉眼识别是测试数据）
const shards = ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json'];
let n = 0;
for (const s of shards) {
  const p = path.join(TMP, 'out', s);
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const e of arr) { e.zh = '【测试】' + e.en.replace(/\s+/g, ' ').slice(0, 40); n++; }
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), 'utf8');
}
console.log(`占位译文已填：${n} 条`);

// 3) 跑真注入（在临时工作区）
console.log('\n=== 自检：--apply 跑真注入 ===');
const code = (() => {
  try { execFileSync(process.execPath, [path.join(TMP, 'tools', 'build_inject.js'), TMP, '--apply'], { stdio: 'inherit' }); return 0; }
  catch (e) { return e.status === undefined ? 1 : e.status; }
})();
console.log('build_inject exit =', code);

// 4) 自检产物
const newJar = path.join(TMP, 'build', 'RTSAssist.jar');
const origJar = path.join(TMP, 'jarwork', 'RTSAssist_orig.jar');
console.log('\n=== 产物自检 ===');
console.log('新 jar 存在:', fs.existsSync(newJar), fs.existsSync(newJar) ? fs.statSync(newJar).size + ' bytes' : '');

// 4a) 解包新 jar，比对类集合
const un = path.join(TMP, 'verify_unpack');
if (fs.existsSync(un)) fs.rmSync(un, { recursive: true, force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${newJar}','${un}')`], { stdio: 'inherit' });

const walkNames = (dir, ext) => {
  const out = [];
  (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else if (p.endsWith(ext)) out.push(path.relative(dir, p).replace(/\\/g, '/')); } })(dir);
  return out;
};
const newCls = walkNames(un, '.class');
const oldCls = walkNames(path.join(TMP, 'jarwork', 'unpacked'), '.class');
console.log(`class 数：官方 ${oldCls.length} / 新建 ${newCls.length}`);
const lost = oldCls.filter(x => !newCls.includes(x));
const added = newCls.filter(x => !oldCls.includes(x));
console.log('  丢失的类:', lost.length ? lost : '无 ✔');
console.log('  新增的类:', added.length ? added : '无');
const newJava = walkNames(un, '.java');
console.log(`jar 内 .java 数：官方 84 / 新建 ${newJava.length}`);

// 4b) 检查 Luna 类里译文是否进了常量池、键名是否完好
const jarText = fs.readFileSync(path.join(un, 'data/scripts/modInitilisation/RTS_LunaIntegration.class'));
const contains = (s) => jarText.includes(Buffer.from(s, 'utf8'));
console.log('\nLunaIntegration.class 常量池检查：');
console.log('  译文标记【测试】存在:', contains('【测试】'));
for (const key of ['RTSA_SettingsKeybind_vent', 'RTSA_SettingsConfig_maxZoom', 'RTSA_SettingsDevTools_modID', 'enable_RTSMode', 'UICommandVolume']) {
  console.log(`  键名完好 ${key}:`, contains(key));
}
console.log('  原英文标题已消失 "Toggle RTS mode":', !contains('Toggle RTS mode'));

// 4c) 数据层文件检查
console.log('\n数据层文件检查：');
for (const rel of ['Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt']) {
  const p = path.join(TMP, 'baseline_mod', rel);
  const t = fs.readFileSync(p, 'utf8');
  console.log(`  ${rel}: 含【测试】=${t.includes('【测试】')}  BOM=${t.charCodeAt(0) === 0xFEFF ? '有(BAD)' : '无 ✔'}`);
}
console.log('\n自检结束。产物在 ' + path.join(TMP, 'build'));
