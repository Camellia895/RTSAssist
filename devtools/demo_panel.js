'use strict';
/* =====================================================================================
 * demo_panel.js — 控件绑定与 Java 迁移片段生成
 * ===================================================================================*/

function bind(id, key, fmt, scale) {
  const el = document.getElementById(id), out = document.getElementById(id+'V');
  const apply = () => {
    let v = scale ? scale(+el.value) : +el.value;
    if (el.type === 'checkbox') v = el.checked;
    P[key] = v; out.textContent = fmt(el.type==='checkbox' ? (v?'开':'关') : +el.value);
    updateJava();
  };
  el.addEventListener('input', apply); apply();
}

const sel = document.getElementById('orderMode');
sel.addEventListener('change', () => { P.orderMode = sel.value; snapshot(); updateJava(); });

bind('cycleMs','cycleMs', v=>v);
bind('sweepMs','sweepMs', v=>v);
bind('floor','sweepFloor', v=>v.toFixed(2), v=>+v);
bind('tau','sweepTauFactor', v=>v.toFixed(2), v=>+v);
bind('cutoff','sweepCutoff', v=>v.toFixed(2), v=>+v);
bind('shipLine','shipSpeedLinePct', v=>v+'%');
bind('fiLine','fighterLineFactor', v=>v.toFixed(2), v=>+v);
bind('nShip','nShipsPerSide', v=>v);
bind('nFi','nFightersPerSide', v=>v);
bind('showVel','showVel', v=>v);
bind('showObj','showObj', v=>v);
bind('showVP','showVP', v=>v);
document.getElementById('nShip').addEventListener('change', resetSim);
document.getElementById('nFi').addEventListener('change', resetSim);

document.getElementById('btnPause').onclick = e => {
  P.paused = !P.paused; e.target.textContent = P.paused ? '继续' : '暂停';
};
document.getElementById('btnShuffle').onclick = () => snapshot();
document.getElementById('btnReset').onclick = () => location.reload();
cv.addEventListener('click', e => {
  const L = minimapLayout();
  if (e.clientX >= L.px && e.clientY >= L.top) addMarker(e.clientX, e.clientY);
});

/* Java 迁移片段：与 RTS_MiniMapRenderer.java / Config.ini / Luna 一一对应 */
function updateJava() {
  const box = document.getElementById('javaBox');
  box.textContent =
`// RTS_MiniMapRenderer.java
private static final float sweepPhaseSplit = ${SWEEP_PHASE_SPLIT}f;
private static final float sweepFloor = ${P.sweepFloor.toFixed(2)}f;
private static final float sweepTauFactor = ${P.sweepTauFactor.toFixed(2)}f;
private static final float sweepCutoff = ${P.sweepCutoff.toFixed(2)}f;   // 新增：亮度裁剪线
private static final float shipSpeedLineScale = ${(P.shipSpeedLinePct/100).toFixed(2)}f / 250f;
private static final float fighterSpeedLineScale = shipSpeedLineScale * ${P.fighterLineFactor.toFixed(2)}f;

// Config.ini / Luna
"miniMapRefreshMs": ${P.cycleMs},
"miniMapSweepMs": ${P.sweepMs},
扫描排序: ${P.orderMode === 'random' ? '随机次序' : '离旗舰近先扫（脉冲波）'}`;
}
updateJava();
document.getElementById('btnCopy').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('javaBox').textContent);
};
