// build_worklist_v0204.js - 用「内容匹配」而不是行号，算出 0.2.04exp 的真实待译工作量：
//   对每个翻译面（Luna 界面 / Config.ini / Hotkeys.ini / mod_info / ReadMe），
//   逐条按 **英文原文** 去 0.1.9c 的译文里查：
//     en 原样存在  -> old-migrated（复用旧译，zh 预填）
//     en 是新的    -> new（待译，zh 留空）
//   并列出「旧译中在本版消失」的条目（提醒译者这些不再生效）。
// 用法: node build_worklist_v0204.js <outDir>
const fs = require('fs');
const path = require('path');

const T = 'C:/game/StarSector.v0.9.8a-RC8/_work/_tmp/rtsassist_v0204/rel/RTSAssist';
const W = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist';
const OUT = process.argv[2] || path.join(W, 'out_v0204');
fs.mkdirSync(OUT, { recursive: true });

const LUNA = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
const eol = s => s.replace(/\r\n/g, '\n').split('\n');
const readNew = p => fs.readFileSync(path.join(T, p), 'utf8').replace(/^\uFEFF/, '');
const readNewSrc = p => fs.readFileSync(path.join(T, 'src', p), 'utf8').replace(/^\uFEFF/, '');

// ---- 旧译（en -> zh）----
const zhDir = path.join(W, 'out', 'zh_corrected');
const oldEn2Zh = new Map();
for (const f of fs.readdirSync(zhDir)) {
  if (!f.startsWith('worklist_')) continue;
  for (const e of JSON.parse(fs.readFileSync(path.join(zhDir, f), 'utf8'))) oldEn2Zh.set(e.en, e.zh);
}

const rows = [];      // 待译清单（新版本）
const obsoleted = []; // 旧译在本版消失

function push(shard, file, line, field, en, note) {
  const reused = oldEn2Zh.has(en);
  rows.push({
    shard, locator: `${file}#L${line}`, file, line, field, en,
    zh: reused ? oldEn2Zh.get(en) : '',
    source: reused ? 'old-migrated' : 'new',
    note: (note || '') + (reused ? '｜复用 0.1.9c 旧译' : '｜本版新增/改写，待译'),
  });
}

// ---------- 1) LunaIntegration.java ----------
{
  const lines = eol(readNewSrc(LUNA));
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('/*') || t.startsWith('//') || t.startsWith('*')) return;
    const m = l.match(/"((?:[^"\\]|\\.)*)"/);
    if (!m) return;
    const en = m[1];
    // 只要「可见文案」：页签名 / 标题 / 说明。键名与 hotPointer.get 的键排除。
    const isKey = /^(RTSA_|hotKeys$|config$|RTSAssist$|lunalib$)/.test(en) || /\.get\("([A-Za-z_]+)"\)/.test(l);
    if (isKey) return;
    if (!/[A-Za-z]{2,}/.test(en)) return;
    // 单 token 小写标识符（assignment 的字段名等）排除
    if (/^[a-z][A-Za-z0-9_]*$/.test(en)) return;
    push('01_luna', LUNA, i + 1, 'java-string-literal', en, 'LunaLib 设置界面');
  });
  // 旧译里属于 Luna 但本版没有的
  const oldLuna = JSON.parse(fs.readFileSync(path.join(zhDir, 'worklist_01_luna_settings.json'), 'utf8'));
  const newSet = new Set(rows.filter(r => r.shard === '01_luna').map(r => r.en));
  for (const e of oldLuna) if (!newSet.has(e.en) && e.en !== 'modID') obsoleted.push({ file: LUNA, en: e.en, zh: e.zh });
}

