// classify_excluded.js — 对 jar 常量候选逐条给出"译/不译"分类并留档。
// 输入: out/jar_sources_candidates.json（analyze_jar_strings + scan_jar_sources 的产物）
// 输出: out/excluded_entries.json（被排除的常量 + 分类 + 理由）、out/classify_stats.json
// 用法: node classify_excluded.js <modWorkDir>
const fs = require('fs');
const path = require('path');

const W = process.argv[2];
if (!W) { console.error('usage: node classify_excluded.js <modWorkDir>'); process.exit(1); }
const OUT = path.join(W, 'out');
const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'jar_sources_candidates.json'), 'utf8'));

const LUNA = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';
// 已进入待译清单的 Luna 行号（与 build_worklist.js 保持一致）
const LUNA_TRANSLATE_LINES = new Set([
  18, 19, 20, 21,
  38, 39, 49, 50, 58, 59, 67, 68, 76, 77, 85, 86, 94, 95, 103, 104,
  112, 113, 121, 122, 130, 131, 139, 140, 148, 149,
  160, 161, 169, 170, 178, 179, 187, 188, 198, 199, 209, 210, 220, 221,
  231, 232, 242, 243, 253, 254, 264, 265, 273, 274, 282, 283,
  293, 294, 302, 303, 311, 312,
]);

const CN_RE = /[\u4e00-\u9fff]/;
const isAsciiIdent = s => /^[A-Za-z0-9_.$:/\\\-+* ]+$/.test(s);

