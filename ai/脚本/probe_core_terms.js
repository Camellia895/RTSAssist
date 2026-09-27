// probe_core_terms.js - 在核心汉化数据里抽查新术语的既有用词（取证优先于自定，见 glossary.md 的取证顺序）。
// 同时给出本项目既有译名（0.1.9c 语料）里的相关用词。
const fs = require('fs');
const path = require('path');

const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
const CORE = path.join(GAME, 'starsector-core/data');

// 收集核心 data 下的文本文件（CSV/JSON/其他）
function walk(d, out) {
  let ents = [];
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(csv|json|txt|faction|version|json5)$/i.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(CORE, []);
console.log('core data text files scanned:', files.length);

const TERMS = [
  'Sensitivity', 'sensitivity',
  'Zoom', 'zoom', 'Zoom Out', 'Zoom In',
  'Render', 'Rendering',
  'Scaling', 'scale',
  'Volume',
  'scroll wheel', 'Mouse Wheel',
  'Minimum', 'Maximum',
];

// 找出同时含英文术语与中文的行（= 该术语的中文对应线索）
const hitsByTerm = new Map(TERMS.map(t => [t, []]));
for (const f of files) {
  let t;
  try { t = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (!/[\u4e00-\u9fff]/.test(t)) continue;              // 只看已汉化的文件
  const lines = t.split(/\r?\n/);
  lines.forEach((l, i) => {
    for (const term of TERMS) {
      if (!l.includes(term)) continue;
      const zh = l.match(/[\u4e00-\u9fff][^\r\n]*/);
      if (!zh) continue;
      if (hitsByTerm.get(term).length >= 6) continue;
      hitsByTerm.get(term).push({ file: path.relative(CORE, f).replace(/\\/g, '/'), line: i + 1, text: l.trim().slice(0, 150) });
    }
  });
}
for (const term of TERMS) {
  const hits = hitsByTerm.get(term);
  if (!hits.length) continue;
  console.log('');
  console.log('=== "' + term + '" (' + hits.length + ' 例) ===');
  hits.forEach(h => console.log('  ' + h.file + ':' + h.line + '  ' + h.text));
}

// 本项目既有译名（0.1.9c）里的相关用词
console.log('');
console.log('=== 本项目 0.1.9c 旧译里的相关条目 ===');
const zhDir = path.join(GAME, '_work/mod_work/RTSAssist/out/zh_corrected');
for (const f of fs.readdirSync(zhDir)) {
  if (!f.startsWith('worklist_')) continue;
  for (const e of JSON.parse(fs.readFileSync(path.join(zhDir, f), 'utf8'))) {
    if (/zoom|scal|volume|sensitivity|render/i.test(e.en)) {
      console.log('  EN: ' + JSON.stringify(e.en).slice(0, 110));
      console.log('  ZH: ' + JSON.stringify(e.zh).slice(0, 110));
    }
  }
}
