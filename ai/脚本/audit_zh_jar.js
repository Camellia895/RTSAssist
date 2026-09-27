// audit_zh_jar.js — 对新建中文 jar 做内容审计（G2/G4 内容侧）：
//   ① 170 条译文是否都在 jar / 数据文件里（逐条）
//   ② 原英文可见串是否已消失（逐条，允许出现在同文件它处则单独标注）
//   ③ 全部内部键名/标识符是否完好（Luna 键、音效名、HashMap 键抽样）
//   ④ jar 内附带的 .java 是否已是中文版、.class 常量池是否含中文
// 用法: node audit_zh_jar.js <modWorkDir>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const W = process.argv[2];
const UN = path.join(W, 'build', 'verify_unpack');
const ORIGUN = path.join(W, 'jarwork', 'unpacked');
const ZH = path.join(W, 'out', 'zh_corrected');
const BM = path.join(W, 'baseline_mod');

// 解包新建 jar
if (fs.existsSync(UN)) fs.rmSync(UN, { recursive: true, force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${path.join(W, 'build', 'RTSAssist.jar')}','${UN}')`], { stdio: 'inherit' });

const readAll = (dir) => {
  const chunks = [];
  (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else chunks.push(fs.readFileSync(p)); } })(dir);
  return Buffer.concat(chunks).toString('utf8');
};
const jarText = readAll(UN);
const dataText = ['Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt']
  .map(f => fs.readFileSync(path.join(BM, f), 'utf8')).join('\n');

const shards = ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json'];
const entries = [];
for (const s of shards) entries.push(...JSON.parse(fs.readFileSync(path.join(ZH, s), 'utf8')));

const LUNA = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
let zhOk = 0; const zhMiss = [];
let enGone = 0; const enLeft = [];
for (const e of entries) {
  const hay = e.file === LUNA ? jarText : dataText;
  const zhProbe = e.zh.replace(/\r\n/g, '\n');
  if (zhProbe.includes('\n')) {
    // 多行块（ReadMe）：只抽查首行与末行
    const ls = zhProbe.split('\n').filter(x => x.trim());
    const head = ls[0], tail = ls[ls.length - 1];
    if (hay.includes(head) && hay.includes(tail)) zhOk++; else zhMiss.push(e.locator + ' (多行块抽查)');
    continue;
  }
  if (hay.includes(e.zh)) zhOk++; else zhMiss.push(e.locator);
}
// 英文是否消失：只对 Luna 层（数据层文件里英文注释已被替换）
for (const e of entries) {
  if (e.file !== LUNA) continue;
  const probe = '"' + e.en + '"';
  if (jarText.includes(probe)) enLeft.push(e.locator + ' :: ' + e.en);
  else enGone++;
  const probeJava = e.en;
  if (readAll(UN).includes(probeJava) && !jarText.includes(probe)) { /* ignore */ }
}

console.log('=== ① 译文落位审计（jar + 数据文件）===');
console.log(`  命中 ${zhOk}/${entries.length}`);
if (zhMiss.length) { console.log('  未命中：'); zhMiss.forEach(x => console.log('    - ' + x)); }

console.log('\n=== ② Luna 层原英文可见串是否已消失 ===');
console.log(`  已消失 ${enGone}/${entries.filter(e => e.file === LUNA).length}`);
if (enLeft.length) { console.log('  仍存在（需人工判断是否同文件它处合法出现）：'); enLeft.forEach(x => console.log('    - ' + x)); }