function classify(row) {
  const c = row.c;
  const src0 = row.src && row.src[0];
  const file = src0 ? src0.ctx.split(':')[0] : '';
  const line = src0 ? Number(src0.ctx.split(':').pop()) : 0;
  const lineText = src0 ? src0.lineText : '';

  // 已纳入待译清单
  if (file === LUNA && LUNA_TRANSLATE_LINES.has(line)) return { decision: 'translate', category: 'ui' };

  if (c === '') return { decision: 'skip', category: 'empty', reason: '空字符串字面量' };
  // 开发者调试输出（stdout，面向 modder，非玩家可见 UI）—— 先于占位符规则判定
  if (/^(getHullSize|getHullSpec|getId|getName|getSystem) -> /.test(c))
    return { decision: 'skip', category: 'log', reason: '开发者控制台调试输出前缀（DevTools ShipTestSuite，写 stdout）' };
  if (/^RTSAssist: You attempted to/.test(c))
    return { decision: 'skip', category: 'log', reason: '模组 API 误用时的开发者告警（写 stdout，面向 modder 非玩家）' };
  if (/RTSAssist Handled Exception|^\*  \*  \*/.test(c))
    return { decision: 'skip', category: 'log', reason: '第三方系统插件异常转储（stdout，面向 modder）' };
  if (/^argument for @NotNull parameter/i.test(c))
    return { decision: 'skip', category: 'fmt', reason: 'Kotlin/Intrinsics 编译期注入的断言模板（非本模组文案）' };
  if (/[\u0001]/.test(c)) return { decision: 'skip', category: 'fmt', reason: '含 \\u0001 占位符的内部拼接/索引键（SoundManager 音效名、反射拼接），非 UI 文本；且数量与位置不可变（铁律 R6）' };
  if (c.length === 1) return { decision: 'skip', category: 'fmt', reason: '单字符常量（热键默认值），非可见文本' };
  if (/^\$RTSA_SAVEID$|^RTS_common$/.test(c))
    return { decision: 'skip', category: 'fmt', reason: '存档持久化键/公共数据文件名（标识符）' };
  if (/^RTSAssist$/.test(c)) return { decision: 'skip', category: 'id', reason: '模组 id（LunaLib 注册用标识符，绝不可译）' };
  // 音效事件名（sounds.json 的键，代码按该字符串取音效）
  if (/^(CreateControlGroup|CreateSelectionEvent|CreateStandardAssignment|CreateSecondaryAssignment|CreateTemporaryAssignment|DeleteAssignment|Deselect|PreviewSelection|QueueAssignment|RotateAssignments|SaveAssignments|LoadAssignments|AttackMoveConversion|TargetEnemy|TargetEnemyLong|AttackMove|AttackMoveShip|AttackAtAngle|GeneralUIFeedback01)$/.test(c))
    return { decision: 'skip', category: 'id', reason: 'sounds.json 音效事件名（代码按该键取音效，改字符串会静默丢音，铁律 R7）' };
  if (/^(Button|THIS IS MY FIRST AWT EXAMPLE)$/.test(c))
    return { decision: 'skip', category: 'other', reason: 'DevTools/RTS_Console.java 的 AWT 示例窗口（上游遗留示例，模组从未实例化该类，运行期不可见）' };
  if (/^(HSICitadelDeployed|SU_SpeedUpEveryFrame|UICommandVolume|SCY_dracanae|XHAN_Gramada)$/.test(c))
    return { decision: 'skip', category: 'id', reason: '第三方 mod 舰体 id / customData 键 / 内部配置键（标识符）' };
  // 兜底：按字面量自身形态识别标识符（单 token 小写/全大写 id、含点号的全限定名、java 标识符形态）
  if (/^data\/scripts\//.test(c)) return { decision: 'skip', category: 'id', reason: '类名（标识符）' };
  if (/^RTS(A|_)[A-Za-z0-9_]*$/.test(c) && /^(RTS_BLOCKAI|RTS_OVERRIDE|RTS_common)/.test(c))
    return { decision: 'skip', category: 'id', reason: '舰船 customData 键（标识符，绝不可译，铁律 R7）' };
  if (/^(RTSA_Settings|RTS_common|qSaveData_|broadsides_)/.test(c))
    return { decision: 'skip', category: 'id', reason: 'LunaLib 设置键 / 存档与音效名（标识符，代码按该字符串读取）' };
  if (/\.(ini|json|csv)$/.test(c)) return { decision: 'skip', category: 'path', reason: '配置文件名（路径）' };
  if (/^(https?:|www\.)/.test(c)) return { decision: 'skip', category: 'path', reason: 'URL' };
  if (/^[A-Z][A-Z0-9_]*$/.test(c) && c.length > 2)
    return { decision: 'skip', category: 'id', reason: '全大写标识符（枚举/常量/引擎匹配键，如 HEAVY_ESCORT、PREADVANCE、FIGHTER）' };
  if (/^[A-Z][A-Za-z]*$/.test(c) && lineText.startsWith('case '))
    return { decision: 'skip', category: 'id', reason: 'switch 分支名（assignment 类型映射，标识符）' };
  if (/^return \(?"/.test(lineText))
    return { decision: 'skip', category: 'id', reason: 'BlockedSystems/BroadsideModifiers 返回的舰船系统 id 或舰体 id（引擎按 id 匹配，绝不可译，铁律 R7）' };
  if (/\.equals\("/.test(lineText))
    return { decision: 'skip', category: 'id', reason: '与引擎/原版数据比对的字符串（舰种分类、原版任务 id、hullmod id 等匹配键，绝不可译）' };
  if (/^(blockAi|overrideBlockSystem|overrideFacing|overrideThrust|isEnabled|inDevelopment)$/.test(c))
    return { decision: 'skip', category: 'id', reason: '内部配置/自定义数据键' };
  if (CN_RE.test(c)) return { decision: 'skip', category: 'other', reason: '已含中文' };
  // 兜底：按字面量自身形态识别标识符（单 token 小写/全大写 id、含点号的全限定名、java 标识符形态）
  if (/^[a-z][A-Za-z0-9_]*$/.test(c) || /^[A-Z][A-Z0-9_]*$/.test(c) || /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(c))
    return { decision: 'skip', category: 'id', reason: '单 token 标识符（HashMap/JSON 键、枚举名、类名；代码按该字符串读写数据，绝不可译）' };
  if (isAsciiIdent(c) && /^[a-z]/.test(c))
    return { decision: 'skip', category: 'id', reason: '内部 HashMap/JSON 键名（state、assignment、存档字段），数据流标识符' };
  return { decision: 'skip', category: 'other', reason: '非玩家可见文本（标识符/常量/内部调试），按提取 skill §2 分层排除' };
}

const excluded = [];
const stats = {};
let translateCount = 0;
for (const row of rows) {
  const cls = classify(row);
  if (cls.decision === 'translate') { translateCount++; continue; }
  stats[cls.category] = (stats[cls.category] || 0) + 1;
  excluded.push({
    c: row.c,
    classes: row.classes,
    src: row.src && row.src[0] ? row.src[0].ctx : null,
    asId: !!row.asId,
    decision: 'skip',
    category: cls.category,
    reason: cls.reason,
  });
}

fs.writeFileSync(path.join(OUT, 'excluded_entries.json'),
  JSON.stringify(excluded, null, 2).replace(/\n/g, '\r\n') + '\r\n', 'utf8');
fs.writeFileSync(path.join(OUT, 'classify_stats.json'),
  JSON.stringify({ jarConstantsTotal: rows.length, translate: translateCount, excluded: excluded.length, byCategory: stats }, null, 2), 'utf8');

console.log('jar constants:', rows.length, '| translate(已入清单):', translateCount, '| excluded:', excluded.length);
console.log('by category:', JSON.stringify(stats));
