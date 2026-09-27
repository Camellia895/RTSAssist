// audit_render_strings.js - scan the NEW Render subsystem (and everything else not present in 0.1.9c)
// for player-visible text. Prints every string literal >=3 chars with its source line, so a human
// can eyeball them; also flags any text-draw API usage (text rendering = definitely visible).
const fs = require('fs');
const path = require('path');

const NEWREL = 'C:/game/StarSector.v0.9.8a-RC8/_work/_tmp/rtsassist_v0204/rel/RTSAssist/src';
const OLDREL = 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/RTSAssist/baseline/src';

function walk(dir) {
  const out = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (p.endsWith('.java')) out.push(p);
    }
  })(dir);
  return out;
}
const rel = (base, p) => path.relative(base, p).replace(/\\/g, '/');

const newFiles = walk(NEWREL).map(p => rel(NEWREL, p));
const oldFiles = new Set(walk(OLDREL).map(p => rel(OLDREL, p)));
const added = newFiles.filter(f => !oldFiles.has(f));
console.log('files added in 0.2.04exp: ' + added.length);
added.forEach(f => console.log('  + ' + f));

// text-draw API usage anywhere in the new sources
const TEXT_API = /\b(addText|setText|drawText|renderText|TextPanel|LabelAPI|addPara|setTitle|addMessage|showMessage|addTooltip|setTooltip)\b/;
console.log('');
console.log('=== text-drawing API usages in 0.2.04exp sources ===');
let apiHits = 0;
for (const f of newFiles) {
  const lines = fs.readFileSync(path.join(NEWREL, f), 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    if (TEXT_API.test(l) && !/^\s*(\/\/|\*)/.test(l)) {
      apiHits++;
      if (apiHits <= 40) console.log('  ' + f + ':' + (i + 1) + '  ' + l.trim().slice(0, 130));
    }
  });
}
console.log('  total: ' + apiHits);

// all string literals >= 3 chars in the ADDED files
console.log('');
console.log('=== string literals (>=3 chars) in files ADDED by 0.2.04exp ===');
let litCount = 0;
const seen = new Set();
for (const f of added) {
  const lines = fs.readFileSync(path.join(NEWREL, f), 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    const re = /"((?:[^"\\]|\\.){3,})"/g;
    let m;
    while ((m = re.exec(l))) {
      const s = m[1];
      if (/[\u4e00-\u9fff]/.test(s)) continue;
      if (!/[A-Za-z]{2,}/.test(s)) continue;
      litCount++;
      const key = s + '|' + f;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log('  ' + JSON.stringify(s).slice(0, 110) + '   <- ' + f + ':' + (i + 1));
    }
  });
}
console.log('  total literal occurrences: ' + litCount + '  (unique per file: ' + seen.size + ')');
