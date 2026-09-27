// diag_static_init.js - print the root cause of static-init failures for the new jar.
// Uses the game JRE via child_process with stdio inherit; prints full cause chains.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
const T = path.join(GAME, '_work/_tmp/rtsassist_v0204');
const FAKE = path.join(T, 'fakemod');
const CORE = path.join(GAME, 'starsector-core');
const LT = path.join(GAME, '_work/mod_work/RTSAssist/out/loadtest');
const LOGS = path.join(T, 'ltlogs');

const cp = [
  `${CORE}/starfarer.api.jar`, `${CORE}/starfarer_obf.jar`, `${CORE}/json.jar`, `${CORE}/log4j-1.2.9.jar`,
  `${CORE}/lwjgl.jar`, `${CORE}/lwjgl_util.jar`, `${CORE}/fs.common_obf.jar`, `${CORE}/fs.sound_obf.jar`,
  `${CORE}/commons-compiler.jar`, `${CORE}/commons-compiler-jdk.jar`, `${CORE}/janino.jar`,
  `${CORE}/jaxb-api-2.4.0-b180830.0359.jar`, `${CORE}/txw2-3.0.2.jar`, `${CORE}/xstream-1.4.10.jar`,
  `${CORE}/jinput.jar`, `${CORE}/jogg-0.0.7.jar`, `${CORE}/jorbis-0.0.15.jar`, `${CORE}/webp-imageio-0.1.6.jar`,
  `${GAME}/mods/LazyLib/jars/LazyLib.jar`, `${GAME}/mods/LazyLib/jars/LazyLib-Kotlin.jar`, `${GAME}/mods/LazyLib/jars/internal/Kotlin-Runtime.jar`,
  `${GAME}/mods/LunaLib/jars/LunaLib.jar`, `${GAME}/mods/LunaLib/jars/fuzzywuzzy-1.3.0.jar`,
];
const jar = path.join(FAKE, 'jars/RTSAssist.jar');

// a tiny probe: force-initialize the given classes and print the full cause chain
const probe = `
import java.lang.reflect.*;
public class StaticInitProbe {
  public static void main(String[] a) throws Exception {
    for (String n : a) {
      System.out.println("=== " + n);
      try {
        Class.forName(n, true, StaticInitProbe.class.getClassLoader());
        System.out.println("   OK");
      } catch (Throwable t) {
        Throwable c = t;
        int d = 0;
        while (c != null && d < 8) {
          System.out.println("   [" + d + "] " + c.getClass().getName() + ": " + c.getMessage());
          StackTraceElement[] st = c.getStackTrace();
          for (int i = 0; i < Math.min(4, st.length); i++) System.out.println("        at " + st[i]);
          c = c.getCause();
          d++;
        }
      }
    }
  }
}
`;
const probeFile = path.join(T, 'StaticInitProbe.java');
fs.writeFileSync(probeFile, probe, 'utf8');
const jbr = 'C:/Program Files/Android/Android Studio/jbr/bin';
fs.mkdirSync(LT, { recursive: true });
execFileSync(path.join(jbr, 'javac.exe'), ['-nowarn', '--release', '17', '-encoding', 'UTF-8', '-d', LT, probeFile], { stdio: 'inherit' });

const classes = process.argv.slice(2);
if (!classes.length) { console.error('pass class names'); process.exit(2); }
const args = ['-noverify', `-Dcom.fs.starfarer.settings.paths.logs=${LOGS}`, '-cp', [LT, ...cp, jar].join(';'), 'StaticInitProbe', ...classes];
try {
  const out = execFileSync(path.join(GAME, 'jre/bin/java.exe'), args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  console.log(out);
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || '');
}
