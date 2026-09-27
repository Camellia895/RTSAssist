// gen_v0204_worklists.js - 生成 0.2.04exp 的**规范版**待译清单到 out\worklist_0*.json
// （即注入脚本读取的位置），165 条自动复用 0.1.9c 旧译，10 条填入 AI 直译初稿（draft=true，待用户审校）。
const fs = require('fs');
const path = require('path');

const T = 'C:/game/StarSector.v0.9.8a-RC8/_work/_tmp/rtsassist_v0204/rel/RTSAssist';
const W = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist';
const OUT = path.join(W, 'out');
const LUNA = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';

const eol = s => s.replace(/\r\n/g, '\n').split('\n');
const readNew = p => fs.readFileSync(path.join(T, p), 'utf8').replace(/^\uFEFF/, '');
const readNewSrc = p => fs.readFileSync(path.join(T, 'src', p), 'utf8').replace(/^\uFEFF/, '');

// 旧译（0.1.9c，已冻结）
const zhOldDir = path.join(OUT, 'zh_corrected_0.1.9c');
const oldEn2Zh = new Map();
for (const f of fs.readdirSync(zhOldDir)) {
  if (!f.startsWith('worklist_')) continue;
  for (const e of JSON.parse(fs.readFileSync(path.join(zhOldDir, f), 'utf8'))) oldEn2Zh.set(e.en, e.zh);
}

// ---------- AI 直译初稿（10 条，待用户审校）----------
// 取证：沿用项目 0.1.9c 既有译名以保持跨层一致 —— Maximum Zoom=最大缩放级别、UI Scaling=界面缩放、
//       UI Command Volume=界面指令音量、UI Settings=界面设置。"Render" 上游为泛称视觉呈现，取「渲染」。
const DRAFT = new Map([
  ['Render Settings', '渲染设置'],
  ['Zoom Sensitivity', '缩放灵敏度'],
  ['How sensitive the scroll wheel is.', '滚轮缩放的灵敏度。'],
  ['Minimum Zoom', '最小缩放级别'],
  ['How far the player can zoom in.', '视角可向内拉近的最大视野距离。'],
  ['Render Scaling', '渲染缩放'],
  ['Manually adjust Render scaling. If using in game Render scaling this should not be necessary. If you are using nvidia upscaling for example, you will likely need to adjust this setting. Match the value with your scaling setting.', '手动调整渲染缩放比例。若已在游戏本体内启用了画面缩放，则通常无需调整此项。若使用了 NVIDIA 超分辨率等缩放功能，可能需要调整此项以匹配对应的缩放比例数值。'],
  ['Render Command Volume', '指令音量'],
  ['Change the default ZOOM SENSITIVITY. (a decimal number greater than 0)', '调整默认的缩放灵敏度。（填入大于 0 的小数）'],
  ['Change the default MINIMUM ZOOM. (a decimal number greater than 0)', '调整默认的最小缩放级别。（填入大于 0 的小数）'],
]);

const rows = [];
function push(shard, file, line, field, en, note) {
  const reused = oldEn2Zh.has(en);
  const draft = !reused && DRAFT.has(en);
  rows.push({
    shard, locator: `${file}#L${line}`, file, line, field, en,
    zh: reused ? oldEn2Zh.get(en) : (draft ? DRAFT.get(en) : ''),
    source: reused ? 'old-migrated' : 'new',
    draft: draft ? true : undefined,
    note: (reused ? '复用 0.1.9c 旧译（英文原文未变）' : (draft ? '★本版新增/改写 —— AI 直译初稿，待审校' : '★本版新增/改写 —— 待译'))
      + (note ? '｜' + note : ''),
  });
}

