// 生成紧凑的可读候选清单（TSV），便于人工/AI 逐条分类。
// 用法: node dump_candidates.js <candidates.json> <out.tsv>
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const lines = [];
lines.push(['#', 'classes', 'src', 'asId', 'text'].join('\t'));
rows.forEach((r, i) => {
  const cls = r.classes.map(c => c.replace(/\.class$/, '').replace(/^.*\//, '')).join('|');
  const src = (r.src[0] ? r.src[0].ctx + ' :: ' + r.src[0].lineText : '').replace(/\t/g, ' ');
  const t = JSON.stringify(r.c);
  lines.push([i, cls, src, r.asId ? 'ID' : '', t].join('\t'));
});
fs.writeFileSync(out, lines.join('\r\n'), 'utf8');
console.log('rows:', rows.length, '->', out);
