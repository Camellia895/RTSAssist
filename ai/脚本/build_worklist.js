// build_worklist.js — 为 RTSAssist 汉化生成待译清单。
// 逐条以「文件 + 行号」定位并逐字符校验 en 与源文件该行一致（防止行号漂移导致注入错位）。
// 用法: node build_worklist.js <outDir>
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node build_worklist.js <outDir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const SRC = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/baseline/src/';
const LUNA = 'data/scripts/modInitilisation/RTS_LunaIntegration.java';

// [line, en] —— 逐字符取自源文件（含拼写错误，原文照录）
const lunaEntries = [
  [18, 'HotKeys'],
  [19, 'Settings'],
  [20, 'UI Settings'],
  [21, 'Dev Tools'],
  [38, 'Toggle RTS mode'],
  [39, 'Switch between vanilla and RTS control schemes.'],
  [49, 'Save Formations'],
  [50, 'Save all assignments, control groups and vanilla escort assignments to memory.'],
  [58, 'Load Formations'],
  [59, 'Load all assignments, control groups and vanilla escort assignments from memory, positioned at the cursor location.'],
  [67, 'Remove Assignment'],
  [68, 'Selected ships return to vanilla AI control.'],
  [76, 'Vent Ships'],
  [77, 'Selected ships will attempt to vent flux.'],
  [85, 'Use Systems'],
  [86, 'Selected ships will attempt to use their systems'],
  [94, 'Move Together'],
  [95, 'Selected ships with assigments will maintain formation.'],
  [103, 'Attack Move'],
  [104, 'Selected ships attack move to the designated position. Will convert any move assignments before creating a new assignment.'],
  [112, 'Strafe Camera Left'],
  [113, 'Strafe the Camera left using the keyboard'],
  [121, 'Strafe Camera Right'],
  [122, 'Strafe the Camera right using the keyboard'],
  [130, 'Strafe Camera Up'],
  [131, 'Strafe the Camera up using the keyboard'],
  [139, 'Strafe Camera Down'],
  [140, 'Strafe the Camera down using the keyboard'],
  [148, 'Adjust broadside modifier'],
  [149, 'Adjust broadside modifiers for a selected ship. Persistant between battles and saves'],
  [160, 'Default Mode'],
  [161, 'True / False : RTS mode is enabled/disabled at the beginning of combat. This does not disable the mod, but selects the default mode at the beginning of combat.'],
  [169, 'Pause on RTSMode'],
  [170, 'Pause when changing to RTS mode, unpause on changing to vanilla.'],
  [178, 'Switch Right Mouse Button'],
  [179, 'Switch single and double right click functionality. Temporarily disabled.'],
  [187, 'Mouse Scroll Speed'],
  [188, 'Change the speed at which the screen pans, when using the Mouse.'],
  [198, 'Mouse Scroll Smoothing'],
  [199, 'Change the acceleration at which the screen pans, when using the Mouse.'],
  [209, 'Keyboard Scroll Speed'],
  [210, 'Change the speed at which the screen pans, when using the Keyboard.'],
  [220, 'Keyboard Scroll Smoothing'],
  [221, 'Change the acceleration at which the screen pans, when using the Keyboard.'],
  [231, 'Maximum Zoom'],
  [232, 'How far the player can zoom out.'],
  [242, 'UI Scaling'],
  [243, 'Manually adjust UI scaling. If using in game UI scaling this should not be necessary. If you are using nvidia upscaling for example, you will likely need to adjust this setting. Match the value with your scaling setting.'],
  [253, 'Selection Tolerance'],
  [254, 'Adjusts the error tolerance for selecting ships. If you are constantly missing clicks on ships, raising this value will help. Settings to 1 removes this feature.'],
  [264, 'Remember Zoom when switching between Modes'],
  [265, 'The zoom for either RTSmode or Vanilla is stored and reset upon switching to that mode.'],
  [273, 'Alternative Rotation'],
  [274, 'An alternative method for rotating formations that requires less mouse movement.'],
  [282, 'UI Command Volume'],
  [283, 'Adjust the volume assosciated with the audio feedback for issuing commands.'],
  [293, 'Enable RTSAssist ship testing tools'],
  [294, 'See the modding README for details. Requires Starsector Devmode to be true.'],
  [302, 'modID'],
  [303, 'See the modding README for details. Entering strings in Luna is currently very buggy. It may be better to set this in the RTSAssist config.'],
  [311, 'Search for ALL ships'],
  [312, 'See the modding README for details.'],
];

