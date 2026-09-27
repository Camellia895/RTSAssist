'use strict';
/* =====================================================================================
 * demo_sweep.js — 扫描状态机与渲染（核心效果，改效果主要改这里）
 *
 * 与 mod 内 RTS_MiniMapRenderer 一一对应：
 *   - snapshot()/assignOffsets()  ≈ snapshot()/assignSweepOffsets()
 *   - 周期状态机                   ≈ sweepLayerCall
 *   - drawSweepGroup()            ≈ drawSweepGroup()（磷光亮度公式完全一致）
 *
 * 关键规则：未扫到的单位【完全不绘制】（亮度低于 sweepCutoff 即跳过），
 * 扫描命中 = 从无到有出现且最亮（刷新与高亮是同一瞬间），随后磷光消退。
 * ===================================================================================*/

let blipsS = [], blipsF = [];
let cycleStart = null, sessionT0 = null, firstCycle = true, lastCycleMs = P.cycleMs;
let markers = [];      // 单击指令标记

function sideColor(side, ally) {
  return ally ? PALETTE.allied : side === 0 ? PALETTE.friendly : PALETTE.enemy;
}

/* ---- 数据快照：只在周期边界调用（模拟 mod 的节流数据刷新）---- */
function snapshot() {
  blipsS = ships.map(s => ({
    x: s.x, y: s.y,
    vx: Math.cos(s.heading)*s.speed, vy: Math.sin(s.heading)*s.speed,
    facing: s.heading*180/Math.PI,
    size: ICON[s.cls], t: SHIP_T,
    lineScale: (P.shipSpeedLinePct/100)/250,
    color: sideColor(s.side, s.ally),
  }));
  blipsF = fighters.map(f => ({
    x: f.x, y: f.y,
    vx: Math.cos(f.heading)*f.speed, vy: Math.sin(f.heading)*f.speed,
    facing: f.heading*180/Math.PI,
    size: FIGHTER_ICON, t: FI_T,
    lineScale: (P.shipSpeedLinePct/100)/250*P.fighterLineFactor,
    color: sideColor(f.side, false),
  }));
  assignOffsets(blipsS); assignOffsets(blipsF);
}

/* 每个周期重新决定扫描次序；sweepOffset ∈ [0,1) 是单位在相位内的出场位次 */
function assignOffsets(blips) {
  const n = blips.length, idx = [...blips.keys()];
  if (P.orderMode === 'flagship' && flagship) {
    const fx = flagship.x, fy = flagship.y;
    idx.sort((a, b) => Math.hypot(blips[a].x-fx, blips[a].y-fy) - Math.hypot(blips[b].x-fx, blips[b].y-fy));
  } else {
    for (let i = n-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
  }
  for (let r = 0; r < n; r++) blips[idx[r]].sweepOffset = n <= 1 ? 0 : r/n;
}

/* ---- 画布 ---- */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W*dpr; cv.height = H*dpr;
  cv.style.width = W+'px'; cv.style.height = H+'px';
}
window.addEventListener('resize', resize); resize();

const PANEL_W = 352;
function minimapLayout() {
  const dimX = Math.min(H/3, W/3);
  return { dimX, px: W - PANEL_W - dimX - 30, top: H - 30 - dimX };
}

