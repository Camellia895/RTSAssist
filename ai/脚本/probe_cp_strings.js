// probe_cp_strings.js — 列出补丁后 Luna 类的全部字符串常量，并与 62 条译文逐条对照，定位"未进池"的那一条。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { walkCp, decodeModifiedUtf8 } = require('C:/game/StarSector.v0.9.8a-RC8/_work/skills/shared/scripts/patcher.js');

const W = process.argv[2];
const ZH = path.join(W, 'out', 'zh_corrected');
const entries = JSON.parse(fs.readFileSync(path.join(ZH, 'worklist_01_luna_settings.json'), 'utf8'));

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
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const comp = buf.subarray(ds, ds + csize);
    out.push({ name, method, comp, usize: buf.readUInt32LE(p + 24) });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
const jar = path.join(W, 'build', 'RTSAssist.jar');
const e = readEntries(jar).find(x => x.name === 'data/scripts/modInitilisation/RTS_LunaIntegration.class');
const raw = e.method === 0 ? Buffer.from(e.comp) : zlib.inflateRawSync(e.comp);
const cp = walkCp(raw);
const pool = cp.utf8s.filter(u => cp.stringRefs.has(u.index) && !cp.identRefs.has(u.index)).map(u => decodeModifiedUtf8(u.bytes));
console.log('string literals in patched class: ' + pool.length);
const set = new Set(pool);
const missing = entries.filter(x => !set.has(x.zh));
console.log('译文未进池的条目数: ' + missing.length);
missing.forEach(m => console.log('  - ' + m.locator + '  en=' + JSON.stringify(m.en) + '  zh=' + JSON.stringify(m.zh)));
console.log('\n是否还残留任一原文:');
entries.forEach(x => { if (set.has(x.en) && x.en !== x.zh) console.log('  ! ' + JSON.stringify(x.en)); });
console.log('\n全部字符串常量（前 70）:');
pool.slice(0, 70).forEach((s, i) => console.log(String(i).padStart(3) + ' ' + JSON.stringify(s)));