// Config.ini / Hotkeys.ini：注释行（玩家可见的配置说明）
const iniEntries = [
  ['Config.ini', 4,  'If you are using LunaLib, treat this as a defaults config file. I.e., if you reset the settings in the luna menu they\'ll'],
  ['Config.ini', 5,  'revert to what is contained in this file. If you are not using lunalib, settings can be changed here. Be aware however'],
  ['Config.ini', 6,  'that any update to RTSAssist will reset this file. I will remedy this but for the time being use Luna.'],
  ['Config.ini', 9,  'Control Customisation'],
  ['Config.ini', 12, 'Change the speed of SIDE SCROLLING using the MOUSE. (a whole number greater than 0)'],
  ['Config.ini', 14, 'Change how much SMOOTHING is applied to SIDESCROLLING using the MOUSE. (a whole number greater than 0)'],
  ['Config.ini', 16, 'Change the speed of SIDE SCROLLING using the KEYBOARD. (a whole number greater than 0)'],
  ['Config.ini', 18, 'Change how much SMOOTHING is applied to SIDESCROLLING using the KEYBOARD. (a whole number greater than 0)'],
  ['Config.ini', 20, 'Change the default MAXIMUM ZOOM. (a whole number greater than 0)'],
  ['Config.ini', 22, 'Adjusts the error tolerance for selecting ships. (a whole number greater than 0)'],
  ['Config.ini', 26, 'GamePlay Customisation'],
  ['Config.ini', 29, 'Set the default STARTING MODE. (true or false)'],
  ['Config.ini', 31, 'Remember zoom on mode switch. (true or false)'],
  ['Config.ini', 33, 'PAUSE when changing to RTS mode and unpause whens switching back to VANILLA. (true or false)'],
  ['Config.ini', 35, 'Switch the DEFAULT behaviour of RIGHT CLICK. IF "true", a single click will instead create a'],
  ['Config.ini', 36, 'move and hold command. (true or false)'],
  ['Config.ini', 38, 'Alternative Rotation. An alternative method for rotating formations that requires less mouse'],
  ['Config.ini', 39, 'movement. (true or false)'],
  ['Config.ini', 43, 'UI Confgiuration'],
  ['Config.ini', 46, 'Change the VOLUME for COMMANDS and SELECTION feedback. (a whole number greater than or equal to 0, not higher than 10)'],
  ['Config.ini', 50, 'Mod Confgiuration'],
  ['Config.ini', 53, 'Manually adjust UI SCALING. If using in game UI scaling this should not be necesary.'],
  ['Config.ini', 54, 'Value is in percent but dont add the "%". (a whole number greater than 0)'],
  ['Config.ini', 57, 'Still in development. Currently, ships will only abandon assignments when faced with rapid destruction.'],
  ['Config.ini', 58, 'I.e., They will not run if they are slowly being destroyed, even to the point of death. However if'],
  ['Config.ini', 59, '5 reapers are about to strike them and they are likely about to be incinerated, they might abandon'],
  ['Config.ini', 60, 'their assignment. (true or false)'],
  ['Config.ini', 64, 'Legacy'],
  ['Config.ini', 67, 'For users that created their save game on version 0.1.5- and lower. Set to false to disable mod.'],
  ['Config.ini', 71, 'Modding Tools'],
  ['Hotkeys.ini', 2,  'WARNING: Always use capitals for hotKeys.'],
  ['Hotkeys.ini', 6,  'If you are using LunaLib, treat this as a defaults key file. I.e., if you reset the keys in the luna menu they\'ll'],
  ['Hotkeys.ini', 7,  'revert to what is contained in this file. If you are not using lunalib, hotkeys can be changed here. Be aware however'],
  ['Hotkeys.ini', 8,  'that any update to RTSAssist will reset this file. I will remedy this but for the time being use Luna.'],
  ['Hotkeys.ini', 10, 'Be aware that while in RTS mode these keys will only interact with the mod and there old functions will be disabled.'],
  ['Hotkeys.ini', 11, 'While not in RTS mode these hotkey will do nothing with the only exception being the ability to toggle RTS mode.'],
  ['Hotkeys.ini', 13, 'Enable/disable RTS mode. If left blank, CAPSLOCK is the hotkey, else its whatever you choose.'],
  ['Hotkeys.ini', 17, 'Keys for strafing the camera. Default (A,D,W,S -> top to bottom).'],
  ['Hotkeys.ini', 24, "Store the current ship positions (relative to there collective center) into memory. Default 'Q'."],
  ['Hotkeys.ini', 28, "Retrieve the current ship positions from memory centered around the mouse position. Default 'E'."],
  ['Hotkeys.ini', 32, "Delete assignments of selected ships. Default 'X'."],
  ['Hotkeys.ini', 36, "Selected ships must vent. Default 'V'."],
  ['Hotkeys.ini', 40, "Selected ships will attempt to use their system. Default 'F'."],
  ['Hotkeys.ini', 44, "Causes all selected ships to move together. Default 'R'."],
  ['Hotkeys.ini', 48, "Selected ships attack move to the designated position. Will convert any move assignments before creating a new assignment. Default 'C'."],
  ['Hotkeys.ini', 52, "Begin broadside selection. Release to finalise. Double to enable ai side detection. Default 'B'."],
  ['Hotkeys.ini', 56, 'Hold key and drag mouse to translate all selected ships.'],
  ['Hotkeys.ini', 57, 'Is finalised upon mouse release. Is cancellable by releasing key.'],
  ['Hotkeys.ini', 59, '"alt" -> not configurable yet'],
  ['Hotkeys.ini', 61, 'Hold and drag mouse to rotate all selected around point defined by mouseDown.'],
  ['Hotkeys.ini', 62, 'Is finalised upon mouse release. Is cancellable by releasing key.'],
  ['Hotkeys.ini', 64, '"alt and left control", -> not configurable yet'],
  ['Hotkeys.ini', 66, 'Pan the camera using these controls.'],
  ['Hotkeys.ini', 68, '"strafeCameraLeft": "A", -> not configurable yet'],
  ['Hotkeys.ini', 69, '"strafeCameraRight": "D", -> not configurable yet'],
  ['Hotkeys.ini', 70, '"strafeCameraUp": "W", -> not configurable yet'],
  ['Hotkeys.ini', 71, '"strafeCameraDown": "S", -> not configurable yet'],
];

