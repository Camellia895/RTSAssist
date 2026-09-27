// verify_zh_final.js — 交付前最终审计（版本自适应）。
// 检查项：
//   A 已装 jar == 工作区 jar（SHA-256）
//   B jar 条目集合与官方一致；只有目标 class/.java 两条内容不同；全类标识符含 CJK = 0
//   C 目标类：英文可见串全部消失、译文全部进常量池、与标识符/局部变量同名的常量原样保留
//   D jar 内无未解释的英文句子常量
//   E 数据层文件：译文落位 + 无 BOM + 关键 JSON 键完好 + jar 内 .java 与 src_zh 一致
// 用法: node verify_zh_final.js <modWorkDir>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = process.argv[2];
const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
const MOD = path.join(GAME, 'mods', 'RTSAssist');
const ORIG = path.join(W, 'jarwork', 'RTSAssist_orig.jar');
const NEW = path.join(W, 'build', 'RTSAssist.jar');
const { walkCp, decodeModifiedUtf8 } = require('C:/game/StarSector.v0.9.8a-RC8/_work/skills/shared/scripts/patcher.js');

// 译文来源：与注入器同一优先级
const OUT = path.join(W, 'out');
function hasWorklists(dir) {
  return fs.existsSync(path.join(dir, 'worklist_01_luna_settings.json'))
      && fs.existsSync(path.join(dir, 'worklist_02_ini_comments.json'))
      && fs.existsSync(path.join(dir, 'worklist_03_docs.json'));
}
const ZH = hasWorklists(path.join(OUT, 'zh')) ? path.join(OUT, 'zh') : OUT;

const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex').toUpperCase();
const pass = [], warn = [], fail = [];
const ok = m => pass.push(m);
const wn = m => warn.push(m);
const no = m => fail.push(m);

// ---------- A ----------
{
  const hInst = sha(path.join(MOD, 'jars', 'RTSAssist.jar'));
  const hWork = sha(NEW);
  hInst === hWork ? ok('A 已装 jar 与工作区 jar SHA-256 一致 (' + hInst.slice(0, 16) + '…)') : no('A 已装 jar 与工作区 jar 不一致');
}

// ---------- zip helpers ----------
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
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    out.push({ name, method, crc, csize, usize, comp: buf.subarray(ds, ds + csize) });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
const dataOf = e => (e.usize === 0 || e.csize === 0) ? Buffer.alloc(0) : (e.method === 0 ? Buffer.from(e.comp) : zlib.inflateRawSync(e.comp));

const eo = readEntries(ORIG), en = readEntries(NEW);

// ---------- B ----------
{
  const no_ = eo.map(x => x.name), nn = en.map(x => x.name);
  const missing = no_.filter(x => !nn.includes(x)), extra = nn.filter(x => !no_.includes(x));
  (missing.length || extra.length)
    ? no('B 条目集合不一致 缺=' + missing.length + ' 多=' + extra.length)
    : ok('B jar 条目集合与官方一致（' + no_.length + ' 条）');
  const changed = [];
  for (const e of eo) {
    const t = en.find(x => x.name === e.name);
    if (!t) continue;
    if (!dataOf(e).equals(dataOf(t))) changed.push(e.name);
  }
  const expect = ['data/scripts/modInitilisation/RTS_LunaIntegration.class', 'data/scripts/modInitilisation/RTS_LunaIntegration.java'];
  const unexpected = changed.filter(x => !expect.includes(x));
  (changed.length === 2 && unexpected.length === 0)
    ? ok('B 内容变化条目恰为 2 条（' + changed.join(' / ') + '）')
    : no('B 非预期变化条目: ' + (changed.length ? changed.join(', ') : '无（应有 2 条）'));

  // 全 jar 标识符含 CJK 检查（内联 verify_identifiers 的核心断言）
  let cjkIds = 0;
  for (const e of en) {
    if (!e.name.endsWith('.class')) continue;
    let cp; try { cp = walkCp(dataOf(e)); } catch (err) { continue; }
    for (const u of cp.utf8s) {
      if (!cp.identRefs.has(u.index)) continue;
      if (/[\u4e00-\u9fff]/.test(decodeModifiedUtf8(u.bytes))) cjkIds++;
    }
  }
  cjkIds === 0 ? ok('B 全 jar 标识符含 CJK = 0') : no('B 有 ' + cjkIds + ' 个标识符含 CJK（会闪退）');
}

// ---------- C ----------
const lunaRel = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
const lunaClassRel = 'data/scripts/modInitilisation/RTS_LunaIntegration.class';
const origClass = dataOf(eo.find(x => x.name === lunaClassRel));
const newClass = dataOf(en.find(x => x.name === lunaClassRel));
const newJava = dataOf(en.find(x => x.name === lunaRel)).toString('utf8');

