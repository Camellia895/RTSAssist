'use strict';
/* =====================================================================================
 * demo_params.js — 可调参数与常量
 * 与 mod 内 RTS_MiniMapRenderer 对应；调好后 demo_panel.js 自动生成 Java 迁移片段。
 * ===================================================================================*/

const P = {
  // ---- 扫描节奏 ----
  cycleMs: 1000,          // 循环周期 = 数据刷新周期（mod: miniMapRefreshMs）
  sweepMs: 300,           // 每相位扫完全部单位的时间（mod: miniMapSweepMs）
  orderMode: 'random',    // 'random' 随机次序 | 'flagship' 离旗舰近先扫（脉冲波）

  // ---- 透明度-时间曲线（高亮 = 刷新 = 打点）----
  // 扫描命中时在单位当前位置"打点"：以曲线左端亮度出现，之后【原地】按曲线衰减。
  // 每个元素 [t, a]：t = 距打点的时间（占 3 个周期的比例 0..1），a = 不透明度 0..1。
  // 打点保留 3 个周期；同一单位最多同时存在 3 个不同位置的印记（运动拖尾）。
  curve: [[0, 1], [0.28, 0.62], [0.6, 0.28], [1, 0.05]],
  curveSteps: 16,         // 迁移到 mod 时的查表采样段数（表长 = steps + 1）

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

/* 曲线求值：u ∈ [0,1]（距打点的时间占 3 周期之比例），返回不透明度 0..1（分段线性）*/
function evalCurve(u) {
  const pts = P.curve;
  if (u <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (u >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i][0]) {
      const x0 = pts[i-1][0], y0 = pts[i-1][1], x1 = pts[i][0], y1 = pts[i][1];
      const f = (u - x0) / ((x1 - x0) || 1e-6);
      return y0 + (y1 - y0) * f;
    }
  }
  return last[1];
}

const CURVE_DEFAULT = [[0, 1], [0.33, 0.45], [0.66, 0.18], [1, 0.04]];
const STAMP_LIFETIME_CYCLES = 3;   // 打点（残影）保留的周期数
