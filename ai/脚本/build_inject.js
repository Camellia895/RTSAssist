// build_inject.js — RTSAssist 阶段3 注入：把 worklist 的 zh 写回（数据层 + 源码），并重编译 + 重建 jar。
// 产出：_work\mod_work\RTSAssist\build\  （src_zh / classes / RTSAssist.jar）
// 用法:
//   node build_inject.js <modWorkDir> [--apply]
//     不带 --apply = 预演（dry-run）：只逐条校验 en 原位与替换可行性，**不写任何文件、不备份、不编译**。
//     带   --apply = 真注入：备份 pre_zh → 回填 → 逐条复校 → javac --release 17 → 重建 jar → 条目/源码自检。
// 安全：① 空 zh 直接报错退出；② 每个 locator 回填前逐字符校验 en 仍在原位；③ 全部写完后重读校验 zh 已落位。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const W = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!W) { console.error('usage: node build_inject.js <modWorkDir> [--apply]'); process.exit(1); }
const OUT = path.join(W, 'out');
const BM = path.join(W, 'baseline_mod');
const BS = path.join(W, 'baseline', 'src');
const BUILD = path.join(W, 'build');
const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
const JAVAC = 'C:/Program Files/Android/Android Studio/jbr/bin/javac.exe';
const JAR = 'C:/Program Files/Android/Android Studio/jbr/bin/jar.exe';

const eol = s => s.split(/\r?\n/);
const readSrc = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const writeUtf8 = (p, t) => fs.writeFileSync(p, t, { encoding: 'utf8' });   // 无 BOM

// ---------- 1. 读清单 ----------
// 优先级（v0.2.04exp 起）：out\zh（译者亲自填的产物）→ out\（当前版本规范清单）。
// ⚠ 不要再用 out\zh_corrected：那个名字被 0.1.9c 的冻结旧译 out\zh_corrected_0.1.9c 的**上一代**占用了，
//   新版本若误读它，会因为英文原文已变而报"未找到原字面量"几十条（本工具踩过）。
function hasWorklists(dir) {
  return fs.existsSync(path.join(dir, 'worklist_01_luna_settings.json'))
      && fs.existsSync(path.join(dir, 'worklist_02_ini_comments.json'))
      && fs.existsSync(path.join(dir, 'worklist_03_docs.json'));
}
let zhDir;
if (hasWorklists(path.join(OUT, 'zh'))) zhDir = path.join(OUT, 'zh');
else if (hasWorklists(OUT)) zhDir = OUT;
else { console.error('找不到译文目录（out\\zh 或 out\\worklist_0*.json）'); process.exit(1); }
console.log('译文来源: ' + zhDir);
// 版本自检：清单里的 en 必须能在当前只读基线里逐条命中，否则说明清单与基线版本不匹配
const shards = ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json'];
let entries = [];
for (const s of shards) {
  const p = path.join(zhDir, s);
  if (!fs.existsSync(p)) { console.error('缺少分片: ' + p); process.exit(1); }
  entries = entries.concat(JSON.parse(fs.readFileSync(p, 'utf8')).map(e => ({ ...e, __shard: s })));
}
const empty = entries.filter(e => !e.zh || String(e.zh).trim() === '');
if (empty.length) {
  console.error(`✖ 空 zh = ${empty.length} 条，拒绝注入（空译文比漏译更糟）：`);
  empty.slice(0, 20).forEach(e => console.error('   - ' + e.locator + '  ' + JSON.stringify(e.en)));
  if (empty.length > 20) console.error(`   ... 共 ${empty.length} 条`);
  process.exit(2);
}
console.log(`清单条目: ${entries.length}（zh 全部已填 ✔）${APPLY ? '' : '  [预演模式 dry-run]'}`);

// ---------- 2. 备份 pre_zh ----------
// 备份时机 = "写入中文之前"，故目录名带当前被汉化的版本号（版本换了要另存，不能复用旧备份）。
const curVer = (() => {
  try { return (fs.readFileSync(path.join(BM, 'mod_info.json'), 'utf8').match(/"version"\s*:\s*"([^"]+)"/) || [])[1] || 'unknown'; }
  catch (e) { return 'unknown'; }
})();
const bak = path.join(GAME, '_work', 'mod_bak', `RTSAssist_${curVer}_pre_zh_backup`);
if (APPLY) {
  if (!fs.existsSync(bak)) {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Copy-Item -Recurse -Force '${path.join(GAME, 'mods', 'RTSAssist')}' '${bak}'`], { stdio: 'inherit' });
    console.log('pre_zh 备份 → ' + bak);
  } else console.log('pre_zh 备份已存在: ' + bak);
}

// ---------- 3. 准备 build 目录 ----------
// 铁律：baseline\src 与 baseline_mod\ 是**只读基线**（= 官方发布版原样），任何产物都写进 build\。
//   build\src_zh\      = 汉化后的源码（jar 内附带的 .java 也取自此）
//   build\payload_mod\ = 汉化后的 mod 载荷（Config.ini/Hotkeys.ini/mod_info.json/ReadMe.txt），
//                        交付时连同 build\RTSAssist.jar 一起安装到 mods\RTSAssist\。
const PAYLOAD = path.join(BUILD, 'payload_mod');
if (APPLY) {
  if (fs.existsSync(BUILD)) fs.rmSync(BUILD, { recursive: true, force: true });
  fs.mkdirSync(path.join(BUILD, 'src_zh'), { recursive: true });
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Copy-Item -Recurse -Force '${BS}\\*' '${BUILD}\\src_zh'`], { stdio: 'inherit' });
  fs.mkdirSync(PAYLOAD, { recursive: true });
  for (const f of ['Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt', 'RTSAssist.version']) {
    fs.copyFileSync(path.join(BM, f), path.join(PAYLOAD, f));
  }
}

