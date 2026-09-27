/*
  **********************************************************************************************************
  * RTSAssist version 0.2.04exp
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

package data.scripts.plugins.Render;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.CombatEngineAPI;
import com.fs.starfarer.api.combat.ShipAPI;
import data.scripts.RTSAssistModPlugin;
import data.scripts.modInitilisation.RTS_CommonsControl;
import data.scripts.plugins.RTSAssist;
import data.scripts.plugins.RTS_CameraRework;
import data.scripts.plugins.RTS_ParseInput;
import data.scripts.plugins.Render.Components.RTS_fogOfWar.RTS_FogOfWar;
import data.scripts.plugins.Render.Components.RTS_miniMap.RTS_Minimap;
import data.scripts.plugins.Render.RTS_drawManager.RTS_animator.RTS_Animator;
import data.scripts.plugins.Render.RTS_drawManager.RTS_DrawManager;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_BoundTexture;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_FBOManager;
import data.scripts.plugins.Render.RTS_drawManager.RTS_ShaderManager;
import data.scripts.plugins.Render.JXDOM.Div.RTS_Div;
import data.scripts.plugins.Render.JXDOM.Props.RTS_Prop;
import data.scripts.plugins.Render.JXDOM.RTS_Node;
import data.scripts.plugins.Utils.*;
import org.json.JSONException;
import org.json.JSONObject;
import org.lazywizard.lazylib.MathUtils;
import org.lwjgl.input.Mouse;
import org.lwjgl.opengl.Display;
import org.lwjgl.util.vector.Vector2f;

import java.io.IOException;
import java.util.*;
import java.util.List;

import static data.scripts.RTSAssistModPlugin.RTS_Global;
import static data.scripts.plugins.Render.JXDOM.Props.RTS_Prop.props;
import static data.scripts.plugins.Render.JXDOM.RTS_ComponentManager.children;

public class RTS_Root extends RTS_StatefulClasses implements RTS_Div, RTS_Minimap, RTS_FogOfWar {

    //------------------------------------------------------------------------------------------------------------------

    public static class roNames {
        public static String camera = RTS_StatefulClasses.getUniqueIdentifier();
        public static String shipList = RTS_StatefulClasses.getUniqueIdentifier();
        public static String marginalisedShipSprites = RTS_StatefulClasses.getUniqueIdentifier();
    }

    public RTS_Root (Object state) {
        super(state);
        this.drawManager = (RTS_DrawManager)this.getState(RTS_RenderManager.stNames.drawManager);
        this.eventManager = (RTS_EventManager)this.getState(RTSAssist.stNames.eventManager);
        this.animator = (RTS_Animator)this.getState(RTS_RenderManager.stNames.animator);
        this.initMiniMap(this.drawManager, this.animator);
        this.initFogOfWar(this.drawManager);
        for (Map.Entry<Integer, RTS_BoundTexture> entry : RTS_Root.marginedShipTextures.entrySet())
            RTS_FBOManager.destroyTextureFBO(entry.getValue());
        RTS_Root.marginedShipTextures.clear();
        ((RTS_EventManager)this.getState(RTSAssist.stNames.eventManager)).addListener(this.newShipsListener);
        this.loadMiniMapPosition();
    }

    public static class camera {
        public boolean init = false;
        public Vector2f visableDim = new Vector2f();
        public Vector2f pos = new Vector2f();
        public float zoom;
    }
    private camera camera = new camera();
    public static class shipList {
        public List<ShipAPI> allShips = new ArrayList<>();
        public List<ShipAPI> friendlyShips = new ArrayList<>();
        public List<ShipAPI> alliedShips = new ArrayList<>();
        public List<ShipAPI> enemyShips = new ArrayList<>();
        public List<ShipAPI> hulks = new ArrayList<>();
        public List<ShipAPI> friendlyFighters = new ArrayList<>();
        public List<ShipAPI> enemyFighters = new ArrayList<>();
        public List<ShipAPI> alliedFighters = new ArrayList<>();
    }
    private shipList listOfShips = new shipList();
    private static HashMap<Integer, RTS_BoundTexture> marginedShipTextures = new HashMap<>();
    public static Vector2f screenDim = new Vector2f();

    private RTS_DrawManager drawManager;
    private RTS_EventManager eventManager;
    private  RTS_Animator animator;


    private Vector2f minimapPos = new Vector2f(30f, 30f);
    private boolean minimapPosSaved = false;
    private Vector2f dragHold = new Vector2f();

    private RTS_Listener newShipsListener = new RTS_Listener() {
        /* This listens fors for new ships appearing on the battlfield and creates a new sprite of that ship
         *  However this process must wait for UI elements to disapear first otherwise sprite creation can fail???. */

        String queuedShipSpritesEvent = null;
        List<ShipAPI> queuedShipSprites = new ArrayList<>();

        @Override
        public String type() {
            return (RTS_ShipLocAPI.evNames.newShipsDeployed);
        }

        @Override
        public void run(HashMap<String, Object> e) {
            List<ShipAPI> newShips = (List<ShipAPI>)e.get(RTS_ShipLocAPI.evNames.newShipsDeployed);
            if (this.queuedShipSpritesEvent != null)
                eventManager.deleteEvent(queuedShipSpritesEvent);
            this.queuedShipSprites.addAll(newShips);
            queuedShipSpritesEvent = eventManager.addEvent(queueShips);
        }

        @Override
        public boolean removeOnCompletion() {
            return (false);
        }

        private RTS_Event queueShips = new RTS_Event() {

            @Override
            public void run () {
                buildMarginedShipSprites(queuedShipSprites);
                queuedShipSprites.clear();
                queuedShipSpritesEvent = null;
            }

            @Override
            public boolean shouldExecute (Object state) {
                CombatEngineAPI engine = Global.getCombatEngine();
                return (
                        !engine.isUIShowingDialog()
                                && engine.getCombatUI() != null
                                && !engine.getCombatUI().isShowingCommandUI()
                );
            }
        };
    };

    //------------------------------------------------------------------------------------------------------------------

    public void render () {
        RTS_Root.screenDim.set(
                ((Integer)Display.getWidth()).floatValue(),
                ((Integer)Display.getHeight()).floatValue()
        );
        /* No user-saved position yet: anchor the minimap to the bottom right corner. */
        if (!this.minimapPosSaved)
            this.minimapPos.set(
                    screenDim.getX() - (screenDim.getY() / 3f) - 30f,
                    30f
            );
        float miniY = ((Integer)Math.round(MathUtils.clamp(
                this.minimapPos.getY(),
                20f,
                screenDim.getY() * (2f/3f) -20f))
        ).floatValue();
        float miniX = ((Integer)Math.round(MathUtils.clamp(
                this.minimapPos.getX(),
                20f,
                (screenDim.getX() - (screenDim.getY() * (1f/3f))) -20f))
        ).floatValue();

        this.buildCamera();
        this.clearShipLists();
        this.buildShipLists();
        RTS_ShaderManager.clearProgram();

        /* Hotkey/config toggle: an inert minimap neither draws nor intercepts mouse input. */
        boolean miniMapEnabled = true;
        Object miniMapState = this.getState(RTSAssist.stNames.miniMapEnabled);
        if (miniMapState instanceof Boolean)
            miniMapEnabled = (Boolean)miniMapState;
        final boolean miniMapOn = miniMapEnabled;

        //--------------------------------------------------------------------------------------------------------------

        /* Body */
        div(
                props(
                        "height", this.screenDim.getY(),
                        "width", this.screenDim.getX()
                ), children(
                        /* MiniMap */
                        div(
                                props(
                                        "debug", true,
                                        "height", this.screenDim.getY() / 3f,
                                        "width", this.screenDim.getY() / 3f,
                                        "bottom", miniY,
                                        "left", miniX,
                                        "onDrag", setMinimapPosition,
                                        "onDragStart", (RTS_Prop.propEvent)(p, r, c) -> {
                                            if (miniMapOn)
                                                this.dragHold.set(Mouse.getX(), Mouse.getY());
                                        },
                                        "onHover", (RTS_Prop.propEvent)(p, r, c) -> {
                                            if (!miniMapOn)
                                                return;
                                            ((RTS_ParseInput)getState(RTSAssist.stNames.parseInput))
                                                    .queueInterrupt(RTS_ParseInput.interrupt.LMB);
                                            ((RTS_ParseInput)getState(RTSAssist.stNames.parseInput))
                                                    .queueInterrupt(RTS_ParseInput.interrupt.RMB);
                                        }
                                ),
                                miniMap(
                                        props(
                                                roNames.camera, camera,
                                                roNames.shipList, listOfShips,
                                                roNames.marginalisedShipSprites, this.marginedShipTextures,
                                                "inert", !miniMapOn
                                        ),
                                        this
                                )
                        ),
                        /* Fog of War */
                        div(
                                null,
                                fogOfWar(
                                        props(
                                                roNames.shipList, listOfShips
                                        ),
                                        this
                                )
                        )
                )
        );
    }

    //------------------------------------------------------------------------------------------------------------------

    private void loadMiniMapPosition () {
        float x; float y;
        RTS_CommonsControl commonsControl = (RTS_CommonsControl)RTS_Global.get(RTSAssistModPlugin.names.commonsControl);
        try {
            JSONObject data = (JSONObject)commonsControl.get(
                    "miniMapPos",
                    RTS_CommonsControl.JSONType.JSONOBJECT
            );
            if (data == null)
                return;
            x = ((Double)data.getDouble("x")).floatValue();
            y = ((Double)data.getDouble("y")).floatValue();
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        this.minimapPos.set(x, y);
        this.minimapPosSaved = true;
    }

    private void saveMiniMapPosition () {
        RTS_CommonsControl commonsControl = (RTS_CommonsControl)RTS_Global.get(RTSAssistModPlugin.names.commonsControl);
        JSONObject hold = new JSONObject();
        try {
            hold.put("x", ((Float)minimapPos.getX()).doubleValue());
            hold.put("y", ((Float)minimapPos.getY()).doubleValue());
            commonsControl.set("miniMapPos", hold);
        } catch (JSONException | IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void buildCamera () {
        if (!(boolean)this.getState(RTS_CameraRework.stNames.updated))
            return;
        this.camera.init = true;
        this.camera.visableDim.set(
                ((CombatEngineAPI)this.getState(RTSAssist.stNames.engine)).getViewport().getVisibleWidth(),
                ((CombatEngineAPI)this.getState(RTSAssist.stNames.engine)).getViewport().getVisibleHeight()
        );
        this.camera.pos.set(new Vector2f(
                Global.getCombatEngine().getViewport().getLLX(),
                Global.getCombatEngine().getViewport().getLLY()
        ));
        this.camera.zoom = (float)this.getState(RTS_CameraRework.stNames.targetZoom);
    }

    private void buildShipLists () {
        for (ShipAPI ship : Global.getCombatEngine().getShips()) {
            if (
                    ship.isShuttlePod()
                            || ship.getHullSize() == null
                            || ship.getOriginalOwner() == 100
            )
                continue;
            if (!ship.isHulk() && (ship.getHullSize().name().equals("FIGHTER") || ship.isFighter())) {
                if (ship.isAlly())
                    this.listOfShips.alliedFighters.add(ship);
                else if (ship.getOriginalOwner() == 0)
                    this.listOfShips.friendlyFighters.add(ship);
                else
                    this.listOfShips.enemyFighters.add(ship);
                this.listOfShips.friendlyFighters.add(ship);
                continue;
            }
            if (ship.getName() == null)
                continue;
            if (ship.isHulk())
                this.listOfShips.hulks.add(ship);
            else if (ship.isAlly())
                this.listOfShips.alliedShips.add(ship);
            else if (ship.getOriginalOwner() == 0)
                this.listOfShips.friendlyShips.add(ship);
            else if (ship.getOriginalOwner() == 1)
                this.listOfShips.enemyShips.add(ship);
            this.listOfShips.allShips.add(ship);
        }
        this.listOfShips.allShips.removeAll(this.listOfShips.hulks);
    }

    private void clearShipLists () {
        this.listOfShips.allShips.clear();
        this.listOfShips.friendlyShips.clear();
        this.listOfShips.friendlyFighters.clear();
        this.listOfShips.alliedShips.clear();
        this.listOfShips.alliedFighters.clear();
        this.listOfShips.enemyShips.clear();
        this.listOfShips.enemyFighters.clear();
        this.listOfShips.hulks.clear();
    }

    private void buildMarginedShipSprites (List<ShipAPI> shipList) {
        for (ShipAPI ship : shipList) {
            if (this.marginedShipTextures.containsKey(ship.getSpriteAPI().getTextureId()))
                continue;
            this.marginedShipTextures.put(
                    ship.getSpriteAPI().getTextureId(),
                    RTS_FBOManager.buildTextureFBO(ship.getSpriteAPI(), 100f)
            );
        }
    }

    private RTS_Prop.propEvent setMinimapPosition = new RTS_Prop.propEvent() {
        Vector2f grabMod = new Vector2f();
        String eventHold = null;

        @Override
        public void onTrigger (HashMap<String, Object> processedProps, Map<String, Object> rawProps, RTS_Node callingNode) {
            if (!(boolean)getState(RTS_ParseInput.stNames.isShiftDown))
                return;
            Object miniMapState = getState(RTSAssist.stNames.miniMapEnabled);
            if (miniMapState instanceof Boolean && !(Boolean)miniMapState)
                return;
            if (eventHold != null)
                ((RTS_EventManager)getState(RTSAssist.stNames.eventManager)).deleteEvent(eventHold);
            eventHold = ((RTS_EventManager)getState(RTSAssist.stNames.eventManager)).addEvent(new RTS_Event() {
                Float timeHold = null;
                @Override
                public boolean shouldExecute (Object state) {
                    if (timeHold == null)
                        timeHold = (float)getDeepState(Arrays.asList(RTSAssist.stNames.amount, RTSAssist.amNames.start));
                    float time = (float)getDeepState(Arrays.asList(RTSAssist.stNames.amount, RTSAssist.amNames.start));
                    return (time - timeHold > 0.2f);
                }

                @Override
                public void run () {
                    saveMiniMapPosition();
                    eventHold = null;
                }
            });
            if (dragHold.getX() != -1f) {
                grabMod.set(
                        dragHold.getX() - minimapPos.getX(),
                        dragHold.getY() - minimapPos.getY()
                );
                dragHold.set(-1f,-1f);
            }
            minimapPos.set(
                    Math.round(Mouse.getX() - grabMod.getX()),
                    Math.round(Mouse.getY() - grabMod.getY())
            );
        }
    };

    //------------------------------------------------------------------------------------------------------------------
}
