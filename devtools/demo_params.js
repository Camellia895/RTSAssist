'use strict';
/* =====================================================================================
 * demo_params.js — 可调参数与常量
 * 这里集中了所有"效果参数"，且与 mod 内 RTS_MiniMapRenderer 的常量同名同义。
 * 调好后 demo_panel.js 会自动生成对应的 Java 片段，照抄回 mod 即可。
 * ===================================================================================*/

const P = {
  // ---- 扫描节奏 ----
  cycleMs: 1000,          // 循环周期 = 数据刷新周期（mod: miniMapRefreshMs）
  sweepMs: 300,           // 每相位扫完全部单位的时间（mod: miniMapSweepMs）
  orderMode: 'random',    // 'random' 随机次序 | 'flagship' 离旗舰近先扫（脉冲波）

  // ---- 磷光余晖（CRT/PPI）----
  sweepFloor: 0,          // 亮度底值（mod: sweepFloor）。0 = 未扫到不显示
  sweepTauFactor: 0.30,   // 衰减速率 ×周期（mod: sweepTauFactor）。1s 周期时 0.45 → 残影 10%，0.30 → 3.6%
  sweepCutoff: 0.06,      // 不可见阈值：亮度低于此值不绘制（保证未扫到的单位绝对不出现）

  // ---- 单位与线条 ----
  shipSpeedLinePct: 10,   // 250su/s 时速度线长度占地图宽度的百分比（mod: shipSpeedLineScale = pct/100/250）
  fighterLineFactor: 0.45,// 战机速度线折减系数（mod: fighterSpeedLineScale）

  nShipsPerSide: 9,
  nFightersPerSide: 14,
  showVel: true, showObj: true, showVP: true,
  paused: false,
};

// ---- 结构常量（一般不动）----
const SWEEP_PHASE_SPLIT = 0.5;   // 舰船相位 [0,split)，战机相位 [split,1)
const ICON = { FRIGATE: 14, DESTROYER: 19, CRUISER: 27, CAPITAL_SHIP: 42 };
const FIGHTER_ICON = 7;
const SHIP_T = 2, FI_T = 1.2;            // 线宽
const MAXLEN_MOD = 0.16;                 // 速度线最大长度 ×地图宽

// 原版指挥页配色（settings.json：iconFriendColor / iconEnemyColor / iconNeutralShipColor）
const PALETTE = {
  friendly: { r: 0,   g: 255, b: 0,   a: 235 },
  enemy:    { r: 255, g: 0,   b: 0,   a: 235 },
  allied:   { r: 226, g: 196, b: 70,  a: 235 },
  neutral:  { r: 75,  g: 75,  b: 75,  a: 255 },
  viewPort: { r: 255, g: 255, b: 255 },
  RCMCore:  { r: 113, g: 234, b: 14 },
  RCMBorder:{ r: 2,   g: 255, b: 132 },
};
