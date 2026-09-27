// analyze_v0204.js - full text-surface diff between the delivered 0.1.9c and the new 0.2.04exp.
// Output: worklist for the new version with source tags (old-migrated | changed | new), plus an
// audit of everything excluded.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { walkCp, decodeModifiedUtf8 } = require('C:/game/StarSector.v0.9.8a-RC8/_work/skills/shared/scripts/patcher.js');

const T = 'C:/game/StarSector.v0.9.8a-RC8/_work/_tmp/rtsassist_v0204';
const REL = path.join(T, 'rel', 'RTSAssist');
const OUT = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/out_v0204';
fs.mkdirSync(OUT, { recursive: true });

// ---------- zip helpers (streaming-entry safe: sizes from central directory) ----------
function readEntries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < total; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    out.push({ name, method, csize, usize, comp: buf.subarray(ds, ds + csize) });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
const dataOf = e => (e.usize === 0 || e.csize === 0) ? Buffer.alloc(0) : (e.method === 0 ? Buffer.from(e.comp) : zlib.inflateRawSync(e.comp));

// ---------- collect string literals per class from a jar ----------
function jarStrings(jarPath) {
  const byClass = new Map();   // rel class -> Set(string literal)
  const all = new Set();
  for (const e of readEntries(jarPath)) {
    if (!e.name.endsWith('.class') || e.name.startsWith('META-INF/')) continue;
    let cp;
    try { cp = walkCp(dataOf(e)); } catch (err) { continue; }
    const set = new Set();
    for (const u of cp.utf8s) {
      if (!cp.stringRefs.has(u.index)) continue;
      if (cp.identRefs.has(u.index)) continue;   // identifier-shared entries: never translatable
      const s = decodeModifiedUtf8(u.bytes);
      set.add(s); all.add(s);
    }
    byClass.set(e.name, set);
  }
  return { byClass, all };
}

const NEW = jarStrings(path.join(REL, 'jars', 'RTSAssist.jar'));
console.log('0.2.04exp: classes=' + NEW.byClass.size + '  distinct string literals=' + NEW.all.size);

// ---------- old (0.1.9c) literals for the "what changed" diff ----------
const OLDJAR = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/jarwork/RTSAssist_orig.jar';
const OLD = jarStrings(OLDJAR);
console.log('0.1.9c  : classes=' + OLD.byClass.size + '  distinct string literals=' + OLD.all.size);

// ---------- old translations (en -> zh) from the delivered corpora ----------
const zhDir = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/out/zh_corrected';
const oldMap = new Map();
for (const f of fs.readdirSync(zhDir)) {
  if (!f.startsWith('worklist_')) continue;
  for (const e of JSON.parse(fs.readFileSync(path.join(zhDir, f), 'utf8'))) oldMap.set(e.en, e.zh);
}
console.log('old translations (en->zh):', oldMap.size);

// ---------- heuristic: is a literal "player-visible UI text"? ----------
const CJK = /[\u4e00-\u9fff]/;
function looksLikeUi(s) {
  if (!s || s.length < 3) return false;
  if (CJK.test(s)) return false;
  if (!/[A-Za-z]{2,}/.test(s)) return false;
  if (/^[A-Za-z0-9_.$:/\\+\- ]+$/.test(s)) return false;          // pure identifier / path
  if (/^[a-z][A-Za-z0-9_]*$/.test(s)) return false;
  if (/^[A-Z][A-Z0-9_]*$/.test(s)) return false;
  const words = s.split(/\s+/).filter(w => /[A-Za-z]{2,}/.test(w));
  if (words.length < 2) return false;                              // need >=2 words to be a phrase
  if (/^(getHullSize|getHullSpec|getId|getName|getSystem) -> /.test(s)) return false;
  if (/^argument for @NotNull/i.test(s)) return false;
  if (/^RTSAssist: You attempted to/.test(s)) return false;
  if (/RTSAssist Handled Exception/.test(s)) return false;
  if (/^\.{2,}|\/{2,}|_{2,}/.test(s)) return false;
  return true;
}

// ---------- classify every new-version literal ----------
const rows = [];
for (const s of [...NEW.all].sort()) {
  if (!looksLikeUi(s)) continue;
  const cls = [...NEW.byClass.entries()].filter(([, set]) => set.has(s)).map(([k]) => k);
  let source, zh = '';
  if (oldMap.has(s)) { source = 'old-migrated'; zh = oldMap.get(s); }
  else source = 'new';
  rows.push({ c: s, classes: cls, source, zh });
}
const migrated = rows.filter(r => r.source === 'old-migrated');
const brandNew = rows.filter(r => r.source === 'new');

// ---------- which OLD translations no longer exist verbatim in the new version? ----------
const oldUi = [...oldMap.keys()].filter(looksLikeUi);
const vanished = oldUi.filter(s => !NEW.all.has(s));
const stillThere = oldUi.filter(s => NEW.all.has(s));

console.log('');
console.log('=== NEW version UI-looking literals: ' + rows.length + ' ===');
console.log('  reusable from 0.1.9c (en 未变): ' + migrated.length);
console.log('  brand new / changed (en 变了): ' + brandNew.length);
console.log('');
console.log('=== OLD translations status ===');
console.log('  0.1.9c 可译条目: ' + oldUi.length);
console.log('  en 在新版中原样存在: ' + stillThere.length);
console.log('  en 在新版中消失（被改写/删除）: ' + vanished.length);
vanished.forEach(v => console.log('    - ' + JSON.stringify(v) + '   (旧译: ' + JSON.stringify(oldMap.get(v)) + ')'));
console.log('');
console.log('=== brand new literals (need fresh translation) ===');
brandNew.forEach(r => console.log('  [' + r.classes.length + ' cls] ' + JSON.stringify(r.c)));

fs.writeFileSync(path.join(OUT, 'new_ui_literals.json'), JSON.stringify(rows, null, 2), 'utf8');
fs.writeFileSync(path.join(OUT, 'diff_summary.json'), JSON.stringify({
  newVersion: '0.2.04exp', oldVersion: '0.1.9c',
  newClasses: NEW.byClass.size, newLiterals: NEW.all.size,
  oldClasses: OLD.byClass.size, oldLiterals: OLD.all.size,
  uiLiterals: rows.length, reusable: migrated.length, brandNew: brandNew.length,
  oldUi: oldUi.length, oldStillPresent: stillThere.length, oldVanished: vanished.length,
}, null, 2), 'utf8');
console.log('');
console.log('-> ' + path.join(OUT, 'new_ui_literals.json'));
