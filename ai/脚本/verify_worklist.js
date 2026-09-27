// verify_worklist.js — G1 自检：清单条目唯一性 / 覆盖完整性 / 与原文件逐字符一致。
// 用法: node verify_worklist.js <modWorkDir>
const fs = require('fs');
const path = require('path');

const W = process.argv[2];
const OUT = path.join(W, 'out');
const SRC = path.join(W, 'baseline', 'src');
const BM = path.join(W, 'baseline_mod');

const shards = ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json'];
let all = [];
for (const s of shards) {
  const arr = JSON.parse(fs.readFileSync(path.join(OUT, s), 'utf8'));
  arr.forEach(e => { e.__shard = s; all.push(e); });
}
const fail = [];
const lineCache = {};
function lines(rel) {
  const key = rel;
  if (!lineCache[key]) {
    const p = path.resolve(rel.endsWith('.ini') || rel === 'ReadMe.txt' || rel === 'mod_info.json' ? BM : SRC, rel);
    lineCache[key] = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  }
  return lineCache[key];
}

// 1) locator 唯一
const seen = new Map();
for (const e of all) {
  if (seen.has(e.locator)) fail.push('locator 重复: ' + e.locator);
  seen.set(e.locator, e);
}
// 2) zh 必须为空（提取阶段）
for (const e of all) if (e.zh !== '') fail.push('zh 非空(提取阶段): ' + e.locator);
// 3) en 与源文件逐字符一致
for (const e of all) {
  const L = lines(e.file);
  if (e.field === 'java-string-literal') {
    if (L[e.line - 1].indexOf('"' + e.en + '"') === -1) fail.push(`en 不匹配 ${e.locator}: ${JSON.stringify(e.en)} vs ${L[e.line - 1]}`);
  } else if (e.field === 'ini-comment') {
    const raw = L[e.line - 1];
    const inner = raw.replace(/^\s*#\s?/, '').replace(/\s+$/, '').replace(/^\*\*/, '').replace(/\*\*#?$/, '').trim();
    if (inner !== e.en) fail.push(`en 不匹配 ${e.locator}: ${JSON.stringify(e.en)} vs ${JSON.stringify(inner)}`);
  } else if (e.field === 'json-string-value') {
    const m = (L[e.line - 1].match(/"description"\s*:\s*"([^"]*)"/) || [])[1];
    if (m !== e.en) fail.push(`en 不匹配 ${e.locator}: ${JSON.stringify(e.en)} vs ${JSON.stringify(m)}`);
  } else if (e.field === 'wholeText-block') {
    const [a, b] = e.locator.split('#L')[1].split('-L').map(Number);
    const block = L.slice(a - 1, b).join('\n');
    if (block !== e.en) fail.push(`块不匹配 ${e.locator}`);
  }
}
// 4) RTS_LunaIntegration 全量覆盖核对：所有「可见文本形态」的字面量行是否都被收录
//    （排除标识符形态：单 token 小写 id、RTSA_/RTS_ 前缀键、全大写常量）
const isIdentifierShape = s =>
  /^[a-z][A-Za-z0-9_]*$/.test(s) || /^[A-Za-z][A-Za-z0-9_]*$/.test(s) || /^[A-Z][A-Z0-9_]*$/.test(s) ||
  /^(RTSA_|RTS_|qSaveData_|broadsides_)/.test(s) || s === '' || s === 'RTSAssist' || s === 'lunalib';
const lunaRel = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
const lunaLines = lines(lunaRel);
const covered = new Set(all.filter(e => e.file === lunaRel).map(e => e.line));
const missed = [];
lunaLines.forEach((l, i) => {
  const t = l.trim();
  if (t.startsWith('/*') || t.startsWith('//') || t.startsWith('*')) return;
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(l))) {
    if (covered.has(i + 1)) continue;
    if (isIdentifierShape(m[1])) continue;
    missed.push(`${lunaRel}:${i + 1}  ${JSON.stringify(m[1])}   ||  ${t}`);
  }
});
// 5) ini 注释覆盖核对（分隔线/纯符号行不计）
for (const f of ['Config.ini', 'Hotkeys.ini']) {
  const L = lines(f);
  const cov = new Set(all.filter(e => e.file === f).map(e => e.line));
  L.forEach((l, i) => {
    const t = l.trim();
    if (!t.startsWith('#')) return;
    const inner = t.replace(/^#+\s?/, '').replace(/\*\*/g, '').replace(/^#+$/, '').replace(/#+$/, '').trim();
    if (!inner) return;
    if (/^[-#*=\s]+$/.test(inner)) return;   // 分隔线
    if (/^#+[A-Za-z]+#+$/.test(t)) return;    // 环绕式纯标签行（##Config## / ##Hotkeys##），非句子
    if (!cov.has(i + 1)) missed.push(`${f}:${i + 1}  ${JSON.stringify(t)}`);
  });
}
// 6) ReadMe 行覆盖
{
  const L = lines('ReadMe.txt');
  const blocks = all.filter(e => e.file === 'ReadMe.txt');
  const cov = new Set();
  blocks.forEach(e => { const [a, b] = e.locator.split('#L')[1].split('-L').map(Number); for (let i = a; i <= b; i++) cov.add(i); });
  L.forEach((l, i) => { if (l.trim() !== '' && !cov.has(i + 1)) missed.push(`ReadMe.txt:${i + 1}  ${JSON.stringify(l)}`); });
}

console.log('总条目:', all.length);
for (const s of shards) console.log('  ' + s + ':', JSON.parse(fs.readFileSync(path.join(OUT, s), 'utf8')).length);
if (missed.length) { console.log('\n=== 未覆盖的可见字面量/注释 ' + missed.length + ' 条 ==='); missed.forEach(m => console.log('  ' + m)); }
else console.log('\n覆盖核对: 无遗漏 ✔');
if (fail.length) { console.log('\n=== 一致性失败 ' + fail.length + ' 条 ==='); fail.forEach(f => console.log('  ' + f)); process.exit(2); }
console.log('唯一性/一致性: 全部通过 ✔');
