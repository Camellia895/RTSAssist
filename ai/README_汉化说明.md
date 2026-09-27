# RTSAssist 汉化说明（0.2.04exp / 0.98a-RC8）

> 交付版本：**RTSAssist `0.2.04exp`**（中文界面文本）· 游戏版本 **0.98a-RC8** · 汉化基准 = **官方发布包 `v0.2.04exp`**
> 工作区留档：`<game>\_work\mod_work\RTSAssist\`；上一版（0.1.9c）汉化完整留档在同目录 `ver_0.1.9c_zh_2026-09-11\`。

## 1. 为什么换到 0.2.04exp

- 上游最新发布是 **`v0.2.04exp`（2026-05-27）**，但它与 0.2.0 / 0.2.01 / 0.2.02 一样是 **prerelease（实验版）**；
  `v0.1.9c_98a`（2026-03-13）是最后一个**正式版**。用户决定改用最新版。
- 兼容性已取证：新版的 `mod_info.json` 仍写 **`gameVersion: 0.98a-RC8`**，jar 的 class major = **61（Java 17）**
  ⇒ 与本机游戏版本完全匹配。
- ⚠️ **上游仓库 `main` 严重落后**：tag `v0.2.04exp` 只有 83 个 `.java`，官方发布包有 **147** 个，且共有文件内容全不同
  ⇒ 汉化与后续维护**一律以发布包为准**。

## 2. 文案在哪（本 mod 的形态没变）

| 层 | 位置 | 处理方式 |
|---|---|---|
| jar 层（**唯一的界面文案来源**） | `src/data/scripts/modInitilisation/RTS_LunaIntegration.java` 的字面量 → `jars/RTSAssist.jar` 常量池 | **常量池补丁**（见 §4） |
| 数据层 | `Config.ini` / `Hotkeys.ini` 的 `#` 注释、`mod_info.json` 的 `description`、`ReadMe.txt` | 直接改文件（UTF-8 无 BOM、保持 CRLF） |
| 战斗内提示 | **无**：本 mod 无 `addMessage`/`showMessage`，反馈全是绘制图形 + 音效 | — |
| 新增的 `Render/` 子系统 | **无玩家可见文本**：63 个新增源文件的 334 处字面量全为 JXDOM 属性名、shader uniform、图像路径、舰种 id、开发者异常 | 不动 |

## 3. 条目与工作量

| 翻译面 | 条目 | 复用 0.1.9c 旧译 | 本版新译 |
|---|---|---|---|
| LunaLib 设置界面（jar 层） | 65 | 57 | **8** |
| `Config.ini` 注释 | 32 | 30 | **2** |
| `Hotkeys.ini` 注释 | 27 | 27 | 0 |
| `mod_info.json` 说明 | 1 | 1 | 0 |
| `ReadMe.txt`（全文分块） | 50 | 50 | 0 |
| **合计** | **175** | **165** | **10** |

- **复用判定按内容匹配**（英文原文逐字符相同才复用），不靠行号 —— 新版 `Config.ini` 在开头插入 4 行，
  按行号比对会误报 50+ 处"改动"。
- 那 **10 条**是上游把界面里的 "UI" 统一改称 "Render"、并新增 Zoom Sensitivity / Minimum Zoom 两个设置带来的：
  详见 `审校表_v0204.md`（含 AI 直译初稿与待拍板的术语点）。
- **旧译在本版失效 5 条**（英文被上游改写，已自动弃用）：`UI Settings`、`UI Scaling`、
  `Manually adjust UI scaling…`、`UI Command Volume`，以及 `modID`（本就在"绝不译"名单）。
  逐条记录见 `obsoleted_old_translations.json`。

## 4. 注入方式：常量池补丁（未重编译）

理由与 0.1.9c 相同（本机无 JDK 17 的 `javac`；`javac 21+` 改变了 enum switch 的编法，实测会让 31 个类结构漂移）。

实测结果：

- jar 条目 **772/772 与官方一致**；**内容变化的恰 2 条**（`RTS_LunaIntegration.class` + 内嵌的 `.java`），其余 770 条**逐字节相同**。
- 目标类常量池：**65 条**可见常量被替换（65 条英文全部消失、65 条译文全部进池）。
- 全 jar 标识符含 CJK = 0；23 个数据键字面量完好。
- 离线 LoadTest（游戏 JRE 17 + `-noverify`）：`load ok=589 fail=0 env-limited=11`、
  `instantiate ok=139 fail(linkage)=0`、**RESULT: PASS**。
  - 那 11 条 "env-limited" 是 `Render` 子系统的类在 `<clinit>` 里调 `Global.getSettings().loadText()/getSprite()`，
    离线无游戏上下文 ⇒ `Global.getSettings()` 为 null。**这是测试环境限制，不是 mod 缺陷**；
    测试工具已升级为把这类失败单独归类（`LoadTestRTS.java` 的 `needsGameContext`），不再污染结论。

