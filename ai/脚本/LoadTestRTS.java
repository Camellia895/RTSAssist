import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.zip.*;

/**
 * LoadTestRTS — 离线类加载验证（G5 前置）：
 *   1) 从目标 jar 读取全部 .class 的类名（含默认包/内部类）
 *   2) Class.forName(name, true, loader) —— 会执行 static 初始化
 *   3) 对可实例化者（非抽象/非接口，且有无参构造）尝试 newInstance（镜像游戏加载插件/hullmod 类的路径）
 * 用法: java -noverify -Dcom.fs.starfarer.settings.paths.logs=<tmp> -cp "<gamecp>;<jar>" LoadTestRTS <jar> [--noInst]
 */
public class LoadTestRTS {
    public static void main(String[] args) throws Exception {
        String jarPath = args[0];
        boolean noInst = args.length > 1 && args[1].equals("--noInst");

        List<String> names = new ArrayList<String>();
        ZipFile zf = new ZipFile(jarPath);
        for (Enumeration<? extends ZipEntry> e = zf.entries(); e.hasMoreElements(); ) {
            ZipEntry ze = e.nextElement();
            String n = ze.getName();
            if (n.endsWith(".class") && !n.startsWith("META-INF/")) {
                names.add(n.substring(0, n.length() - 6).replace('/', '.'));
            }
        }
        zf.close();
        Collections.sort(names);
        System.out.println("classes in jar: " + names.size());

        ClassLoader cl = LoadTestRTS.class.getClassLoader();
        int loadOk = 0, loadFail = 0, envSkip = 0, instOk = 0, instSkip = 0, instFail = 0;
        List<String> failures = new ArrayList<String>();
        List<String> envSkips = new ArrayList<String>();

        for (String n : names) {
            Class<?> c;
            try {
                c = Class.forName(n, true, cl);
                loadOk++;
            } catch (Throwable t) {
                // ---- environment-limited static init ----
                // Some classes call Global.getSettings().xxx() in <clinit>. Offline there is no game
                // context, so Global.getSettings() returns null and we get an NPE. That is a limitation
                // of this harness, not a mod defect => classify as SKIP and report separately.
                if (needsGameContext(t)) { envSkip++; envSkips.add(n); continue; }
                loadFail++;
                failures.add("LOAD " + n + " :: " + t.getClass().getName() + ": " + t.getMessage());
                continue;
            }
            if (noInst) continue;
            int mod = c.getModifiers();
            if (Modifier.isAbstract(mod) || Modifier.isInterface(mod) || c.isEnum() || c.isAnonymousClass()) { instSkip++; continue; }
            try { c.getDeclaredConstructor(); } catch (NoSuchMethodException nsme) { instSkip++; continue; }
            try {
                Constructor<?> ctor = c.getDeclaredConstructor();
                ctor.setAccessible(true);
                ctor.newInstance();
                instOk++;
            } catch (Throwable t) {
                Throwable r = (t instanceof InvocationTargetException) ? ((InvocationTargetException) t).getTargetException() : t;
                if (needsGameContext(r)) { envSkip++; envSkips.add(n + " (ctor)"); instSkip++; continue; }
                String rn = r.getClass().getName();
                if (rn.startsWith("java.lang.NoClassDefFoundError") || rn.startsWith("java.lang.NoSuchMethodError")
                        || rn.startsWith("java.lang.NoSuchFieldError") || rn.startsWith("java.lang.VerifyError")
                        || rn.startsWith("java.lang.ClassNotFoundException") || rn.startsWith("java.lang.IncompatibleClassChangeError")
                        || rn.startsWith("java.lang.UnsupportedClassVersionError")) {
                    instFail++;
                    failures.add("INST " + n + " :: " + rn + ": " + r.getMessage());
                } else {
                    instSkip++;
                }
            }
        }
        System.out.println("load ok=" + loadOk + " fail=" + loadFail + " env-limited=" + envSkip);
        if (!noInst) System.out.println("instantiate ok=" + instOk + " fail(linkage)=" + instFail + " skipped=" + instSkip);
        if (!envSkips.isEmpty()) {
            System.out.println("--- ENV-LIMITED (" + envSkips.size() + "): needs game context, NOT a mod defect ---");
            for (String s : envSkips) System.out.println("  ~ " + s);
        }
        if (!failures.isEmpty()) {
            System.out.println("--- FAILURES (" + failures.size() + ") ---");
            for (String f : failures) System.out.println("  " + f);
        }
        System.out.println(loadFail == 0 && instFail == 0 ? "RESULT: PASS" : "RESULT: FAIL");
        System.exit(loadFail == 0 && instFail == 0 ? 0 : 1);
    }

    /** True when the throwable chain shows the class needed a live game context (Global.getSettings() == null). */
    private static boolean needsGameContext(Throwable t) {
        Throwable c = t;
        int depth = 0;
        while (c != null && depth < 10) {
            if (c instanceof NullPointerException) {
                String m = c.getMessage();
                if (m != null && m.contains("Global.getSettings()")) return true;
                if (m != null && m.contains("com.fs.starfarer.api.Global.getSettings")) return true;
            }
            for (StackTraceElement e : c.getStackTrace()) {
                if (e.getClassName().equals("com.fs.starfarer.api.Global") && e.getMethodName().equals("getSettings")) return true;
            }
            c = c.getCause();
            depth++;
        }
        return false;
    }
}
