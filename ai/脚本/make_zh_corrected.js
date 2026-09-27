// make_zh_corrected.js — 从 out\zh（译者产物）生成 out\zh_corrected（注入唯一来源），并记录每处自动修正。
// 修正项（有据可查，逐条写入 out\zh_corrections.json）：
//   1) `%%` → `%`：本 mod 无任何 String.format/printf（已 grep 证实），Config.ini 注释与 ReadMe.txt 均为纯文本，
//      字面 `%%` 会原样显示成两个百分号 ⇒ 按 spec §1「有对应传参才保留 %」的反面处理为单 `%`。
// 用法: node make_zh_corrected.js <modWorkDir>
const fs = require('fs');
const path = require('path');

const W = process.argv[2];
const SRC = path.join(W, 'out', 'zh');
const DST = path.join(W, 'out', 'zh_corrected');
if (fs.existsSync(DST)) fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });

const shards = ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json'];
const corrections = [];
let totalFixed = 0;
let totalQuotes = 0;

for (const s of shards) {
  const arr = JSON.parse(fs.readFileSync(path.join(SRC, s), 'utf8'));
  for (const e of arr) {
    if (typeof e.zh !== 'string') continue;
    const before0 = e.zh;
    // 修正 1：%% → %（仅纯文本承载且无真实占位符）
    if (e.zh.includes('%%')) {
      const hasPlaceholder = /%(?!%)[sdfxXbBn]/.test(e.en) || /%(?!%)[sdfxXbBn]/.test(e.zh);
      if (hasPlaceholder) {
        corrections.push({ shard: s, locator: e.locator, action: 'skip', reason: '含真实占位符，保留 %% 语义', before: e.zh });
      } else {
        const before = e.zh;
        e.zh = e.zh.replace(/%%/g, '%');
        totalFixed += (before.match(/%%/g) || []).length;
        corrections.push({ shard: s, locator: e.locator, action: 'fix-percent', reason: '本 mod 无格式化调用，注释/README 中 %% 属过度转义（会显示成两个 %）', before, after: e.zh });
      }
    }
    // 修正 2：弯引号 → 【】（spec §3 / 铁律 R3 的安全替代；ini/readme 走游戏 JSON 解析路径，避免被归一化为 ASCII 引号）
    if (/[\u2018\u2019\u201C\u201D]/.test(e.zh)) {
      const before = e.zh;
      e.zh = e.zh.replace(/[\u201C\u201D]/g, m => (m === '\u201C' ? '【' : '】'))
                 .replace(/\u2018/g, '【').replace(/\u2019/g, '】');
      totalQuotes += 1;
      corrections.push({ shard: s, locator: e.locator, action: 'fix-quote', reason: '弯引号归一化为 ASCII 引号后可能与 JSON 注释解析冲突（spec §3），改用【】', before, after: e.zh });
    }
    if (before0 !== e.zh && !corrections.some(c => c.locator === e.locator)) {
      corrections.push({ shard: s, locator: e.locator, action: 'fix-other', before: before0, after: e.zh });
    }
  }
  fs.writeFileSync(path.join(DST, s), JSON.stringify(arr, null, 2), 'utf8');
}
// 复制对照表等其它文件
for (const f of fs.readdirSync(SRC)) {
  if (shards.includes(f)) continue;
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
}
fs.writeFileSync(path.join(W, 'out', 'zh_corrections.json'), JSON.stringify(corrections, null, 2), 'utf8');
console.log(`校正副本 → ${DST}`);
console.log(`修正条目 ${corrections.filter(c => c.action === 'fix-percent').length} 条（%% → %，共 ${totalFixed} 处）`);
console.log(`修正条目 ${corrections.filter(c => c.action === 'fix-quote').length} 条（弯引号 → 【】，共 ${totalQuotes} 条）`);
corrections.filter(c => c.action === 'fix-percent' || c.action === 'fix-quote').forEach(c => console.log(`  - [${c.action}] ${c.locator}`));