## 5. 交付前审计结论（`ai/脚本/verify_zh_final.js`）

```
PASS 13 项：
  已装 jar == 工作区 jar（SHA-256 3E50723A79603FF4…）
  jar 条目集合 772/772 一致；内容变化恰 2 条（Luna 的 class + .java）
  全 jar 标识符含 CJK = 0
  官方 65 条英文可见串全部消失；65 条译文进常量池
  23 个数据键字面量在 jar 内完好
  数据层 110 条译文全部落位；无 BOM；全部配置键 / mod_info 关键字段完好
  版本一致：mod_info=0.2.04exp / version.patch=04exp
  jar 内 .java 与 src_zh 一致；mods\RTSAssist\src 已同步
WARN 2 项（均无害，见 §6）
FAIL 0 项
```

另有：`check_encoding.js`（5 个载荷文件 0 BOM / 0 乱码）、`verify_all_data.js`（数据层易漏区全过）、
`check_font_glyphs.js`（6742 字形并集，缺字形 **0 种**）。

## 6. 已知限制 / 上游问题（非汉化引入）

1. **Dev Tools 页签里 `modID` 输入框标签显示英文 `modID`**：该字面量与类内标识符共享常量池条目，
   patcher 的标识符保护会跳过它；而它同时是 `Config.ini` 的键（`confPointer.get("modID")`），**译了会读不到配置**
   ⇒ 保持原样是正确处置。
2. 审计报告里 8 条"待人工确认的英文串"，逐条性质均已核实为**非玩家可见**：
   `Point Defense (Area)`（与原版数据比对的匹配键）、`Command Shuttle`（舰名比对）、
   `getHullSize -> name:` 等 4 条（DevTools 控制台打印）、
   `Exception in JXDOM:` / `JXDOM: Dom elements cannot have both…` 等 3 条
   （JXDOM UI 框架的 **Java 异常消息**，面向 modder 的 API 误用告警，非 UI 文本）。
3. **上游遗留**：`RTS_RenderManager` 引用 `data/shaders/test.frag`，但发布包该路径下无此文件
   （`data/shaders/Unused/test.frag` 存在）。该调用在测试路径，是否影响运行需游戏内确认；**不在汉化范围内**。

## 7. 尚未做的验证（需游戏内确认）

- **G6 装船目检**：模组列表中文说明、LunaLib 设置四个页签（**热键 / 设置 / 渲染设置 / 开发者工具**）与各项悬停说明、
  战斗内 Capslock 切换 RTS 模式、命令音效；0.2 新增的**雾战**与**小地图**是否正常显示。
- 同时确认 `starsector.log` 无新增 `at data.scripts` 或 ERROR 行。

## 8. 交付物与复现 / 回滚

**交付包**（`_work\deliver\`，命名规范 `<Mod>_<版本>_zh.zip`，多版本并存不覆盖）：

| 包 | 内容 | 大小 |
|---|---|---|
| `RTSAssist_0.2.04exp_zh.zip` | **本次交付**：0.2.04exp 汉化（jar 994,483 字节 / version 0.2.04exp / 含 `src` 与 `ai`） | 1.35 MB |
| `RTSAssist_0.1.9c_zh.zip` | 上一版交付（0.1.9c 汉化，jar 675,710 字节） | 0.89 MB |

| 目的 | 命令 |
|---|---|
| 从译文重跑注入（幂等） | `node ai\脚本\build_inject.js <modWork>` 预演 → 加 `--apply` 真注入 |
| 交付前审计 | `node ai\脚本\verify_zh_final.js <modWork>` |
| 离线类加载验证 | `powershell -File ai\脚本\loadtest.ps1` |
| 回滚到 **0.2.04exp 英文原版** | 用 `_work\mod_bak\RTSAssist_0.2.04exp_EN_backup\` 覆盖 `mods\RTSAssist\` |
| 回滚到 **0.1.9c 中文版**（上一版交付） | 用 `_work\mod_work\RTSAssist\ver_0.1.9c_zh_2026-09-11\` 覆盖 `mods\RTSAssist\`（jar SHA-256 `91E45CE33FB7243E…`）；或直接安装 `_work\deliver\RTSAssist_0.1.9c_zh.zip` |
| 回滚到 **0.1.9c 文档与语料** | `out\zh_corrected_0.1.9c\`（旧译冻结）、`out\zh_backup_0.1.9c\`（旧清单） |
