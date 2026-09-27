// build_worklist2.js — 追加分片：mod 元数据与文档（mod_info.json / ReadMe.txt）。
// 用法: node build_worklist2.js <outDir>
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node build_worklist2.js <outDir>'); process.exit(1); }
const BM = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/baseline_mod/';

const read = p => fs.readFileSync(path.resolve(BM, p), 'utf8').replace(/^\uFEFF/, '');
const linesOf = p => read(p).replace(/^\uFEFF/, '').split(/\r?\n/);

const errors = [];
const entries = [];

// --- mod_info.json：# description（模组列表中显示） ---
const mi = read('mod_info.json');
const miLines = mi.split(/\r?\n/);
const miLine = miLines.findIndex(l => /"description"\s*:/.test(l)) + 1;
const miEn = (miLines[miLine - 1].match(/"description"\s*:\s*"([^"]*)"/) || [])[1];
if (!miEn) errors.push('mod_info.json: 未找到 description 值');
entries.push({
  locator: 'mod_info.json#L' + miLine + '&field=description',
  file: 'mod_info.json',
  line: miLine,
  field: 'json-string-value',
  en: miEn || '',
  zh: '',
  source: 'new',
  note: '模组列表里显示的英文说明（JSON 值，回填时只替换引号内文本；"name":"RTSAssist" 是模组名，按社区习惯保持不译）',
});

// --- ReadMe.txt：删除线标题/正文逐块 ---
// 采用 wholeText 分块：以连续非空文本块为单位，块内保持相对行序。
const rmLines = linesOf('ReadMe.txt');
let rmLine = 1;
while (rmLine <= rmLines.length) {
  // 跳过空行
  if (rmLines[rmLine - 1].trim() === '') { rmLine++; continue; }
  const start = rmLine;
  const buf = [];
  while (rmLine <= rmLines.length && rmLines[rmLine - 1].trim() !== '') { buf.push(rmLines[rmLine - 1]); rmLine++; }
  const en = buf.join('\n');
  if (en.trim() === '') continue;
  entries.push({
    locator: `ReadMe.txt#L${start}-L${rmLine - 1}`,
    file: 'ReadMe.txt',
    line: start,
    field: 'wholeText-block',
    en,
    zh: '',
    source: 'new',
    note: '玩家说明书文本块（原样保留块内换行与缩进；URL 与热键字母不改）',
  });
}

const out = path.join(OUT, 'worklist_03_docs.json');
fs.writeFileSync(out, JSON.stringify(entries, null, 2).replace(/\n/g, '\r\n') + '\r\n', 'utf8');
console.log('worklist_03_docs.json entries:', entries.length, '(mod_info 1 + ReadMe blocks ' + (entries.length - 1) + ')');
if (errors.length) { errors.forEach(e => console.log('ERR ' + e)); process.exit(2); }
