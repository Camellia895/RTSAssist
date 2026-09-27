// audit_literals.js — 独立审计：把源文件里所有「含空格且含字母」的字符串字面量列出，
// 与 jar 候选清单对照，找出"未被列为候选"的字面量（漏译风险）。
// 用法: node audit_literals.js <srcDir> <candidates.json> <outTsv>
const fs = require('fs');
const path = require('path');

const SRCDIR = process.argv[2];
const CAND = process.argv[3];
const OUT = process.argv[4];

const cand = JSON.parse(fs.readFileSync(CAND, 'utf8'));
const candSet = new Set(cand.map(r => r.c));

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
}

function stripComments(src) {
  let out = ''; let inBlock = false, inLine = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; out += '  '; i++; } else out += ' '; continue; }
    if (inLine) { if (c === '\n') { inLine = false; out += c; } else out += ' '; continue; }
    if (c === '/' && n === '/') { inLine = true; out += '  '; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; out += '  '; i++; continue; }
    out += c;
  }
  return out;
}

const rows = [];
for (const f of walk(SRCDIR)) {
  const rel = path.relative(SRCDIR, f).replace(/\\/g, '/');
  const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
  lines.forEach((line, idx) => {
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(line))) {
      const lit = m[1];
      const plain = lit.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\u0001/g, '\u0001');
      const words = plain.split(/\s+/).filter(w => /[A-Za-z]{2,}/.test(w));
      if (words.length >= 2) {
        rows.push({ file: rel, line: idx + 1, lit, inCand: candSet.has(lit), text: line.trim().slice(0, 200) });
      }
    }
  });
}
const tsv = ['file\tline\tinJarCandidates\tliteral\tsrcLine'];
for (const r of rows) tsv.push([r.file, r.line, r.inCand ? 'YES' : 'NO', JSON.stringify(r.lit), r.text].join('\t'));
fs.writeFileSync(OUT, tsv.join('\r\n'), 'utf8');
console.log('multi-word literals:', rows.length, '| NOT in jar candidates:', rows.filter(r => !r.inCand).length);