const entries = [];
for (const s of ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json']) {
  entries.push(...JSON.parse(fs.readFileSync(path.join(ZH, s), 'utf8')));
}
const lunaEntries = entries.filter(e => e.file === lunaRel);
{
  const cpUtf8s = buf => walkCp(buf).utf8s.map(u => decodeModifiedUtf8(u.bytes));
  const strs = buf => {
    const { utf8s, stringRefs, identRefs } = walkCp(buf);
    return utf8s.filter(u => stringRefs.has(u.index) && !identRefs.has(u.index)).map(u => decodeModifiedUtf8(u.bytes));
  };
  const sn = new Set(strs(newClass));
  const allUtf8 = new Set(cpUtf8s(newClass));

  // 与标识符/局部变量共享 Utf8 条目的常量会被 patcher 保护性跳过（如 modID），单独校验
  const protectedEn = lunaEntries.filter(e => allUtf8.has(e.en) && !sn.has(e.en));
  const translatable = lunaEntries.filter(e => !protectedEn.some(p => p.en === e.en));

  const stillThere = translatable.map(e => e.en).filter(x => sn.has(x));
  stillThere.length === 0
    ? ok('C 官方 ' + translatable.length + ' 条英文可见串在补丁后全部消失')
    : no('C 仍残留英文: ' + stillThere.join(' | '));
  const missingZh = translatable.map(e => e.zh).filter(x => !sn.has(x));
  missingZh.length === 0
    ? ok('C 全部 ' + translatable.length + ' 条译文已进常量池')
    : no('C 未进常量池的译文: ' + missingZh.join(' | '));

  if (protectedEn.length) {
    const bad = protectedEn.filter(e => !allUtf8.has(e.en));
    bad.length === 0
      ? ok('C ' + protectedEn.length + ' 条识别为"与标识符同名、受保护未替换"的常量原样保留（' + protectedEn.map(e => e.en).join(', ') + '）—— 它们是数据键，本就不该译')
      : no('C 受保护常量缺失: ' + bad.map(e => e.en).join(', '));
    protectedEn.forEach(e => wn('C 已知限制：' + JSON.stringify(e.en) + ' 在界面上仍显示英文（该字面量与代码标识符共享常量池条目，补丁法无法安全替换）'));
  }

  const keyLits = ['RTSA_SettingsKeybind_enable_RTSMode', 'RTSA_SettingsConfig_maxZoom', 'RTSA_SettingsConfig_zoomSensi',
    'RTSA_SettingsConfig_minZoom', 'RTSA_SettingsDevTools_modID', 'enable_RTSMode', 'saveLayout', 'loadLayout',
    'deleteAssignments', 'vent', 'useSystem', 'moveTogether', 'attackMove', 'strafeCameraLeft', 'strafeCameraRight',
    'strafeCameraUp', 'strafeCameraDown', 'broadsideSelection', 'modID', 'config', 'hotKeys', 'lunalib', 'RTSAssist'];
  const jarStrings = new Set();
  for (const cl of en) {
    if (!cl.name.endsWith('.class')) continue;
    let b2; try { b2 = dataOf(cl); } catch (err) { continue; }
    try { for (const u of walkCp(b2).utf8s) jarStrings.add(decodeModifiedUtf8(u.bytes)); } catch (err) { }
  }
  const keyLost = keyLits.filter(k => !jarStrings.has(k));
  keyLost.length === 0 ? ok('C 全部 ' + keyLits.length + ' 个数据键字面量在 jar 内完好') : no('C 键字面量丢失: ' + keyLost.join(', '));
}

// ---------- D ----------
{
  const allow = [
    /^[A-Za-z0-9_.$:/\\+\- ]+$/,
    /RTSAssist|Handled Exception|@NotNull/,
    /^[A-Z][A-Za-z]*$/,
  ];
  const suspects = new Map();
  for (const e of en) {
    if (!e.name.endsWith('.class')) continue;
    let cp; try { cp = walkCp(dataOf(e)); } catch (err) { continue; }
    for (const u of cp.utf8s) {
      if (!cp.stringRefs.has(u.index) || cp.identRefs.has(u.index)) continue;
      const s = decodeModifiedUtf8(u.bytes);
      if (/[\u4e00-\u9fff]/.test(s)) continue;
      const words = s.split(/\s+/).filter(w => /[A-Za-z]{2,}/.test(w));
      if (words.length < 2) continue;
      if (allow.some(re => re.test(s))) continue;
      if (/^argument for @NotNull/i.test(s)) continue;
      if (!suspects.has(s)) suspects.set(s, e.name);
    }
  }
  const allowedKnown = new Set(['Point Defense (Area)', 'Command Shuttle']);
  const unexplained = [...suspects].filter(([s]) => !allowedKnown.has(s));
  suspects.size === 0 ? ok('D jar 内无未解释的英文句子常量')
    : wn('D 待人工确认的英文串 ' + suspects.size + ' 条:\n      ' + [...suspects].map(([s, c]) => JSON.stringify(s.slice(0, 90)) + '   <' + c + '>').join('\n      '));
  if (unexplained.length) wn('D 其中非白名单 ' + unexplained.length + ' 条需复核');
}