const errors = [];
const readSrc = p => {
  const base = (p.endsWith('.ini')) ? SRC + '../../baseline_mod/' : SRC;
  return fs.readFileSync(path.resolve(base, p), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
};

// LunaIntegration
const lunaLines = readSrc(LUNA);
const lunaWork = lunaEntries.map(([line, en]) => {
  const actual = lunaLines[line - 1];
  // 校验：该行必须逐字符包含 en（含两侧引号内的完整字面量）
  if (!actual || actual.indexOf('"' + en + '"') === -1) {
    errors.push(`LUNA L${line}: 行内容不匹配\n  期望: "${en}"\n  实际: ${actual}`);
  }
  return {
    locator: `${LUNA}#L${line}`,
    file: LUNA,
    line,
    field: 'java-string-literal',
    en,
    zh: '',
    source: 'new',
    note: line <= 21 ? 'LunaLib 设置页签名（Java 字面量，需重编译 jar）'
        : (line <= 152 ? 'LunaLib 热键项（标题/说明）' : 'LunaLib 设置项（标题/说明）'),
  };
});

// ini
const iniCache = {};
const iniWork = iniEntries.map(([file, line, en]) => {
  if (!iniCache[file]) iniCache[file] = readSrc(file);
  const actual = iniCache[file][line - 1];
  // ini 注释行：去 `#` 前缀与缩进；环绕式标题行形如 `#** Text **#` → en 取 `Text`
  const body = (actual || '').replace(/^\s*#\s?/, '').replace(/\s+$/, '').replace(/^\*\*/, '').replace(/\*\*#?$/, '').trim();
  if (body !== en) {
    errors.push(`${file} L${line}: 注释内容不匹配\n  期望: ${JSON.stringify(en)}\n  实际: ${JSON.stringify(body)}`);
  }
  return {
    locator: `${file}#L${line}`,
    file,
    line,
    field: 'ini-comment',
    en,
    zh: '',
    source: 'new',
    note: '配置注释（玩家直接阅读本文件；保留 # 前缀与缩进，只改注释正文）',
  };
});

function writeJson(name, arr) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(arr, null, 2).replace(/\n/g, '\r\n') + '\r\n', 'utf8');
  return arr.length;
}

const n1 = writeJson('worklist_01_luna_settings.json', lunaWork);
const n2 = writeJson('worklist_02_ini_comments.json', iniWork);

let n3 = 0;
const w3 = path.join(OUT, 'worklist_03_docs.json');
if (fs.existsSync(w3)) n3 = JSON.parse(fs.readFileSync(w3, 'utf8').replace(/^\uFEFF/, '')).length;

const index = {
  mod: 'RTSAssist',
  version: '0.1.9c',
  gameVersion: '0.98a-RC8',
  baseline: '官方发布版 v0.1.9c_98a（mods\\RTSAssist 与 release zip 逐字节一致）',
  generatedFrom: 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/baseline/src',
  shards: [
    { file: 'worklist_01_luna_settings.json', entries: n1, scope: 'LunaLib 设置界面（页签名 + 热键项 13 + 设置项 15 的标题/说明），jar 层硬编码 → 注入后需重编译 jar' },
    { file: 'worklist_02_ini_comments.json', entries: n2, scope: 'Config.ini / Hotkeys.ini 面向玩家的配置注释（数据层，直接改文件）' },
    { file: 'worklist_03_docs.json', entries: n3, scope: 'mod_info.json 的 description（模组列表显示）+ ReadMe.txt 全文分块（玩家说明书）' },
  ],
  totalEntries: n1 + n2 + n3,
};
fs.writeFileSync(path.join(OUT, 'worklist_index.json'), JSON.stringify(index, null, 2).replace(/\n/g, '\r\n') + '\r\n', 'utf8');

console.log(`entries: luna=${n1} ini=${n2} total=${n1 + n2}`);
if (errors.length) {
  console.log('\n=== 校验失败 ' + errors.length + ' 条 ===');
  errors.forEach(e => console.log(e));
  process.exit(2);
}
console.log('全部条目 en 与源文件逐字符一致 ✔');
