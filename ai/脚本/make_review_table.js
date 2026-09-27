// make_review_table.js - 生成译者审校表（Markdown）：
//   ① 10 条 AI 直译初稿 + 建议术语 + 需你确认的点（draft=true 的条目）
//   ② 4 条旧译失效（英文被上游改写）
//   ③ 术语一致性抽检（zoom / render / volume 系列全部相关条目并列，便于一次对齐）
// 用法: node make_review_table.js <modWorkDir>
const fs = require('fs');
const path = require('path');

const W = process.argv[2];
const OUT = path.join(W, 'out');
function hasWorklists(dir) {
  return fs.existsSync(path.join(dir, 'worklist_01_luna_settings.json'));
}
const ZH = hasWorklists(path.join(OUT, 'zh')) ? path.join(OUT, 'zh') : OUT;
const entries = [];
for (const s of ['worklist_01_luna_settings.json', 'worklist_02_ini_comments.json', 'worklist_03_docs.json']) {
  entries.push(...JSON.parse(fs.readFileSync(path.join(ZH, s), 'utf8')));
}
const drafts = entries.filter(e => e.draft);
const migrated = entries.filter(e => e.source === 'old-migrated');
const oldFrozen = JSON.parse(fs.readFileSync(path.join(OUT, 'zh_corrected_0.1.9c', 'worklist_01_luna_settings.json'), 'utf8'));
const newEn = new Set(entries.map(e => e.en));
const obsoleted = oldFrozen.filter(e => !newEn.has(e.en));

const L = [];
L.push('# RTSAssist 0.2.04exp 汉化审校表');
L.push('');
L.push('> 基准：**官方发布包 v0.2.04exp**（`gameVersion` = 0.98a-RC8，与你的游戏版本一致）。');
L.push('> 本版共 **' + entries.length + '** 条翻译面：**' + migrated.length + ' 条自动复用 0.1.9c 旧译**，');
L.push('> **' + drafts.length + ' 条为本版新增/改写，下面是 AI 直译初稿，等你审校**。');
L.push('');
L.push('## 一、待审校（' + drafts.length + ' 条）');
L.push('');
L.push('| # | 位置 | 英文原文 | AI 直译初稿 | 备注 |');
L.push('|---|---|---|---|---|');
drafts.forEach((e, i) => {
  const loc = e.file.split('/').pop() + ' L' + e.line;
  L.push('| ' + (i + 1) + ' | `' + loc + '` | ' + e.en.replace(/\|/g, '\\|').replace(/\n/g, ' ') + ' | **' + e.zh + '** | ' + (e.source === 'new' ? '新增' : '') + ' |');
});
L.push('');
L.push('### 需要你拍板的术语点');
L.push('');
L.push('1. **`Render` 译作「渲染」**：上游把界面里的 "UI" 统一改称 "Render"（`UI Settings`→`Render Settings`、`UI Scaling`→`Render Scaling`、`UI Command Volume`→`Render Command Volume`）。');
L.push('   我按「渲染」译。若你觉得对玩家太技术化，可统一换成**「画面」**（则 4 条同步改）。');
L.push('2. **`Render Command Volume` 我译作「指令音量」**（未带"渲染"前缀）：它位于「渲染设置」页签下，且已同页的说明写明是"下达指令的音频反馈"；');
L.push('   旧译是「界面指令音量」。若要严格对应原文可改回**「渲染指令音量」**。');
L.push('3. **zoom 系列口径**（沿用你 0.1.9c 的三种说法，如需统一请指明）：');
L.push('   - `Maximum Zoom` / `Minimum Zoom` → **「最大/最小缩放级别」**（与旧译 `最大缩放级别` 一致）');
L.push('   - `How far the player can zoom out.` → 「视角可向外拉远的最大视野距离。」（旧译原样）');
L.push('   - `How far the player can zoom in.` → 「视角可向内拉近的最大视野距离。」（**我新译的对偶句**）');
L.push('4. **`Zoom Sensitivity` → 「缩放灵敏度」**、说明句 → 「滚轮缩放的灵敏度。」（原句 `How sensitive the scroll wheel is.`）');
L.push('5. **Config.ini 两条新注释**用了「缩放灵敏度 / 最小缩放级别」，与上面第 3、4 点保持同词。');
L.push('');
L.push('## 二、旧译在本版失效（' + obsoleted.length + ' 条，已自动弃用）');
L.push('');
L.push('| 英文（0.1.9c，已不存在于本版） | 旧译 |');
L.push('|---|---|');
obsoleted.forEach(e => L.push('| ' + e.en.replace(/\|/g, '\\|') + ' | ' + e.zh.replace(/\|/g, '\\|') + ' |'));
L.push('');
L.push('## 三、术语一致性抽检（相关条目并列）');
L.push('');
L.push('| 英文 | 译文 | 来源 |');
L.push('|---|---|---|');
for (const e of entries) {
  if (/zoom|scal|volume|sensitivity|render|scroll/i.test(e.en)) {
    L.push('| ' + e.en.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120) + ' | ' + e.zh.replace(/\|/g, '\\|') + ' | ' + (e.source === 'old-migrated' ? '复用旧译' : '★新译') + ' |');
  }
}
L.push('');
L.push('## 四、统计');
L.push('');
L.push('| 翻译面 | 条目 | 复用旧译 | 新译 |');
L.push('|---|---|---|---|');
const byFile = {};
for (const e of entries) {
  byFile[e.file] = byFile[e.file] || { n: 0, old: 0, dz: 0 };
  byFile[e.file].n++;
  if (e.source === 'old-migrated') byFile[e.file].old++; else byFile[e.file].dz++;
}
for (const [f, v] of Object.entries(byFile)) {
  L.push('| `' + f + '` | ' + v.n + ' | ' + v.old + ' | ' + v.dz + ' |');
}
L.push('| **合计** | **' + entries.length + '** | **' + migrated.length + '** | **' + drafts.length + '** |');
L.push('');
L.push('> 审校方式：直接改 `out/zh/worklist_0*.json` 里对应条目的 `zh` 字段（其余字段别动），改完告诉我，我重新注入 + 全量验证 + 打包。');

const outPath = path.join(OUT, '..', 'out_v0204', '审校表_v0204.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, L.join('\r\n'), 'utf8');
console.log('审校表 -> ' + outPath);
console.log('待审校 ' + drafts.length + ' 条 / 复用 ' + migrated.length + ' 条 / 失效 ' + obsoleted.length + ' 条');