// ---------- 4. 数据层回填（读只读基线 → 写 build\payload_mod 或 build\src_zh）----------
const fail = [];
const dryStore = new Map();   // dry-run：rel -> 回填后的全文
function patchLines(rel, edits) {
  if (!edits.length) return;
  const isJava = rel.endsWith('.java');
  const srcAbs = isJava ? path.join(BS, rel) : path.join(BM, rel);
  const dstAbs = isJava ? path.join(BUILD, 'src_zh', rel) : path.join(PAYLOAD, rel);
  const raw = readSrc(path.dirname(srcAbs), path.basename(srcAbs));
  const lines = eol(raw);
  for (const e of edits) {
    const cur = lines[e.line - 1];
    if (cur === undefined) { fail.push(`${rel}:${e.line} 行不存在`); continue; }
    let next;
    if (e.field === 'java-string-literal') {
      if (cur.indexOf('"' + e.en + '"') === -1) { fail.push(`${rel}:${e.line} 未找到原字面量 ${JSON.stringify(e.en)}`); continue; }
      next = cur.replace('"' + e.en + '"', '"' + e.zh + '"');
      if (next === cur) { fail.push(`${rel}:${e.line} 替换无效`); continue; }
    } else if (e.field === 'ini-comment') {
      const m = cur.match(/^(\s*#\s?)(.*?)(\s*)$/);
      if (!m) { fail.push(`${rel}:${e.line} 不是注释行`); continue; }
      const body = m[2];
      let newBody;
      if (body.startsWith('**') && body.endsWith('**')) newBody = '**' + e.zh + '**';
      else if (body.startsWith('**') && body.endsWith('**#')) newBody = '**' + e.zh + '**#';
      else newBody = body.replace(e.en, e.zh);
      if (newBody === body) { fail.push(`${rel}:${e.line} 注释替换无效: ${JSON.stringify(body)}`); continue; }
      next = m[1] + newBody + m[3];
    } else if (e.field === 'json-string-value') {
      if (cur.indexOf('"' + e.en + '"') === -1) { fail.push(`${rel}:${e.line} 未找到 JSON 值`); continue; }
      next = cur.replace('"' + e.en + '"', '"' + e.zh + '"');
    } else { fail.push(`${rel}:${e.line} 未支持的 field=${e.field}`); continue; }
    lines[e.line - 1] = next;
  }
  const joined = lines.join('\r\n');
  dryStore.set(rel, joined);
  if (APPLY) writeUtf8(dstAbs, joined);
}

const lunaRel = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
patchLines(lunaRel, entries.filter(e => e.file === lunaRel));
patchLines('Config.ini', entries.filter(e => e.file === 'Config.ini'));
patchLines('Hotkeys.ini', entries.filter(e => e.file === 'Hotkeys.ini'));
patchLines('mod_info.json', entries.filter(e => e.file === 'mod_info.json' && e.field === 'json-string-value'));

// ReadMe 块替换：**按内容匹配块**（不依赖 locator 里的行号范围）
// 逻辑：把文件按空行切成块，用 `en` 与块内容逐字符比对定位；命中则整块替换为 `zh`（按 \n 拆行）。
// 这样清单只需给出块的起始行（给译者定位用），块长由数据自身决定，版本变更也不会因行号漂移而错位。
{
  const rmEnt = entries.filter(e => e.file === 'ReadMe.txt').sort((a, b) => a.line - b.line);
  if (rmEnt.length) {
    const raw = readSrc(BM, 'ReadMe.txt');
    const NL = raw.includes('\r\n') ? '\r\n' : '\n';
    let lines = eol(raw);
    // 记录每个块的首行索引（0-based）与内容
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].trim() === '') { i++; continue; }
      const start = i;
      const buf = [];
      while (i < lines.length && lines[i].trim() !== '') { buf.push(lines[i]); i++; }
      blocks.push({ start, end: i - 1, en: buf.join('\n') });
    }
    // 从后往前替换，避免索引漂移
    const jobs = [];
    for (const e of rmEnt) {
      const want = e.en.replace(/\r\n/g, '\n');
      const b = blocks.find(x => x.en === want);
      if (!b) { fail.push(`ReadMe.txt#L${e.line} 未找到匹配的英文文本块（内容不一致？）`); continue; }
      jobs.push({ b, zh: e.zh });
    }
    jobs.sort((a, b) => b.b.start - a.b.start);
    for (const j of jobs) {
      lines.splice(j.b.start, j.b.end - j.b.start + 1, ...j.zh.split(/\r?\n/));
    }
    const joined = lines.join(NL);
    dryStore.set('ReadMe.txt', joined);
    if (APPLY) writeUtf8(path.join(PAYLOAD, 'ReadMe.txt'), joined);
  }
}

