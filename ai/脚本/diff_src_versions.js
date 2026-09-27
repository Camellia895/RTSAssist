// diff_src_versions.js - compare the new version's three source sources and extract all visible strings.
// 1) release zip src vs tag tarball src vs jar-embedded src -- which is authoritative?
// 2) dump the new version's LunaIntegration-like UI strings for diffing against 0.1.9c.
const fs = require('fs');
const path = require('path');

const T = 'C:/game/StarSector.v0.9.8a-RC8/_work/_tmp/rtsassist_v0204';
const REL = path.join(T, 'rel', 'RTSAssist');
const TAG = (() => { const d = path.join(T, 'src'); return path.join(d, fs.readdirSync(d)[0]); })();

function walk(dir, ext) {
  const out = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (p.endsWith(ext)) out.push(p);
    }
  })(dir);
  return out;
}
const sha = p => require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const relName = (base, p) => path.relative(base, p).replace(/\\/g, '/');

const relSrc = walk(path.join(REL, 'src'), '.java');
const tagSrc = walk(path.join(TAG, 'src'), '.java');
console.log('release zip src java:', relSrc.length);
console.log('tag tarball src java:', tagSrc.length);

const relMap = new Map(relSrc.map(p => [relName(path.join(REL, 'src'), p), p]));
const tagMap = new Map(tagSrc.map(p => [relName(path.join(TAG, 'src'), p), p]));
const onlyRel = [...relMap.keys()].filter(k => !tagMap.has(k));
const onlyTag = [...tagMap.keys()].filter(k => !relMap.has(k));
const diff = [];
for (const k of relMap.keys()) {
  if (!tagMap.has(k)) continue;
  if (sha(relMap.get(k)) !== sha(tagMap.get(k))) diff.push(k);
}
console.log('only in release zip:', onlyRel);
console.log('only in tag tarball:', onlyTag);
console.log('differing files:', diff.length);
diff.slice(0, 30).forEach(d => console.log('  ~ ' + d));

// 3) which classes exist in the new jar and which .java are embedded in it?
const { execFileSync } = require('child_process');
const JAR = path.join(REL, 'jars', 'RTSAssist.jar');
const list = execFileSync('C:/Program Files/Android/Android Studio/jbr/bin/jar.exe', ['tf', JAR], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
console.log('');
console.log('new jar entries:', list.length);
console.log('  .class:', list.filter(x => x.endsWith('.class')).length,
            ' .java:', list.filter(x => x.endsWith('.java')).length,
            ' other:', list.filter(x => !x.endsWith('.class') && !x.endsWith('.java')).length);
console.log('  other entries:');
list.filter(x => !x.endsWith('.class') && !x.endsWith('.java')).slice(0, 20).forEach(x => console.log('    ' + x));
