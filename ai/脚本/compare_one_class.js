// compare_one_class.js — 逐指令比对单个类，定位结构差异的真实原因。
// 用法: node compare_one_class.js <origJar> <newJar> <fully.qualified.ClassName>
const { execFileSync } = require('child_process');
const ORIG = process.argv[2], NEW = process.argv[3], CLS = process.argv[4];
const JAVAP = 'C:/Program Files/Android/Android Studio/jbr/bin/javap.exe';

const dis = (jar) => execFileSync(JAVAP, ['-p', '-c', '-classpath', jar, CLS], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function norm(txt, stripDebug) {
  const lines = txt.split(/\r?\n/).filter(l => !/^Compiled from/.test(l)).map(l => l.replace(/#\d+/g, '#').replace(/\s+$/, ''));
  const out = [];
  let skip = false;
  for (const l of lines) {
    if (stripDebug && /^\s*(LineNumberTable|LocalVariableTable|LocalVariableTypeTable):/.test(l)) { skip = true; continue; }
    if (skip) { if (/^\s{8,}/.test(l) || l.trim() === '') continue; skip = false; }
    if (l.trim() === '') continue;
    out.push(l);
  }
  return out;
}

const a = norm(dis(ORIG), true);
const b = norm(dis(NEW), true);
console.log('== ' + CLS + ' ==');
console.log('指令行数: 官方 ' + a.length + ' / 新建 ' + b.length);
let diff = 0;
const max = Math.max(a.length, b.length);
for (let i = 0; i < max; i++) {
  if (a[i] !== b[i]) {
    diff++;
    if (diff <= 25) {
      console.log('  L' + (i + 1));
      console.log('    - 官方: ' + (a[i] === undefined ? '(无)' : a[i]));
      console.log('    + 新建: ' + (b[i] === undefined ? '(无)' : b[i]));
    }
  }
}
console.log(diff === 0 ? '  ⇒ 去掉调试信息后指令完全一致 ✔' : '  ⇒ 差异行数 ' + diff);
