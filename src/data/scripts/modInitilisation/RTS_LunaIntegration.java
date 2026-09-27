/*
  **********************************************************************************************************
  * RTSAssist version 0.2.10exp
  * Copyright (C) 2025-2026, Raatle

  * This program is free software: you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation, either version 3 of the License, or
  * (at your option) any later version.

  * This program is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  * GNU General Public License for more details.

  * You should have received a copy of the GNU General Public License
  * along with this program.  If not, see https://www.gnu.org/licenses/gpl-3.0.en.html.
  **********************************************************************************************************
 */

package data.scripts.modInitilisation;

import com.fs.starfarer.api.Global;
import data.scripts.RTSAssistModPlugin;
import lunalib.backend.ui.settings.LunaSettingsUISettingsPanel;
import lunalib.lunaSettings.LunaSettings;
import lunalib.lunaSettings.LunaSettingsListener;
import org.jetbrains.annotations.NotNull;
import org.lwjgl.input.Keyboard;

import java.util.HashMap;

import static data.scripts.RTSAssistModPlugin.RTS_Global;

public class RTS_LunaIntegration {

    String modID = "RTSAssist";
    String hotKeyTabName = "热键";
    String configTabName = "设置";
    String UITabName = "渲染设置";
    String DevToolsTabName = "开发者工具";
    HashMap<String, String> hotPointer = (HashMap<String, String>)RTSAssistModPlugin.RTS_Global.get("hotKeys");
    HashMap<String, Object> confPointer = (HashMap<String, Object>)RTSAssistModPlugin.RTS_Global.get("config");

    public void init () {
        if (!Global.getSettings().getModManager().isModEnabled("lunalib"))
            return;
        this.addHotkeys();
        this.addConfig();
        LunaSettings.SettingsCreator.refresh("RTSAssist");
    }

