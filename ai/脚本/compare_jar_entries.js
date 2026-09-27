// compare_jar_entries.js — 逐条目比对两个 jar 的解压内容（流式条目安全：尺寸取自中央目录）。
const fs = require('fs');
const zlib = require('zlib');
const A = process.argv[2], B = process.argv[3];

function readEntries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < total; i++) {
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(lho + 26);
    const lelen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lnlen + lelen;
    const comp = buf.subarray(dataStart, dataStart + csize);
    out.push({ name, method, crc, csize, usize, comp, lho, dataStart });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
function data(e) {
  if (e.usize === 0 || e.csize === 0) return Buffer.alloc(0);
  if (e.method === 0) return Buffer.from(e.comp);
  return zlib.inflateRawSync(e.comp);
}

const a = readEntries(A), b = readEntries(B);
console.log('entries: A=' + a.length + ' B=' + b.length);
const bm = new Map(b.map(x => [x.name, x]));
const diffs = [], missing = [];
for (const ea of a) {
  const eb = bm.get(ea.name);
  if (!eb) { missing.push(ea.name); continue; }
  let da, db;
  try { da = data(ea); } catch (e) { diffs.push(ea.name + ' (A 解压失败: ' + e.message + ', method=' + ea.method + ', csize=' + ea.csize + ', usize=' + ea.usize + ')'); continue; }
  try { db = data(eb); } catch (e) { diffs.push(ea.name + ' (B 解压失败: ' + e.message + ', method=' + eb.method + ', csize=' + eb.csize + ', usize=' + eb.usize + ')'); continue; }
  if (da.length !== db.length || !da.equals(db)) diffs.push(ea.name + ` (内容不同: ${da.length} vs ${db.length})`);
}
const onlyB = b.filter(x => !a.some(y => y.name === x.name)).map(x => x.name);
console.log('仅 A 有: ' + (missing.length ? missing.join(', ') : '无'));
console.log('仅 B 有: ' + (onlyB.length ? onlyB.join(', ') : '无'));
console.log('内容不同的条目: ' + diffs.length);
diffs.forEach(d => console.log('  * ' + d));

// 校验 B 的 CRC 自洽
let crcBad = 0;
const T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
for (const eb of b) {
  const d = data(eb);
  if (crc32(d) !== eb.crc) { crcBad++; if (crcBad < 6) console.log('  CRC 不符: ' + eb.name); }
}
console.log('B 的 CRC 不符条目数: ' + crcBad);