// ---------- 2) ini 注释 ----------
function iniComments(file, shard, note) {
  const lines = eol(readNew(file));
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t.startsWith('#')) return;
    let body = t.replace(/^\s*#\s?/, '').replace(/\s+$/, '').replace(/^\*\*/, '').replace(/\*\*#?$/, '').trim();
    if (!body) return;
    if (/^[-#*=\s]+$/.test(body)) return;      // 分隔线
    if (/^#+[A-Za-z]+#+$/.test(body)) return;  // 装饰性标签行（##Config## / ##Hotkeys##），非句子
    if (!/[A-Za-z]{3,}/.test(body)) return;
    push(shard, file, i + 1, 'ini-comment', body, note);
  });
}
iniComments('Config.ini', '02_config', 'Config.ini 注释');
iniComments('Hotkeys.ini', '03_hotkeys', 'Hotkeys.ini 注释');

// ---------- 3) mod_info.json description ----------
{
  const lines = eol(readNew('mod_info.json'));
  const i = lines.findIndex(l => /"description"\s*:/.test(l));
  if (i >= 0) {
    const en = (lines[i].match(/"description"\s*:\s*"([^"]*)"/) || [])[1];
    if (en) push('04_docs', 'mod_info.json', i + 1, 'json-string-value', en, '模组列表说明');
  }
}

// ---------- 4) ReadMe.txt 全文块 ----------
{
  const lines = eol(readNew('ReadMe.txt'));
  let n = 0;
  const blocks = [];
  while (n < lines.length) {
    if (lines[n].trim() === '') { n++; continue; }
    const start = n;
    const buf = [];
    while (n < lines.length && lines[n].trim() !== '') { buf.push(lines[n]); n++; }
    blocks.push({ a: start + 1, b: n, en: buf.join('\n') });
  }
  for (const b of blocks) push('05_readme', 'ReadMe.txt', b.a, 'wholeText-block', b.en, `ReadMe 文本块 L${b.a}-L${b.b}`);
}

// ---------- 5) 旧译里在 ReadMe/mod_info 层消失的 ----------
{
  const oldDocs = [
    ...JSON.parse(fs.readFileSync(path.join(zhDir, 'worklist_03_docs.json'), 'utf8')),
  ];
  const newSet = new Set(rows.filter(r => r.shard === '04_docs' || r.shard === '05_readme').map(r => r.en));
  for (const e of oldDocs) if (!newSet.has(e.en)) obsoleted.push({ file: e.file, en: e.en, zh: e.zh });
}

// ---------- 写盘 ----------
const shardNames = {
  '01_luna': 'worklist_v0204_01_luna_settings.json',
  '02_config': 'worklist_v0204_02_config_ini.json',
  '03_hotkeys': 'worklist_v0204_03_hotkeys_ini.json',
  '04_docs': 'worklist_v0204_04_modinfo.json',
  '05_readme': 'worklist_v0204_05_readme.json',
};
const index = { mod: 'RTSAssist', version: '0.2.04exp', gameVersion: '0.98a-RC8', shards: [] };
for (const [shard, name] of Object.entries(shardNames)) {
  const arr = rows.filter(r => r.shard === shard);
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(arr, null, 2), 'utf8');
  index.shards.push({
    file: name, entries: arr.length,
    reusable: arr.filter(r => r.source === 'old-migrated').length,
    needTranslation: arr.filter(r => r.source === 'new').length,
  });
}
index.totalEntries = rows.length;
index.totalReusable = rows.filter(r => r.source === 'old-migrated').length;
index.totalNeedTranslation = rows.filter(r => r.source === 'new').length;
index.obsoleted = obsoleted.length;
fs.writeFileSync(path.join(OUT, 'worklist_v0204_index.json'), JSON.stringify(index, null, 2), 'utf8');
fs.writeFileSync(path.join(OUT, 'obsoleted_old_translations.json'), JSON.stringify(obsoleted, null, 2), 'utf8');

console.log('===== 0.2.04exp 待译清单 =====');
for (const s of index.shards) {
  console.log(`  ${s.file.padEnd(38)} 共 ${String(s.entries).padStart(3)} 条  可复用 ${String(s.reusable).padStart(3)}  待新译 ${String(s.needTranslation).padStart(3)}`);
}
console.log(`  ${'合计'.padEnd(38)} 共 ${String(index.totalEntries).padStart(3)} 条  可复用 ${String(index.totalReusable).padStart(3)}  待新译 ${String(index.totalNeedTranslation).padStart(3)}`);
console.log('');
console.log('待新译明细：');
rows.filter(r => r.source === 'new').forEach(r => console.log('  [' + r.shard + '] ' + r.locator + '  ' + JSON.stringify(r.en).slice(0, 120)));
console.log('');
console.log('旧译在本版失效：' + obsoleted.length + ' 条');
obsoleted.forEach(o => console.log('  - ' + o.file + '  ' + JSON.stringify(o.en).slice(0, 100)));
console.log('');
console.log('-> ' + OUT);