    private void addHotkeys () {
        /* Toggle RTS mode */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_enable_RTSMode",
                "切换 RTS 模式",
                "在原版操作方式与 RTS 控制模式之间切换。",
                hotPointer.get("enable_RTSMode") == null
                        ? 58
                        : Keyboard.getKeyIndex(this.hotPointer.get("enable_RTSMode")),
                this.hotKeyTabName
        );
        /* Save Formations */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_saveLayout",
                "保存阵型",
                "将所有命令、控制组以及原版护航指派保存至内存。",
                Keyboard.getKeyIndex(this.hotPointer.get("saveLayout")),
                this.hotKeyTabName
        );
        /* Load Formations */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_loadLayout",
                "加载阵型",
                "从内存中读取所有命令、控制组及原版护航指派，并在光标所在位置部署。",
                Keyboard.getKeyIndex(this.hotPointer.get("loadLayout")),
                this.hotKeyTabName
        );
        /* Remove Assignment */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_deleteAssignments",
                "移除命令",
                "所选舰船将重新交由原版 AI 接管。",
                Keyboard.getKeyIndex(this.hotPointer.get("deleteAssignments")),
                this.hotKeyTabName
        );
        /* Vent Ships */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_vent",
                "舰船排幅",
                "所选舰船将尝试进行主动排幅。",
                Keyboard.getKeyIndex(this.hotPointer.get("vent")),
                this.hotKeyTabName
        );
        /* Use Systems */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_useSystem",
                "启动战术系统",
                "所选舰船将尝试使用其战术系统。",
                Keyboard.getKeyIndex(this.hotPointer.get("useSystem")),
                this.hotKeyTabName
        );
        /* Move Together */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_moveTogether",
                "协同移动",
                "带有命令的所选舰船将保持阵型协同移动。",
                Keyboard.getKeyIndex(this.hotPointer.get("moveTogether")),
                this.hotKeyTabName
        );
        /* Attack Move */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_attackMove",
                "攻击移动",
                "所选舰船向指定位置执行攻击移动。若已有移动命令，将在创建新命令前将其转换为攻击移动。",
                Keyboard.getKeyIndex(this.hotPointer.get("attackMove")),
                this.hotKeyTabName
        );
        /* Strafe Left */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_strafeLeft",
                "镜头向左平移",
                "使用键盘向左平移镜头。",
                Keyboard.getKeyIndex(this.hotPointer.get("strafeCameraLeft")),
                this.hotKeyTabName
        );
        /* Strafe Right */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_strafeRight",
                "镜头向右平移",
                "使用键盘向右平移镜头。",
                Keyboard.getKeyIndex(this.hotPointer.get("strafeCameraRight")),
                this.hotKeyTabName
        );
        /* Strafe Up */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_strafeUp",
                "镜头向上平移",
                "使用键盘向上平移镜头。",
                Keyboard.getKeyIndex(this.hotPointer.get("strafeCameraUp")),
                this.hotKeyTabName
        );
        /* Strafe Down */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_strafeDown",
                "镜头向下平移",
                "使用键盘向下平移镜头。",
                Keyboard.getKeyIndex(this.hotPointer.get("strafeCameraDown")),
                this.hotKeyTabName
        );
        /* Begin broadside selection */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_broadsideSelection",
                "调整舷侧射击修正",
                "调整所选舰船的舷侧射击修正。该设置在战斗与存档之间永久保留。",
                Keyboard.getKeyIndex(this.hotPointer.get("broadsideSelection")),
                this.hotKeyTabName
        );
        /* Show/hide minimap */
        LunaSettings.SettingsCreator.addKeybind(
                this.modID,
                "RTSA_SettingsKeybind_toggleMiniMap",
                "显示/隐藏小地图",
                "在战斗中显示或隐藏 RTSAssist 小地图。",
                this.hotPointer.get("toggleMiniMap") == null
                        ? Keyboard.KEY_G
                        : Keyboard.getKeyIndex(this.hotPointer.get("toggleMiniMap")),
                this.hotKeyTabName
        );
    }

    private void addConfig () {
        /* Default mode at the beginning of battle. */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsConfig_defaultModeIsRTS",
                "默认模式",
                "开启/关闭：战斗开始时是否默认启用 RTS 模式。此选项不会禁用模组，仅决定入战时的初始模式。",
                (boolean)this.confPointer.get("defaultModeIsRTS"),
                this.configTabName
        );
        /* Pause on RTSMode */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsConfig_pauseUnpause",
                "切换至 RTS 模式时暂停",
                "切换至 RTS 模式时自动暂停游戏，切回原版模式时解除暂停。",
                (boolean)this.confPointer.get("pauseUnpause"),
                this.configTabName
        );
        /* Switch right mouse button */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsConfig_switchRightClick",
                "翻转鼠标右键功能",
                "互换鼠标右键单击与双击的功能。当前暂时停用。",
                (boolean)this.confPointer.get("switchRightClick"),
                this.configTabName
        );
        /* Mouse Scroll Speed */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsConfig_scrollSpeed",
                "鼠标滚屏速度",
                "调整使用鼠标移动视野时镜头的平移速度。",
                ((Float)this.confPointer.get("scrollSpeed")).intValue(),
                5,
                100,
                this.configTabName
        );
        /* Mouse Scroll Acceleration */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsConfig_scrollSmoothing",
                "鼠标滚屏平滑度",
                "调整使用鼠标移动视野时镜头平移的平滑度与加速度。",
                ((Float)this.confPointer.get("scrollSmoothing")).intValue(),
                2,
                50,
                this.configTabName
        );
        /* Keyboard Scroll Speed */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsConfig_scrollSpeedKeyboard",
                "键盘滚屏速度",
                "调整使用键盘平移镜头时的移动速度。",
                ((Float)this.confPointer.get("scrollSpeedKeyboard")).intValue(),
                5,
                100,
                this.configTabName
        );
        /* Keyboard Scroll Accleration */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsConfig_scrollSmoothingKeyboard",
                "键盘滚屏平滑度",
                "调整使用键盘平移镜头时的平滑度与加速度。",
                ((Float)this.confPointer.get("scrollSmoothingKeyboard")).intValue(),
                2,
                50,
                this.configTabName
        );
        /* Zoom Sensitivity */
        LunaSettings.SettingsCreator.addDouble(
                this.modID,
                "RTSA_SettingsConfig_zoomSensi",
                "缩放灵敏度",
                "滚轮缩放的灵敏度。",
                (float)this.confPointer.get("zoomSensi"),
                0.1d,
                10d,
                this.configTabName
        );
        /* Minimum Zoom */
        LunaSettings.SettingsCreator.addDouble(
                this.modID,
                "RTSA_SettingsConfig_minZoom",
                "最小缩放级别",
                "视角可向内拉近的最大视野距离。",
                (float)this.confPointer.get("minZoom"),
                0.1d,
                10d,
                this.configTabName
        );
        /* Maximum Zoom */
        LunaSettings.SettingsCreator.addDouble(
                this.modID,
                "RTSA_SettingsConfig_maxZoom",
                "最大缩放级别",
                "视角可向外拉远的最大视野距离。",
                (float)this.confPointer.get("maxZoom"),
                1d,
                50d,
                this.configTabName
        );
        /* Screen Scaling */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsConfig_screenScaling",
                "渲染缩放",
                "手动调整渲染缩放比例。若已在游戏本体内启用了画面缩放，则通常无需调整此项。若使用了 NVIDIA 超分辨率等缩放功能，可能需要调整此项以匹配对应的缩放比例数值。",
                ((Float)this.confPointer.get("screenScaling")).intValue(),
                1,
                500,
                this.configTabName
        );
        /* Selection Tolerance */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsConfig_selectionTolerance",
                "选框容差",
                "调整点击选中舰船时的判定容差范围。若经常点空，提高此数值会有所改善；设为 1 则关闭该容差特性。",
                ((Float)this.confPointer.get("selectionTolerance")).intValue(),
                1,
                10,
                this.configTabName
        );
        /* Remember Zoom */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsConfig_rememberZoom",
                "切换模式时保留缩放级别",
                "分别记录 RTS 模式与原版模式下的缩放级别，并在切换模式时自动复原。",
                (boolean)this.confPointer.get("rememberZoom"),
                this.configTabName
        );
        /* Alternative Rotation */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsConfig_alternativeRotation",
                "备选旋转控制",
                "一种对鼠标移动幅度要求更小的阵型旋转操控方式。",
                (boolean)this.confPointer.get("alternativeRotation"),
                this.configTabName
        );
        /* Render Command Volume */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsUI_CommandVolume",
                "指令音量",
                "调整下达指令时界面音频反馈的音量大小。",
                ((Float)this.confPointer.get("UICommandVolume")).intValue(),
                0,
                10,
                this.UITabName
        );
        /* Minimap refresh interval */
        LunaSettings.SettingsCreator.addInt(
                this.modID,
                "RTSA_SettingsUI_miniMapRefreshMs",
                "小地图刷新间隔",
                "调整小地图画面数据的刷新间隔（毫秒）。数值越低地图越流畅、开销越大；200（0.2 秒）是一个流畅与性能的平衡点。",
                ((Float)this.confPointer.get("miniMapRefreshMs")).intValue(),
                16,
                2000,
                this.UITabName
        );
        /* Show minimap */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsUI_showMiniMap",
                "显示小地图",
                "开启/关闭：是否显示 RTSAssist 小地图。入战时按此设置初始化，战斗中也可随时用热键切换。",
                (boolean)this.confPointer.get("showMiniMap"),
                this.UITabName
        );
        /* Enable RTS Ship testing tools */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsDevTools_enableShipTestSuite",
                "启用 RTSAssist 舰船测试工具",
                "详情请参阅模组开发说明文档（modding README）。需要将《远行星号》的开发者模式（Devmode）设为 true。",
                (boolean)this.confPointer.get("enableShipTestSuite"),
                this.DevToolsTabName
        );
        /* modID */
        LunaSettings.SettingsCreator.addString(
                this.modID,
                "RTSA_SettingsDevTools_modID",
                "modID",
                "详情请参阅模组开发说明文档。目前在 Luna 菜单中输入文本可能存在异常，建议直接在 RTSAssist 配置文件中修改此项。",
                (String)this.confPointer.get("modID"),
                this.DevToolsTabName
        );
        /* Toggle between searching ships with custom systems or all ships */
        LunaSettings.SettingsCreator.addBoolean(
                this.modID,
                "RTSA_SettingsDevTools_findAllShips",
                "搜索所有舰船",
                "详情请参阅模组开发说明文档。",
                (boolean)this.confPointer.get("findAllShips"),
                this.DevToolsTabName
        );
    }
}