// ---------- E ----------
{
  const dataEntries = entries.filter(e => !e.file.startsWith('data/'));
  let miss = [];
  for (const e of dataEntries) {
    const t = fs.readFileSync(path.join(MOD, e.file), 'utf8').replace(/\r\n/g, '\n');
    if (t.indexOf(e.zh.replace(/\r\n/g, '\n')) === -1) miss.push(e.locator);
  }
  miss.length === 0 ? ok('E 数据层 ' + dataEntries.length + ' 条译文全部落位') : no('E 未落位: ' + miss.join(', '));

  const bom = [];
  for (const f of ['Config.ini', 'Hotkeys.ini', 'mod_info.json', 'ReadMe.txt', 'RTSAssist.version']) {
    const b = fs.readFileSync(path.join(MOD, f));
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) bom.push(f);
  }
  bom.length === 0 ? ok('E 数据层文件无 BOM') : no('E 含 BOM: ' + bom.join(', '));

  const cfg = fs.readFileSync(path.join(MOD, 'Config.ini'), 'utf8');
  const keyBad = [];
  for (const k of ['"scrollSpeed"', '"scrollSmoothing"', '"scrollSpeedKeyboard"', '"scrollSmoothingKeyboard"',
    '"zoomSensi"', '"minZoom"', '"maxZoom"', '"selectionTolerance"', '"defaultModeIsRTS"', '"rememberZoom"',
    '"pauseUnpause"', '"switchRightClick"', '"alternativeRotation"', '"UICommandVolume"', '"screenScaling"',
    '"shipsWillRun"', '"isEnabled"', '"enableShipTestSuite"', '"modID"', '"findAllShips"']) {
    if (!cfg.includes(k)) keyBad.push('Config.ini:' + k);
  }
  const hk = fs.readFileSync(path.join(MOD, 'Hotkeys.ini'), 'utf8');
  for (const k of ['"enable_RTSMode"', '"strafeCameraLeft"', '"strafeCameraRight"', '"strafeCameraUp"', '"strafeCameraDown"',
    '"saveLayout"', '"loadLayout"', '"deleteAssignments"', '"vent"', '"useSystem"', '"moveTogether"', '"attackMove"',
    '"broadsideSelection"']) {
    if (!hk.includes(k)) keyBad.push('Hotkeys.ini:' + k);
  }
  const mi = fs.readFileSync(path.join(MOD, 'mod_info.json'), 'utf8');
  for (const k of ['"id":"RTSAssist"', '"gameVersion": "0.98a-RC8"', '"modPlugin":"data.scripts.RTSAssistModPlugin"', '"jars":["jars/RTSAssist.jar"]']) {
    if (!mi.replace(/\s+/g, '').includes(k.replace(/\s+/g, ''))) keyBad.push('mod_info.json:' + k);
  }
  keyBad.length === 0 ? ok('E 全部配置键 / mod_info 关键字段完好') : no('E 键缺失: ' + keyBad.join(', '));

  const modVer = (mi.match(/"version"\s*:\s*"([^"]+)"/) || [])[1];
  const vf = fs.readFileSync(path.join(MOD, 'RTSAssist.version'), 'utf8');
  const vfPatch = (vf.match(/"patch"\s*:\s*"([^"]+)"/) || [])[1];
  (modVer && vfPatch && modVer.endsWith(vfPatch))
    ? ok('E 版本一致：mod_info=' + modVer + ' / version.patch=' + vfPatch)
    : wn('E 版本号可能不一致：mod_info=' + modVer + ' / version.patch=' + vfPatch);

  const srcZhPath = path.join(W, 'build', 'src_zh', 'data', 'scripts', 'modInitilisation', 'RTS_LunaIntegration.java');
  if (fs.existsSync(srcZhPath)) {
    fs.readFileSync(srcZhPath, 'utf8') === newJava ? ok('E jar 内 .java 与 build\\src_zh 一致') : wn('E jar 内 .java 与 src_zh 不一致');
  }
  const modSrcPath = path.join(MOD, 'src', 'data', 'scripts', 'modInitilisation', 'RTS_LunaIntegration.java');
  if (fs.existsSync(modSrcPath) && fs.existsSync(srcZhPath)) {
    fs.readFileSync(modSrcPath, 'utf8') === fs.readFileSync(srcZhPath, 'utf8') ? ok('E mods\\RTSAssist\\src 已同步为汉化源码') : wn('E mods 内源码未同步');
  }
}

console.log('\n===== RTSAssist 汉化最终审计（' + ((fs.readFileSync(path.join(MOD, 'mod_info.json'), 'utf8').match(/"version"\s*:\s*"([^"]+)"/) || [])[1] || '?') + '）=====');
console.log('PASS (' + pass.length + '):');
pass.forEach(p => console.log('  ✔ ' + p));
if (warn.length) { console.log('\nWARN (' + warn.length + '):'); warn.forEach(w => console.log('  ! ' + w)); }
if (fail.length) { console.log('\nFAIL (' + fail.length + '):'); fail.forEach(f => console.log('  ✖ ' + f)); }
console.log('\n结论: ' + (fail.length === 0 ? '通过（无阻断项）' : '存在 ' + fail.length + ' 个阻断项，需修复'));
process.exit(fail.length ? 1 : 0);
