// diff_recompiled.js — 证明「重编译产物的类语义与官方 jar 等价」：
// 用 javap -c -p 反汇编两边每个同名类（跳过被汉化/已知差异的类），归一化后逐行比对。
// 任何非字符串常量池差异都会显露为指令流差异。
// 用法: node diff_recompiled.js <origJar> <newJar> <javapPath> <outReport>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ORIG = process.argv[2];
const NEW = process.argv[3];
const JAVAP = process.argv[4];
const OUT = process.argv[5];

const listOf = (jar) => execFileSync('C:/Program Files/Android/Android Studio/jbr/bin/jar.exe', ['tf', jar], { encoding: 'utf8' })
  .split(/\r?\n/).filter(x => x.endsWith('.class'));

const a = listOf(ORIG);
const b = new Set(listOf(NEW));
const onlyOrig = a.filter(x => !b.has(x));

function disasm(jar, entry) {
  const cls = entry.replace(/\.class$/, '').replace(/\//g, '.');
  try {
    return execFileSync(JAVAP, ['-p', '-c', '-classpath', jar, cls], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return 'ERR ' + e.message; }
}

// 归一化：去掉 javap 的表头/常量池编号差异（#123），保留指令与字段/方法签名
function norm(t) {
  return t.split(/\r?\n/)
    .filter(l => !/^Compiled from/.test(l))
    .map(l => l.replace(/#\d+/g, '#').replace(/\s+$/, ''))
    .filter(l => l.trim() !== '')
    .join('\n');
}

// 归一化后仍会保留的、可接受的差异：字符串常量本身（ldc 显示的是字符串字面量）
const reports = [];
let sameCount = 0, diffCount = 0;
const diffClasses = [];
for (const entry of a) {
  if (!b.has(entry)) { diffClasses.push({ entry, reason: 'ONLY_IN_ORIG' }); continue; }
  const ao = norm(disasm(ORIG, entry));
  const an = norm(disasm(NEW, entry));
  if (ao === an) { sameCount++; continue; }
  diffCount++;
  // 逐行 diff
  const lo = ao.split('\n'), ln = an.split('\n');
  const det = [];
  const max = Math.max(lo.length, ln.length);
  for (let i = 0; i < max; i++) {
    if (lo[i] !== ln[i]) det.push(`  L${i + 1}\n    orig: ${lo[i]}\n    new : ${ln[i]}`);
  }
  diffClasses.push({ entry, reason: 'DISASM_DIFF', lines: det.length, sample: det.slice(0, 12) });
}
const out = [];
out.push(`类总数: 官方 ${a.length} / 新建 ${b.size}`);
out.push(`反汇编归一化后完全一致: ${sameCount}`);
out.push(`有差异: ${diffCount}`);
out.push(`仅官方有: ${onlyOrig.length ? onlyOrig.join(', ') : '无'}`);
out.push('');
for (const d of diffClasses) {
  out.push('### ' + d.entry + '  (' + d.reason + (d.lines ? `, ${d.lines} 行差异` : '') + ')');
  if (d.sample) d.sample.forEach(s => out.push(s));
  out.push('');
}
fs.writeFileSync(OUT, out.join('\r\n'), 'utf8');
console.log(out.slice(0, 6).join('\n'));
console.log('报告 → ' + OUT);
