// prove_equivalence.js — 证明重编译产物与官方 jar 「非字符串部分完全等价」：
//   ① 从两个 jar 的每个 class 常量池抽出全部字符串常量（tag=8 引用且非标识符），排序成签名；
//   ② 用 javap -p -c 反汇编，把 ldc/字符串常量替换为占位符后逐行比对；
//   ③ 输出：结构等价 / 含非字符串差异的类清单（后者即潜在风险点）。
// 用法: node prove_equivalence.js <modWorkDir>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const W = process.argv[2];
const ORIG = path.join(W, 'jarwork', 'RTSAssist_orig.jar');
const NEW = path.join(W, 'build', 'RTSAssist.jar');
const JAVAP = 'C:/Program Files/Android/Android Studio/jbr/bin/javap.exe';
const ORIGUN = path.join(W, 'jarwork', 'unpacked');
const NEWUN = path.join(W, 'build', 'verify_unpack');

function listClasses(dir) {
  const out = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (p.endsWith('.class')) out.push(path.relative(dir, p).replace(/\\/g, '/'));
    }
  })(dir);
  return out.sort();
}

// 极简 class 常量池 Utf8 抽取（tag=1）
function utf8Constants(buf) {
  const out = [];
  let p = 8;
  const count = (buf[p] << 8) | buf[p + 1]; p += 2;
  for (let i = 1; i < count; i++) {
    const tag = buf[p]; p += 1;
    switch (tag) {
      case 1: { const len = (buf[p] << 8) | buf[p + 1]; p += 2; const s = buf.toString('utf8', p, p + len); p += len; out.push(s); break; }
      case 3: case 4: p += 4; break;
      case 5: case 6: p += 8; i++; break;
      case 7: case 8: case 16: case 19: case 20: p += 2; break;
      case 15: p += 3; break;
      case 9: case 10: case 11: case 12: case 17: case 18: p += 4; break;
      default: return out;   // 未知 tag：放弃该文件
    }
  }
  return out;
}

function normDisasm(txt) {
  return txt.split(/\r?\n/)
    .filter(l => !/^Compiled from/.test(l))
    .map(l => l
      .replace(/#\d+/g, '#')
      .replace(/\/\/ String .*/g, '// String <S>')
      .replace(/\s+$/, ''))
    .filter(l => l.trim() !== '')
    .join('\n');
}

const a = listClasses(ORIGUN);
const b = new Set(listClasses(NEWUN));
const onlyOrig = a.filter(x => !b.has(x));
const onlyNew = [...b].filter(x => !a.includes(x));

const structDiff = [];
const stringDiff = [];
let same = 0;
for (const rel of a) {
  if (!b.has(rel)) continue;
  const cls = rel.replace(/\.class$/, '').replace(/\//g, '.');
  const bufA = fs.readFileSync(path.join(ORIGUN, rel));
  const bufB = fs.readFileSync(path.join(NEWUN, rel));
  const cpA = utf8Constants(bufA), cpB = utf8Constants(bufB);
  const setA = new Set(cpA), setB = new Set(cpB);
  const onlyInA = [...setA].filter(x => !setB.has(x));
  const onlyInB = [...setB].filter(x => !setA.has(x));
  if (onlyInA.length || onlyInB.length) stringDiff.push({ rel, onlyInA, onlyInB });
  let da, db;
  try { da = normDisasm(execFileSync(JAVAP, ['-p', '-c', '-classpath', ORIG, cls], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
  catch (e) { structDiff.push({ rel, reason: 'javap(orig) 失败' }); continue; }
  try { db = normDisasm(execFileSync(JAVAP, ['-p', '-c', '-classpath', NEW, cls], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
  catch (e) { structDiff.push({ rel, reason: 'javap(new) 失败' }); continue; }
  if (da === db) same++; else structDiff.push({ rel, reason: '反汇编差异' });
}

const lines = [];
lines.push('类集合：官方 ' + a.length + ' / 新建 ' + b.size);
lines.push('仅官方有：' + (onlyOrig.length ? onlyOrig.join(', ') : '无'));
lines.push('仅新建有：' + (onlyNew.length ? onlyNew.join(', ') : '无'));
lines.push('');
lines.push('常量池**集合**有差异的类：' + stringDiff.length);
stringDiff.forEach(d => {
  lines.push('  ~ ' + d.rel);
  d.onlyInA.forEach(s => lines.push('      官方独有: ' + JSON.stringify(s)));
  d.onlyInB.forEach(s => lines.push('      新建独有: ' + JSON.stringify(s)));
});
lines.push('');
lines.push('反汇编（字符串已占位化）完全一致：' + same + ' / ' + (a.length - onlyOrig.length));
lines.push('结构有差异的类：' + structDiff.length);
structDiff.forEach(d => lines.push('  ! ' + d.rel + '  (' + d.reason + ')'));

fs.writeFileSync(path.join(W, 'out', 'recompile_equivalence.txt'), lines.join('\r\n'), 'utf8');
console.log(lines.slice(0, 40).join('\n'));
console.log('\n报告 → ' + path.join(W, 'out', 'recompile_equivalence.txt'));