// ---------- 01 Luna ----------
{
  const lines = eol(readNewSrc(LUNA));
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('/*') || t.startsWith('//') || t.startsWith('*')) return;
    const m = l.match(/"((?:[^"\\]|\\.)*)"/);
    if (!m) return;
    const en = m[1];
    const isKey = /^(RTSA_|hotKeys$|config$|RTSAssist$|lunalib$)/.test(en) || /\.get\("([A-Za-z_]+)"\)/.test(l);
    if (isKey) return;
    if (!/[A-Za-z]{2,}/.test(en)) return;
    if (/^[a-z][A-Za-z0-9_]*$/.test(en)) return;
    push('01_luna', LUNA, i + 1, 'java-string-literal', en, 'LunaLib 设置界面（jar 层常量池补丁）');
  });
}
// ---------- 02 Config.ini ----------
{
  const lines = eol(readNew('Config.ini'));
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t.startsWith('#')) return;
    const body = t.replace(/^\s*#\s?/, '').replace(/\s+$/, '').replace(/^\*\*/, '').replace(/\*\*#?$/, '').trim();
    if (!body) return;
    if (/^[-#*=\s]+$/.test(body)) return;
    if (/^#+[A-Za-z]+#+$/.test(body)) return;
    if (!/[A-Za-z]{3,}/.test(body)) return;
    push('02_ini', 'Config.ini', i + 1, 'ini-comment', body, 'Config.ini 注释（数据层直接改文件）');
  });
}
// ---------- 03 Hotkeys.ini ----------
{
  const lines = eol(readNew('Hotkeys.ini'));
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t.startsWith('#')) return;
    const body = t.replace(/^\s*#\s?/, '').replace(/\s+$/, '').replace(/^\*\*/, '').replace(/\*\*#?$/, '').trim();
    if (!body) return;
    if (/^[-#*=\s]+$/.test(body)) return;
    if (/^#+[A-Za-z]+#+$/.test(body)) return;
    if (!/[A-Za-z]{3,}/.test(body)) return;
    push('03_ini', 'Hotkeys.ini', i + 1, 'ini-comment', body, 'Hotkeys.ini 注释（数据层直接改文件）');
  });
}
// ---------- 04 mod_info + 05 ReadMe ----------
{
  const lines = eol(readNew('mod_info.json'));
  const i = lines.findIndex(l => /"description"\s*:/.test(l));
  const en = (lines[i].match(/"description"\s*:\s*"([^"]*)"/) || [])[1];
  if (en) push('04_docs', 'mod_info.json', i + 1, 'json-string-value', en, '模组列表说明');
}
{
  const lines = eol(readNew('ReadMe.txt'));
  let n = 0;
  while (n < lines.length) {
    if (lines[n].trim() === '') { n++; continue; }
    const a = n + 1;
    const buf = [];
    while (n < lines.length && lines[n].trim() !== '') { buf.push(lines[n]); n++; }
    push('05_readme', 'ReadMe.txt', a, 'wholeText-block', buf.join('\n'), `ReadMe 文本块 L${a}-L${n}`);
  }
}

const shardFiles = {
  '01_luna': ['worklist_01_luna_settings.json', '0.2.04exp'],
  '02_ini': ['worklist_02_ini_comments.json', '0.2.04exp'],
  '03_ini': ['worklist_02_ini_comments.json', '0.2.04exp'],   // 与 Config.ini 合并进同一分片
  '04_docs': ['worklist_03_docs.json', '0.2.04exp'],
  '05_readme': ['worklist_03_docs.json', '0.2.04exp'],
};
const grouped = new Map();
for (const r of rows) {
  const f = shardFiles[r.shard][0];
  if (!grouped.has(f)) grouped.set(f, []);
  grouped.get(f).push(r);
}
const index = { mod: 'RTSAssist', version: '0.2.04exp', gameVersion: '0.98a-RC8', basedOn: '官方发布包 v0.2.04exp（仓库 main 落后，勿用）', shards: [] };
for (const [name, arr] of grouped) {
  arr.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(arr, null, 2), 'utf8');
  index.shards.push({
    file: name, entries: arr.length,
    reusable: arr.filter(r => r.source === 'old-migrated').length,
    draft: arr.filter(r => r.draft).length,
    needTranslation: arr.filter(r => !r.zh).length,
  });
}
index.totalEntries = rows.length;
index.totalReusable = rows.filter(r => r.source === 'old-migrated').length;
index.totalDraft = rows.filter(r => r.draft).length;
index.totalNeedTranslation = rows.filter(r => !r.zh).length;
fs.writeFileSync(path.join(OUT, 'worklist_index.json'), JSON.stringify(index, null, 2), 'utf8');

console.log('===== 0.2.04exp 规范清单已生成 =====');
for (const s of index.shards) {
  console.log(`  ${s.file.padEnd(34)} 共 ${String(s.entries).padStart(3)}  复用 ${String(s.reusable).padStart(3)}  AI直译 ${String(s.draft).padStart(2)}  仍空缺 ${s.needTranslation}`);
}
console.log(`  合计 ${index.totalEntries}  复用 ${index.totalReusable}  AI直译 ${index.totalDraft}  仍空缺 ${index.totalNeedTranslation}`);
if (index.totalNeedTranslation) {
  console.log('');
  console.log('!! 仍有空缺条目：');
  rows.filter(r => !r.zh).forEach(r => console.log('   ' + r.locator + '  ' + JSON.stringify(r.en)));
}
console.log('');
console.log('AI 直译初稿（待审校）：');
rows.filter(r => r.draft).forEach(r => console.log('  ' + JSON.stringify(r.en).slice(0, 100) + '\n      -> ' + JSON.stringify(r.zh)));
