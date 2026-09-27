// build_diff_plan.js - precise, per-line diff between 0.1.9c and 0.2.04exp for every translatable surface.
// Output (out_v0204/):
//   diff_plan.json      per-file, per-line: { line, status: same|changed|added|removed, en_old, en_new, zh_old }
//   summary            counts the translator needs
const fs = require('fs');
const path = require('path');

const T = 'C:/game/StarSector.v0.9.8a-RC8/_work/_tmp/rtsassist_v0204/rel/RTSAssist';
const OLD = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/baseline_mod';
const NEWREL = T;
const OUT = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/out_v0204';
fs.mkdirSync(OUT, { recursive: true });

const LUNA = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
const OLD_SRC = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/baseline/src';

// ---- old translations ----
const zhDir = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/out/zh_corrected';
const oldEn2Zh = new Map();
const oldByLocator = new Map();
for (const f of fs.readdirSync(zhDir)) {
  if (!f.startsWith('worklist_')) continue;
  for (const e of JSON.parse(fs.readFileSync(path.join(zhDir, f), 'utf8'))) {
    oldEn2Zh.set(e.en, e.zh);
    oldByLocator.set(e.locator, e);
  }
}

const show = s => JSON.stringify(s === undefined ? null : s).slice(0, 120);
function lines(p) { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/); }

// ---------- 1) LunaIntegration.java: compare "interesting" lines (those with a string literal) ----------
const oldLuna = lines(path.join(OLD_SRC, LUNA));
const newLuna = lines(path.join(NEWREL, 'src', LUNA));
const litOf = l => { const m = l.match(/"((?:[^"\\]|\\.)*)"/); return m ? m[1] : null; };
const oldLits = oldLuna.map((l, i) => ({ n: i + 1, lit: litOf(l) })).filter(x => x.lit !== null);
const newLits = newLuna.map((l, i) => ({ n: i + 1, lit: litOf(l) })).filter(x => x.lit !== null);

// match by key: settings ID / hotkey ID present on the line, else by the literal itself
const idOf = l => {
  const m = l.match(/"(RTSA_Settings[A-Za-z_]*)"|(hotPointer|confPointer)\.get\("([A-Za-z_]+)"\)/);
  if (!m) return null;
  return m[1] || m[3];
};
const lunaRows = [];
const oldByLit = new Map(oldLits.map(x => [x.lit, x]));
const newByLit = new Map(newLits.map(x => [x.lit, x]));
for (const nl of newLits) {
  if (oldByLit.has(nl.lit)) lunaRows.push({ newLine: nl.n, status: 'same-en', en: nl.lit, zh: oldEn2Zh.get(nl.lit) || '' });
  else lunaRows.push({ newLine: nl.n, status: 'new', en: nl.lit, zh: '' });
}
for (const ol of oldLits) {
  if (!newByLit.has(ol.lit)) lunaRows.push({ oldLine: ol.n, status: 'removed-en', en: ol.lit, zh: oldEn2Zh.get(ol.lit) || '' });
}
lunaRows.sort((a, b) => (a.newLine || a.oldLine) - (b.newLine || b.oldLine));

// ---------- 2) ini files: line-by-line ----------
function iniDiff(name) {
  const o = lines(path.join(OLD, name));
  const n = lines(path.join(NEWREL, name));
  const rows = [];
  const max = Math.max(o.length, n.length);
  for (let i = 0; i < max; i++) {
    const ol = o[i], nl = n[i];
    if (ol === nl) { if (nl !== undefined && nl.trim() !== '') rows.push({ line: i + 1, status: 'same', text: nl }); continue; }
    rows.push({ line: i + 1, status: ol === undefined ? 'added' : (nl === undefined ? 'removed' : 'changed'), old: ol, new: nl });
  }
  return rows;
}

// ---------- 3) mod_info.json / ReadMe.txt ----------
function fileDiff(name) {
  const o = lines(path.join(OLD, name));
  const n = lines(path.join(NEWREL, name));
  const same = o.length === n.length && o.every((l, i) => l === n[i]);
  return { identical: same, oldLines: o.length, newLines: n.length };
}

const report = {
  luna: {
    file: LUNA,
    totals: {
      same_en: lunaRows.filter(r => r.status === 'same-en').length,
      new_en: lunaRows.filter(r => r.status === 'new').length,
      removed_en: lunaRows.filter(r => r.status === 'removed-en').length,
    },
    rows: lunaRows,
  },
  ini: { Config: iniDiff('Config.ini'), Hotkeys: iniDiff('Hotkeys.ini') },
  files: {
    'mod_info.json': fileDiff('mod_info.json'),
    'ReadMe.txt': fileDiff('ReadMe.txt'),
  },
};
fs.writeFileSync(path.join(OUT, 'diff_plan.json'), JSON.stringify(report, null, 2), 'utf8');

// ---------- print ----------
console.log('===== LunaIntegration.java（界面文案）=====');
console.log('  英文未变（可直接复用旧译）: ' + report.luna.totals.same_en);
console.log('  英文新增/改写（需新译）  : ' + report.luna.totals.new_en);
console.log('  英文被删除（旧译作废）    : ' + report.luna.totals.removed_en);
console.log('');
console.log('--- 新增/改写明细 ---');
report.luna.rows.filter(r => r.status === 'new').forEach(r => console.log('  L' + r.newLine + '  ' + show(r.en)));
console.log('');
console.log('--- 被删除明细（旧译将不再生效）---');
report.luna.rows.filter(r => r.status === 'removed-en').forEach(r => console.log('  L' + r.oldLine + '  ' + show(r.en) + '   旧译=' + show(r.zh)));

for (const [name, rows] of [['Config.ini', report.ini.Config], ['Hotkeys.ini', report.ini.Hotkeys]]) {
  const added = rows.filter(r => r.status === 'added');
  const changed = rows.filter(r => r.status === 'changed');
  const removed = rows.filter(r => r.status === 'removed');
  const same = rows.filter(r => r.status === 'same');
  console.log('');
  console.log('===== ' + name + ' =====');
  console.log('  完全相同的行: ' + same.length + '  changed: ' + changed.length + '  added: ' + added.length + '  removed: ' + removed.length);
  changed.forEach(r => { console.log('  ~ L' + r.line + '\n      旧: ' + show(r.old) + '\n      新: ' + show(r.new)); });
  added.forEach(r => console.log('  + L' + r.line + '  ' + show(r.new)));
  removed.forEach(r => console.log('  - L' + r.line + '  ' + show(r.old)));
}

console.log('');
console.log('===== mod_info.json / ReadMe.txt =====');
for (const [k, v] of Object.entries(report.files)) {
  console.log('  ' + k + ': identical=' + v.identical + '  oldLines=' + v.oldLines + '  newLines=' + v.newLines);
}
console.log('');
console.log('-> ' + path.join(OUT, 'diff_plan.json'));