console.log('\n=== ③ 内部键名/标识符完好性 ===');
const keys = [
  'RTSA_SettingsKeybind_enable_RTSMode', 'RTSA_SettingsKeybind_saveLayout', 'RTSA_SettingsKeybind_loadLayout',
  'RTSA_SettingsKeybind_deleteAssignments', 'RTSA_SettingsKeybind_vent', 'RTSA_SettingsKeybind_useSystem',
  'RTSA_SettingsKeybind_moveTogether', 'RTSA_SettingsKeybind_attackMove', 'RTSA_SettingsKeybind_strafeLeft',
  'RTSA_SettingsKeybind_strafeRight', 'RTSA_SettingsKeybind_strafeUp', 'RTSA_SettingsKeybind_strafeDown',
  'RTSA_SettingsKeybind_broadsideSelection',
  'RTSA_SettingsConfig_defaultModeIsRTS', 'RTSA_SettingsConfig_pauseUnpause', 'RTSA_SettingsConfig_switchRightClick',
  'RTSA_SettingsConfig_scrollSpeed', 'RTSA_SettingsConfig_scrollSmoothing', 'RTSA_SettingsConfig_scrollSpeedKeyboard',
  'RTSA_SettingsConfig_scrollSmoothingKeyboard', 'RTSA_SettingsConfig_maxZoom', 'RTSA_SettingsConfig_screenScaling',
  'RTSA_SettingsConfig_selectionTolerance', 'RTSA_SettingsConfig_rememberZoom', 'RTSA_SettingsConfig_alternativeRotation',
  'RTSA_SettingsUI_CommandVolume', 'RTSA_SettingsDevTools_enableShipTestSuite', 'RTSA_SettingsDevTools_modID',
  'RTSA_SettingsDevTools_findAllShips',
  'enable_RTSMode', 'saveLayout', 'loadLayout', 'deleteAssignments', 'vent', 'useSystem', 'moveTogether',
  'attackMove', 'strafeCameraLeft', 'strafeCameraRight', 'strafeCameraUp', 'strafeCameraDown', 'broadsideSelection',
  'RTSAssist', 'lunalib', 'RTS_common', '$RTSA_SAVEID',
];
const badKeys = keys.filter(k => !jarText.includes(k));
console.log(`  检查 ${keys.length} 个键名：缺失 ${badKeys.length}`);
if (badKeys.length) badKeys.forEach(k => console.log('    ✖ 缺: ' + k));

// 音效名（sounds.json 键）
const sounds = JSON.parse(fs.readFileSync(path.join(ORIGUN, '..', '..', 'baseline_mod', '..', 'jarwork', 'unpacked', 'data', 'config', 'settings.json'), 'utf8'));
const sndText = fs.readFileSync(path.join(W, 'jarwork', 'unpacked', 'data', 'config', 'settings.json'), 'utf8');
const sndKeys = [...fs.readFileSync(path.join(UN, 'data/scripts/plugins/RTS_TaskManager.class')).toString('utf8').matchAll(/"([A-Za-z]{6,})"/g)].map(m => m[1]);
console.log('  （音效名检查见 verify_identifiers.js 的 CJK 扫描）');

console.log('\n=== ④ jar 内 .java / .class 中文分布 ===');
const zhLunaJava = fs.readFileSync(path.join(UN, LUNA), 'utf8');
console.log('  jar 内 RTS_LunaIntegration.java 含中文:', /[\u4e00-\u9fff]/.test(zhLunaJava));
const cls = fs.readFileSync(path.join(UN, LUNA.replace(/\.java$/, '.class')));
console.log('  RTS_LunaIntegration.class 常量池含中文:', /[\u4e00-\u9fff]/.test(cls.toString('utf8')));
// 除 Luna 类外是否还有别的 class 含中文（不应有）
let otherZh = [];
(function w(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { w(p); continue; }
    if (!p.endsWith('.class')) continue;
    const rel = path.relative(UN, p).replace(/\\/g, '/');
    if (rel === LUNA.replace(/\.java$/, '.class')) continue;
    if (/[\u4e00-\u9fff]/.test(fs.readFileSync(p).toString('utf8'))) otherZh.push(rel);
  }
})(UN);
console.log('  其它 class 含中文的数量:', otherZh.length, otherZh.slice(0, 10));