if (fail.length) { console.error('\n✖ 回填失败 ' + fail.length + ' 条：'); fail.forEach(f => console.error('  - ' + f)); process.exit(3); }
console.log((APPLY ? '数据层/源码回填完成 ✔' : '预演：全部 ' + entries.length + ' 条 locator 命中、替换可行 ✔'));

// ---------- 5. 校验 zh 已全部落位 ----------
// 注意：文件用 CRLF，而清单里的多行 zh 用 \n ⇒ 比对前统一换行符
const normNL = t => t.replace(/\r\n/g, '\n');
const verifyMiss = [];
for (const e of entries) {
  let text;
  // 顺序：① 本次内存回填结果 ② jar 层 Java 源（APPLY 时是 src_zh，dry-run 时回退到基线）
  //       ③ 数据层文件（APPLY 时是 payload_mod，dry-run 时回退到基线）
  if (dryStore.has(e.file)) text = dryStore.get(e.file);
  else if (e.file === lunaRel) {
    const p = path.join(BUILD, 'src_zh', lunaRel);
    text = fs.existsSync(p) ? readSrc(path.join(BUILD, 'src_zh'), lunaRel) : readSrc(BS, lunaRel);
  } else {
    const p = path.join(APPLY ? PAYLOAD : BM, e.file);
    text = fs.readFileSync(p, 'utf8');
  }
  if (normNL(text).indexOf(normNL(e.zh)) === -1) verifyMiss.push(e.locator);
}
if (verifyMiss.length) { console.error('\n✖ 回填后校验失败 ' + verifyMiss.length + ' 条未在文件中找到译文：'); verifyMiss.forEach(v => console.error('  - ' + v)); process.exit(4); }
console.log('回填后逐条校验：' + entries.length + '/' + entries.length + ' 译文已落位 ✔');

if (!APPLY) { console.log('\n预演结束（未写任何文件）。确认无误后加 --apply 执行真注入。'); process.exit(0); }

// ---------- 6. 打包：常量池补丁（保持其余类与官方 jar 逐字节一致）----------
// 依据：本机无 JDK 17 的 javac（只有游戏 JRE 17 与 JBR 25）。javac 21+ 改变了 enum switch 的编译方式
//       （不再生成 $SwitchMap 合成类、改用 tableswitch），实测 31 个类与官方 javac 17 产物结构不同；
//       而"只改 62 条字符串常量"用常量池补丁即可，且其余 446 个类与官方 jar 逐字节一致 ⇒ 风险最低。
const { patchClass, encodeModifiedUtf8 } = require(path.join('C:/game/StarSector.v0.9.8a-RC8/_work/skills/shared/scripts', 'patcher.js'));
const jarStage = path.join(BUILD, 'jar_stage');
if (fs.existsSync(jarStage)) fs.rmSync(jarStage, { recursive: true, force: true });
fs.mkdirSync(jarStage, { recursive: true });

// 1) 解析官方 jar。⚠ 官方 jar 用的是**流式条目**（local header 的 csize/usize = 0，
//    真实尺寸在后面 12 字节 data descriptor 里）⇒ 必须走**中央目录**取权威尺寸，
//    否则按 local header 的 csize=0 推进会在第二个条目就断掉（本工具第一版的真实事故）。
const zlibEarly = require('zlib');
function readZipEntries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('未找到 EOCD（不是 zip？）: ' + file);
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录签名不匹配 @' + p);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    // local header 定位数据起点
    const lnlen = buf.readUInt16LE(lho + 26);
    const lelen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lnlen + lelen;
    entries.push({ name, method, crc, csize, usize, comp: buf.subarray(dataStart, dataStart + csize) });
    p += 46 + nlen + elen + clen;
  }
  return entries;
}
const origJar = path.join(W, 'jarwork', 'RTSAssist_orig.jar');
const origEntries = readZipEntries(origJar);
console.log('官方 jar 条目: ' + origEntries.length);
if (origEntries.length === 0) { console.error('✖ 解析官方 jar 失败'); process.exit(7); }

