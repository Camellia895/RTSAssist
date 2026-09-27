// verify_translated.js — 校验用户回填后的译文清单（G2 第一部分）：
//   ① 三条分片条目数/顺序一致，locator 与 en 与原清单逐字符相同（没被误改）；
//   ② 空 zh = 0；
//   ③ 占位符 / 反斜杠转义 / 引号 / 方括号字符集 / 长度 等格式自检（spec 铁律）；
//   ④ 关键标识符未被误译（如 RTSA_... / 键名）；
// 用法: node verify_translated.js <srcWorklistDirWithZh> <origWorklistDir>
const fs = require('fs');
const path = require('path');

const ZH = process.argv[2];
const ORIG = process.argv[3];
if (!ZH || !ORIG) { console.error('usage: node verify_translated.js <zhDir> <origDir>'); process.exit(1); }

const shards = ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json'];
const errors = [];
const warnings = [];
let total = 0, filled = 0;

const FORBIDDEN_CHARS = ['「', '」', '『', '』', '〈', '〉', '〔', '〕', '\u3000'];

for (const s of shards) {
  const zhArr = JSON.parse(fs.readFileSync(path.join(ZH, s), 'utf8'));
  const orArr = JSON.parse(fs.readFileSync(path.join(ORIG, s), 'utf8'));
  if (zhArr.length !== orArr.length) {
    errors.push(`${s}: 条目数不一致（译文 ${zhArr.length} vs 原 ${orArr.length}）`);
    continue;
  }
  for (let i = 0; i < zhArr.length; i++) {
    const z = zhArr[i], o = orArr[i];
    total++;
    if (z.locator !== o.locator) { errors.push(`${s}[${i}]: locator 被改动 ${z.locator} vs ${o.locator}`); continue; }
    if (z.en !== o.en) errors.push(`${s}[${i}] ${z.locator}: en 被改动`);
    for (const k of ['file', 'line', 'field', 'source']) {
      if (z[k] !== o[k]) errors.push(`${s}[${i}] ${z.locator}: 字段 ${k} 被改动（${JSON.stringify(z[k])} vs ${JSON.stringify(o[k])}）`);
    }
    if (typeof z.zh !== 'string' || z.zh.trim() === '') { errors.push(`${s}[${i}] ${z.locator}: zh 为空`); continue; }
    filled++;
    const en = o.en, zh = z.zh;

    // ③-1 换行数一致（ReadMe 分块/多行文本）
    const enNL = (en.match(/\n/g) || []).length, zhNL = (zh.match(/\n/g) || []).length;
    if (enNL !== zhNL) warnings.push(`${s}[${i}] ${z.locator}: 换行数 ${zhNL} ≠ 原文 ${enNL}`);

    // ③-2 反斜杠转义序列数量一致（\n 之类）
    const enEsc = (en.match(/\\[nrt"\\]/g) || []).length, zhEsc = (zh.match(/\\[nrt"\\]/g) || []).length;
    if (enEsc !== zhEsc) errors.push(`${s}[${i}] ${z.locator}: 转义序列数 ${zhEsc} ≠ 原文 ${enEsc}`);

    // ③-3 占位符一致（%s %d %f %% 等）
    const ph = t => (t.match(/%[sdfxX%bBn]/g) || []).sort().join(',');
    if (ph(en) !== ph(zh)) errors.push(`${s}[${i}] ${z.locator}: 占位符不一致 en=[${ph(en)}] zh=[${ph(zh)}]`);

    // ③-4 禁字形
    for (const c of FORBIDDEN_CHARS) if (zh.includes(c)) errors.push(`${s}[${i}] ${z.locator}: 含禁字形 ${JSON.stringify(c)}（缺字形会显示 ?）`);

    // ③-5 弯引号（CSV 之外也建议避免，ini 注释里无害但统一用【】）
    if (/[“”‘’]/.test(zh)) warnings.push(`${s}[${i}] ${z.locator}: 含弯引号，建议改用【】`);

    // ③-6 开头/结尾空格
    if (zh !== zh.trim()) warnings.push(`${s}[${i}] ${z.locator}: 译文首尾有空白`);

    // ③-7 JSON 值/Java 字面量：不能含裸双引号或反斜杠结尾
    if (/"/.test(zh)) errors.push(`${s}[${i}] ${z.locator}: 译文含 ASCII 双引号（会破坏 Java/JSON 字面量）`);
    if (/\\$/.test(zh)) errors.push(`${s}[${i}] ${z.locator}: 译文以反斜杠结尾`);

    // ④ 标识符泄漏：译文里不该出现原键名
    if (/RTSA_Settings|RTS_common/.test(zh)) errors.push(`${s}[${i}] ${z.locator}: 译文里出现内部键名（疑似误译标识符）`);

    // 长度提示（LunaLib 悬停说明太长会被截断）
    if (z.field !== 'wholeText-block' && zh.length > Math.max(60, en.length * 2.2)) {
      warnings.push(`${s}[${i}] ${z.locator}: 译文偏长（${zh.length} 字 vs 原文 ${en.length}）`);
    }
    if (['HotKeys', 'Settings', 'UI Settings', 'Dev Tools'].includes(en) && zh.length > 8) {
      warnings.push(`${s}[${i}] ${z.locator}: LunaLib 页签名过长（${zh.length} 字），可能被截断`);
    }
  }
}

console.log(`条目总数: ${total}  已填 zh: ${filled}`);
if (errors.length) {
  console.log(`\n=== 错误 ${errors.length} 条（必须修） ===`);
  errors.forEach(e => console.log('  ✖ ' + e));
} else console.log('\n格式硬性检查：全部通过 ✔');
if (warnings.length) {
  console.log(`\n=== 提示 ${warnings.length} 条（建议复核，不阻塞） ===`);
  warnings.forEach(w => console.log('  ! ' + w));
}
process.exit(errors.length ? 2 : 0);