const stars = Array.from({length: 240}, () => ({ x: Math.random(), y: Math.random(), r: Math.random()*1.1+0.2, a: Math.random()*0.5+0.1 }));
const dbgEl = document.getElementById('dbg');

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now-lastT)/1000); lastT = now;
  if (!P.paused) { simTime += dt; stepSim(dt); }

  /* ---- 周期状态机：周期边界做数据快照 + 重新洗牌 ---- */
  const cycleMs = P.cycleMs;
  if (sessionT0 === null) sessionT0 = now;
  if (cycleStart === null) { cycleStart = now; snapshot(); }
  else if (now - cycleStart >= cycleMs) {
    if (firstCycle) firstCycle = false;
    cycleStart = now;
    if (lastCycleMs !== cycleMs) { firstCycle = true; lastCycleMs = cycleMs; }
    snapshot();
  }

  //------------------------------------------------ 绘制
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#9fb4c8';
  for (const st of stars) { ctx.globalAlpha = st.a; ctx.fillRect(st.x*W, st.y*H, st.r, st.r); }
  ctx.globalAlpha = 1;

  const L = minimapLayout();
  const dimX = L.dimX;
  const mx = x => L.px + dimX/2 + (x/MAP.w)*dimX;
  const my = y => L.top + dimYof() /2 + (y/MAP.h)*dimX;
  function dimYof() { return dimX; }

  const sweep = Math.min(P.sweepMs, cycleMs/2);
  let drawnS = 0, drawnF = 0;

  const drawGroup = (blips, phaseStartMs, counter) => {
    const phaseStartMsAbs = phaseStartMs * cycleMs;
    for (const b of blips) {
      const sweptAt = cycleStart + phaseStartMsAbs + b.sweepOffset*sweep;
      let since = now - sweptAt;
      const notYet = since < 0;
      if (notYet) since += cycleMs;             // 上一周期同一出场位次以来的时间
      if (firstCycle && notYet) continue;        // 首周期：没扫到就没存在过
      const bright = evalCurve(Math.min(since / cycleMs, 1));
      if (bright < P.sweepCutoff) continue;      // 磷光已灭：完全不绘制
      const a = Math.min(255, b.color.a * bright);
      const col = `rgba(${b.color.r},${b.color.g},${b.color.b},${(a/255).toFixed(3)})`;
      drawTriangle(mx(b.x), my(b.y), b.facing, b.size, b.t, col);
      if (P.showVel) drawVelLine(b, col, mx, my);
      counter.n++;
    }
  };
  function drawTriangle(cx0, cy0, facingDeg, size, thickness, col) {
    const rad = facingDeg*Math.PI/180;
    const c = Math.cos(rad), s = Math.sin(rad);
    const nx = cx0 + c*size*0.62, ny = cy0 + s*size*0.62;
    const tx = cx0 - c*size*0.38, ty = cy0 - s*size*0.38;
    const pxn = -s, pyn = c, hw = size*0.48;
    ctx.strokeStyle = col; ctx.lineWidth = thickness; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(nx, ny); ctx.lineTo(tx+pxn*hw, ty+pyn*hw);
    ctx.lineTo(tx-pxn*hw, ty-pyn*hw); ctx.closePath(); ctx.stroke();
  }
  function drawVelLine(b, col, mx_, my_) {
    const sp = Math.hypot(b.vx, b.vy); if (sp < 1) return;
    const len = Math.min(sp*b.lineScale*dimX, dimX*MAXLEN_MOD); if (len < 1.5) return;
    ctx.strokeStyle = col; ctx.lineWidth = b.t;
    ctx.beginPath(); ctx.moveTo(mx_(b.x), my_(b.y));
    ctx.lineTo(mx_(b.x) + b.vx/sp*len, my_(b.y) + b.vy/sp*len); ctx.stroke();
  }

  const cntS = { n: 0 }, cntF = { n: 0 };
  drawGroup(blipsS, 0, cntS);
  drawGroup(blipsF, SWEEP_PHASE_SPLIT, cntF);
  drawnS = cntS.n; drawnF = cntF.n;

  if (P.showObj) for (const o of objectives) {
    const c = o.owner===100 ? PALETTE.neutral : o.owner===1 ? PALETTE.enemy : PALETTE.friendly;
    const col = `rgba(${c.r},${c.g},${c.b},${(c.a*0.55/255).toFixed(3)})`;
    const cx0 = mx(o.x), cy0 = my(o.y), sz = 9;
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx0, cy0-sz); ctx.lineTo(cx0+sz, cy0);
    ctx.lineTo(cx0, cy0+sz); ctx.lineTo(cx0-sz, cy0); ctx.closePath(); ctx.stroke();
  }

  if (P.showVP) { // 视野框：跟随旗舰
    const vw = 7000, vh = 5000, cx0 = flagship ? flagship.x : 0, cy0 = flagship ? flagship.y : 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(mx(cx0 - vw/2), my(cy0 - vh/2), vw/MAP.w*dimX, vh/MAP.h*dimX);
  }

  // 单击标记（右键指令标记配色）
  markers = markers.filter(m => now - m.t0 < 400);
  for (const m of markers) {
    const d = (now-m.t0)/400*100, size = 10 + d/2;
    let a = 1; if (d < 20) a = d/20; else if (d > 80) a = (100-d)/20;
    a = Math.max(0, Math.min(1, a)) - 0.7*(d/100); a = Math.max(0, a);
    const c1 = PALETTE.RCMCore, c2 = PALETTE.RCMBorder;
    ctx.strokeStyle = `rgba(${c1.r},${c1.g},${c1.b},${a})`; ctx.lineWidth = Math.min(5, size*0.2);
    ctx.beginPath(); ctx.arc(m.x, m.y, size/2, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = `rgba(${c2.r},${c2.g},${c2.b},${a/3})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(m.x, m.y, size/2, 0, Math.PI*2); ctx.stroke();
  }

  // 时间轴（横跨 3 个循环）+ 调试读数
  const pos = ((now - cycleStart) % cycleMs) / cycleMs;
  const span = cycleMs * 3;
  const cursorU = sessionT0 === null ? 0 : ((now - sessionT0) % span) / span;
  document.getElementById('cursor').style.left = (cursorU*100)+'%';
  const segs = document.querySelectorAll('#timeline .seg');
  const sw = Math.min(P.sweepMs, cycleMs/2), half = cycleMs/2, hold = half - sw;
  for (let c = 0; c < 3; c++) {
    segs[c*4+0].style.flex = sw; segs[c*4+1].style.flex = hold;
    segs[c*4+2].style.flex = sw; segs[c*4+3].style.flex = hold;
  }
  dbgEl.textContent = `本帧绘制：舰船 ${drawnS}/${blipsS.length} · 战机 ${drawnF}/${blipsF.length} · 相位 ${(pos*100).toFixed(0)}%`;

  // 供外部（自动化验证）读取
  window.__sweep = { now, pos, drawnS, drawnF, totalS: blipsS.length, totalF: blipsF.length };

  // 曲线编辑器跟随主循环重绘（保证初始化时序健壮）
  if (window.CurveEditor && window.CurveEditor.render) window.CurveEditor.render();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function addMarker(x, y) { markers.push({ x, y, t0: performance.now() }); }