// 2) 汉化映射：原文 → 译文（仅 Luna 层）。值必须是 **modified UTF-8 字节**（patcher 直接写入常量池）
const lunaMapping = new Map();
for (const e of entries.filter(x => x.file === lunaRel)) lunaMapping.set(e.en, encodeModifiedUtf8(e.zh));
const lunaClassRel = lunaRel.replace(/\.java$/, '.class');

// 3) 逐条目处理
const zlib = require('zlib');
const outParts = [];
const central = [];
let patchedClassBuf = null, patchedCount = 0;
let javaReplaced = false;
let offset = 0;
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

for (const e of origEntries) {
  let data = null;   // 若为 null 则原样复用官方压缩数据（逐字节不变）
  if (e.name === lunaClassRel) {
    const raw = e.method === 0 ? Buffer.from(e.comp) : zlib.inflateRawSync(e.comp);
    const r = patchClass(raw, lunaMapping);
    if (!r.buf) { console.error('✖ 常量池补丁未命中任何条目（键不匹配）'); process.exit(8); }
    patchedClassBuf = r.buf; patchedCount = r.count;
    data = r.buf;
    console.log(`  常量池补丁：${e.name} 命中 ${r.count} 条常量`);
  } else if (e.name === lunaRel) {
    // jar 内附带的源码同步为汉化版（游戏优先用 jar 内 class，源码仅供 modder 阅读）
    data = Buffer.from(fs.readFileSync(path.join(BUILD, 'src_zh', lunaRel), 'utf8'), 'utf8');
    javaReplaced = true;
  }
  let comp, method = 8;
  if (data) comp = zlib.deflateRawSync(data, { level: 6 });
  else comp = e.comp;
  const nameBuf = Buffer.from(e.name, 'utf8');
  const usize = data ? data.length : e.usize;
  const crc = data ? crc32(data) : e.crc;
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
  lh.writeUInt16LE(method, 8); lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(usize, 22);
  lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
  outParts.push(lh, nameBuf, comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(0, 12);
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(usize, 24);
  ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(0, 30); ch.writeUInt32LE(0, 34);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, nameBuf);
  offset += lh.length + nameBuf.length + comp.length;
}
const cd = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(origEntries.length, 8); eocd.writeUInt16LE(origEntries.length, 10);
eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
const outJar = path.join(BUILD, 'RTSAssist.jar');
fs.writeFileSync(outJar, Buffer.concat([...outParts, cd, eocd]));
console.log('jar 重建（常量池补丁式）→ ' + outJar);
if (!javaReplaced) console.log('  注意：jar 内未替换到 ' + lunaRel);

// 4) 解包到 build\verify_unpack 供校验脚本使用
const UN = path.join(BUILD, 'verify_unpack');
if (fs.existsSync(UN)) fs.rmSync(UN, { recursive: true, force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${outJar}','${UN}')`], { stdio: 'inherit' });

// ---------- 8. 快速自检：条目集合一致 + 逐条目内容比对（未改动者必须逐字节相同）----------
const listOf = (j) => execFileSync(JAR, ['tf', j], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const a = listOf(origJar);
const b = listOf(outJar);
const onlyA = a.filter(x => !b.includes(x));
const onlyB = b.filter(x => !a.includes(x));
console.log(`jar 条目：官方 ${a.length} / 新建 ${b.length}`);
if (onlyA.length) { console.log('  仅官方有的条目（不可丢）：'); onlyA.forEach(x => console.log('    - ' + x)); }
if (onlyB.length) { console.log('  仅新建有的条目：'); onlyB.forEach(x => console.log('    + ' + x)); }

// 逐条目内容比对：预期只有 2 个条目不同（Luna 的 class 与 .java）
function entryData(entries, name) {
  const e = entries.find(x => x.name === name);
  if (!e) return null;
  if (e.usize === 0 || e.csize === 0) return Buffer.alloc(0);
  return e.method === 0 ? Buffer.from(e.comp) : zlibEarly.inflateRawSync(e.comp);
}
const newEntries = readZipEntries(outJar);
const changed = [];
for (const e of origEntries) {
  const d1 = entryData(origEntries, e.name);
  const d2 = entryData(newEntries, e.name);
  if (!d1 || !d2) { changed.push(e.name + ' (缺失)'); continue; }
  if (!d1.equals(d2)) changed.push(e.name + ` (${d1.length} → ${d2.length} 字节)`);
}
console.log('与官方 jar 内容不同的条目（应恰为 Luna 的 class + .java 两条）：' + changed.length);
changed.forEach(x => console.log('  * ' + x));
if (changed.length !== 2) console.log('  ⚠ 非预期差异数量，请人工复核');
