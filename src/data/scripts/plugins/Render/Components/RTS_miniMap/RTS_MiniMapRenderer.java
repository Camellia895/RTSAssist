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

package data.scripts.plugins.Render.Components.RTS_miniMap;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.*;
import com.fs.starfarer.api.graphics.SpriteAPI;
import data.scripts.plugins.Render.Components.RTS_miniMap.RTS_fighterSquares.RTS_FighterSquares;
import data.scripts.plugins.Render.RTS_drawManager.*;
import data.scripts.plugins.Render.RTS_drawManager.RTS_animator.RTS_AnimationController;
import data.scripts.plugins.Render.RTS_drawManager.RTS_animator.RTS_Animator;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_BoundTexture;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_FBO;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_FBOManager;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_PaintJob;
import data.scripts.plugins.Render.JXDOM.Props.*;
import data.scripts.plugins.Render.RTS_RenderManager;
import data.scripts.plugins.Render.RTS_Root;
import org.lazywizard.lazylib.MathUtils;
import org.lwjgl.util.vector.Vector2f;

import java.awt.*;
import java.util.*;
import java.util.List;

import org.lwjgl.opengl.*;

public class RTS_MiniMapRenderer {

    //------------------------------------------------------------------------------------------------------------------

    public RTS_MiniMapRenderer (RTS_DrawManager drawManager, RTS_Animator animator) {
        this.drawManager = drawManager;
        this.animator = animator;
        this.aniStore = new HashMap<>(5);
        for (int i = 0; i < 5; i++)
            this.aniStore.put(i, new markerStore());
    }

    public static final class palette {
        public static Color enemyOutline = new Color(161, 0, 0, 150);
        public static Color friendlyOutline = new Color(47, 255, 0, 150);
        public static Color allyOutline = new Color(186, 155, 31, 255);
        public static Color fadedCircleCon = new Color(0, 0, 0, 255);
        public static Color fadedCircleFren = new Color(58, 108, 25, 255);
        public static Color fadedCircleAlli = new Color(186, 155, 31, 255);
        public static Color fadedCircleEne = new Color(131, 21, 21, 255);
        public static Color circleLineFren = new Color(25, 250, 0, 255);
        public static Color circleLineAlli = new Color(243, 235, 0, 255);
        public static Color circleLineEnemy = new Color(213, 6, 6, 255);
        public static Color friendlyFighterQuad = new Color(194, 239, 158, 255);
        public static Color aliiedFighterQuad = new Color(243, 203, 38, 255);
        public static Color enemyFighterQuad = new Color(250, 158, 158, 255);
        public static Color fighterQuadOutline = new Color(0, 0, 0, 255);
        public static Color viewPortLine = new Color(255, 255, 255, 255);
        public static Color objectiveAlly = new Color(108, 108, 154, 255);
        public static Color objectiveEnemy = new Color(191, 108, 108, 255);
        public static Color objectiveNeutral = new Color(186, 186, 186, 255);
        public static Color fogOfWarBaseColor = new Color(0, 0, 0, 255);
        public static Color RCMCore = new Color(113, 234, 14, 255);
        public static Color RCMBorder = new Color(2, 255, 255, 132);
    }
    public static final class layers {
        public static int miniMap = RTS_RenderManager.ziNames.UIBase;
        public static int iconBackground = miniMap + 1;
        public static int fighterFar = miniMap + 2;
        public static int shipIcons = miniMap + 3;
        public static int fighterClose = miniMap + 4;
        public static int POIMarkers = miniMap + 5;
        public static int fogOfWar = miniMap + 6;
        public static int viewPortBox = miniMap + 7;
        public static int rightClick = miniMap + 8;
    }
    private static final float iconMod = 1f;
    private static final HashMap<String, Float> iconSizes = new HashMap<>() {{
        put("FRIGATE", 15f * iconMod);
        put("DESTROYER", 20f * iconMod);
        put("CRUISER", 30f * iconMod);
        put("CAPITAL_SHIP", 50f * iconMod);
    }};
    private static final HashMap<String, SpriteAPI> objectiveIcons = new HashMap<>() {{
        put("comm_relay", Global.getSettings().getSprite("RTS_ui", "comm_relay"));
        put("nav_buoy", Global.getSettings().getSprite("ui", "icon_tactical_coordinated_maneuvers"));
        put("sensor_array", Global.getSettings().getSprite("ui", "icon_tactical_electronic_warfare"));
        put("nullObjective", Global.getSettings().getSprite("RTS_ui", "objIconNull"));
    }};
    private static final SpriteAPI nullObjective = Global.getSettings().getSprite("RTS_ui", "objIconNull");
    private static final float fighterBlockSizediv2 = 4f;
    private static final float fighterOpacity = 0.6f;
    private static final float rightClickMarkerDuration = 0.4f;
    public static RTS_FBO miniMapFBO;

    private RTS_DrawManager drawManager;
    private RTS_FighterSquares fighterManager = null;
    public RTS_Root.camera camera;
    public RTS_Animator animator;

    private boolean init;
    private Vector2f pos = new Vector2f();
    private Vector2f posRef = new Vector2f();
    private Vector2f dim = new Vector2f();
    private boolean disabled = false;
    private float opacity = 1f;
    private Integer nextMarker = 0;

    private class markerStore {
        public markerStore () {
            this.aniCont.setAnimateDuringPause(true);
        }
        boolean queueAnimation = false;
        boolean removeAnimation = false;
        Vector2f location = new Vector2f();
        RTS_AnimationController aniCont = new RTS_AnimationController(rightClickMarkerDuration);
    }
    private HashMap<Integer, markerStore> aniStore;
    private HashMap<Integer, RTS_BoundTexture> marginedShipSprites;

    private List<ShipAPI> allShips;
    private List<ShipAPI> friendlyShips;
    private List<ShipAPI> alliedShips;
    private List<ShipAPI> enemyShips;
    private List<ShipAPI> hulks;
    private List<ShipAPI> friendlyFighters;
    private List<ShipAPI> enemyFighters;
    private List<ShipAPI> alliedFighters;

    //------------------------------------------------------------------------------------------------------------------

    public void render(
            RTS_Root.camera camera,
            RTS_Root.shipList listOfShips,
            HashMap<Integer, RTS_BoundTexture> marginedShipSprites
    ) {
        if (disabled || !this.init)
            return;
        this.marginedShipSprites = marginedShipSprites;
        this.buildShipLists(listOfShips);
        this.updateAnimationControllers();
        this.camera = camera;
        this.drawManager.registerDrawCall(this.backGroundCall);
        this.drawManager.registerDrawCall(this.outlinedShipIconsCall);
        this.drawManager.registerDrawCall(this.ShipIconBackground);
        this.drawManager.registerDrawCall(this.fighterSquaresFar);
        this.drawManager.registerDrawCall(this.fighterSquaresClose);
        this.drawManager.registerDrawCall(this.viewPortBox);
        this.drawManager.registerDrawCall(this.fogOfwar);
        this.drawManager.registerDrawCall(this.POImarkers);
        this.drawManager.registerDrawCall(this.rightClickMarker);
    }

    protected void update (HashMap<String, Object> props, Map<String, Object> rawProps) {
        this.disabled = (boolean)props.get(RTS_P_Inert.ID());
        this.opacity = (float)props.get(RTS_P_Opacity.ID());
        this.pos.set((float)props.get(RTS_P_Left.ID()), RTS_Root.screenDim.getY() - (float)props.get(RTS_P_Top.ID()));
        this.dim.set((float)props.get(RTS_P_Width.ID()), (float)props.get(RTS_P_Height.ID()));
        this.posRef.set(this.pos.getX(), this.pos.getY() - this.dim.getY());
        if (!this.init)
            this.init();
        this.backGroundCall.modify();
        this.rightClickMarker.modify();
        this.fogOfwar.modify();
    }

    private void init () {
        RTS_MiniMapRenderer.miniMapFBO = RTS_FBOManager.buildFBO(this.dim);
        this.fighterManager = new RTS_FighterSquares();
        this.init = true;
    }

    //------------------------------------------------------------------------------------------------------------------

    private RTS_DrawCall backGroundCall = new RTS_DrawCall() {
        final SpriteAPI mapBackground = Global.getSettings().getSprite("RTS_miniMap", "background");
        RTS_DrawQuad.quadCall quadBuilder = new RTS_DrawQuad.quadCall();
        boolean init = false;

        @Override
        public Integer zIndex() {
            return (layers.miniMap);
        }

        @Override
        public void modify () {
            float spriteW = this.mapBackground.getWidth();
            float spriteH = this.mapBackground.getHeight();
            float sizeMod = dim.getX() / spriteW;
            Vector2f posHold = new Vector2f(
                    pos.getX() + (spriteW * sizeMod / 2f),
                    pos.getY() - (spriteH * sizeMod / 2f)
            );
            this.quadBuilder
                    .sprite(this.mapBackground)
                    .size(sizeMod)
                    .pos(posHold)
                    .facing(-90f)
                    .alpha(opacity);
        }

        @Override
        public void call() {
            if (!this.init) {
                this.init = true;
                this.modify();
            }
            quadBuilder.render(true, false);
        }
    };

    private RTS_DrawCall outlinedShipIconsCall = new RTS_DrawCall() {
        RTS_DrawQuad.quadCall quadBuilder = new RTS_DrawQuad.quadCall();
        RTS_GenericDrawMeth.addOutLineToQuad outlineShader = new RTS_GenericDrawMeth.addOutLineToQuad();
        float outLineThickness = 30f / 1000f;

        @Override
        public Integer zIndex() {
            return (layers.shipIcons);
        }

        @Override
        public void call() {
//            int originalMinFilter = GL11.glGetTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER);
//            int originalMagFilter = GL11.glGetTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER);
//            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR);
//            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_LINEAR);
            RTS_FBOManager.bindFBO(RTS_MiniMapRenderer.miniMapFBO, posRef);

            Integer sprPoi;
            Float thickPoi;
            for (ShipAPI ship : friendlyShips) {
                sprPoi = ship.getSpriteAPI().getTextureId();
                thickPoi = 1f + MathUtils.clamp(
                        (1f - ((Math.max(ship.getSpriteAPI().getWidth(), ship.getSpriteAPI().getHeight()) / 100f) / 5f))
                        ,0f,
                        1f
                );
                thickPoi = outLineThickness * thickPoi;
                if (marginedShipSprites.containsKey(sprPoi)) {
                    quadBuilder
                            .sprite(marginedShipSprites.get(sprPoi).newSprite())
                            .size(getShipIconSizeMod(ship))
                            .facing(ship.getFacing() - 90f)
                            .filter(outlineShader)
                                .thickness(thickPoi)
                                .color(palette.friendlyOutline)
                            .set()
                            .pos(getShipLocation(ship))
                            .push();
                }
            }
            if (!friendlyShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : alliedShips) {
                sprPoi = ship.getSpriteAPI().getTextureId();
                thickPoi = 1f + MathUtils.clamp(
                        (1f - ((Math.max(ship.getSpriteAPI().getWidth(), ship.getSpriteAPI().getHeight()) / 50f) / 10f))
                        ,0f,
                        1f
                );
                thickPoi = outLineThickness * thickPoi;
                if (marginedShipSprites.containsKey(sprPoi)) {
                    quadBuilder
                            .sprite(marginedShipSprites.get(sprPoi).newSprite())
                            .size(getShipIconSizeMod(ship))
                            .facing(ship.getFacing() - 90f)
                            .filter(outlineShader)
                                .thickness(thickPoi)
                                .color(palette.allyOutline)
                            .set()
                            .pos(getShipLocation(ship))
                            .push();
                }
            }
            if (!alliedShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : enemyShips) {
                sprPoi = ship.getSpriteAPI().getTextureId();
                thickPoi = 1f + MathUtils.clamp(
                        (1f - ((Math.max(ship.getSpriteAPI().getWidth(), ship.getSpriteAPI().getHeight()) / 50f) / 10f)),
                        0f,
                        1f
                );
                thickPoi = outLineThickness * thickPoi;
                if (marginedShipSprites.containsKey(sprPoi)) {
                    quadBuilder
                            .sprite(marginedShipSprites.get(sprPoi).newSprite())
                            .size(getShipIconSizeMod(ship))
                            .facing(ship.getFacing() - 90f)
                            .filter(outlineShader)
                                .thickness(thickPoi)
                                .color(palette.enemyOutline)
                            .set()
                            .pos(getShipLocation(ship))
                            .push();
                }
            }
            if (!enemyShips.isEmpty())
                quadBuilder.render();

            RTS_FBOManager.unbindFBO();
//            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, originalMinFilter);
//            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, originalMagFilter);

            RTS_FBOManager.paintFBO(new RTS_PaintJob(
                    RTS_MiniMapRenderer.miniMapFBO,
                    posRef,
                    0
            ));
        }
    };

    private RTS_DrawCall ShipIconBackground = new RTS_DrawCall() {
        RTS_DrawQuad.quadCall quadBuilder = new RTS_DrawQuad.quadCall();
        RTS_GenericDrawMeth.quadToCircleLineShader circleLineShader = new RTS_GenericDrawMeth.quadToCircleLineShader();
        RTS_GenericDrawMeth.circularizeAndFadeQuad fadedCircleShader = new RTS_GenericDrawMeth.circularizeAndFadeQuad();
        Vector2f posHold = new Vector2f();
        float sizeHold;
        float thickness = 5f;
        float fadeThickness = 5f;
        float fadeStrength = 0.6f;
        float innerStrength = 0.4f;


        @Override
        public Integer zIndex() {
            return (layers.iconBackground);
        }

        @Override
        public void call() {
            RTS_FBOManager.bindFBO(RTS_MiniMapRenderer.miniMapFBO, posRef);

            float radialmod = iconMod * 0.5f;

            for (ShipAPI ship : enemyShips) {
                posHold = getShipLocation(ship);
                sizeHold = (iconSizes.get(ship.getHullSize().name()) * radialmod) - 3f;
                quadBuilder
                        .color(palette.circleLineEnemy)
                        .pos(posHold)
                        .size(sizeHold * 6f)
                        .filter(circleLineShader)
                            .thickness(thickness)
                            .fadeThickness(fadeThickness)
                        .set()
                        .push();
            }
            if (!enemyShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : alliedShips) {
                posHold = getShipLocation(ship);
                sizeHold = (iconSizes.get(ship.getHullSize().name()) * radialmod) - 3f;
                quadBuilder
                        .color(palette.circleLineAlli)
                        .pos(posHold)
                        .size(sizeHold * 6f)
                        .filter(circleLineShader)
                            .thickness(thickness)
                            .fadeThickness(fadeThickness)
                        .set()
                        .push();
            }
            if (!alliedShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : friendlyShips) {
                posHold = getShipLocation(ship);
                sizeHold = (iconSizes.get(ship.getHullSize().name()) * radialmod) - 3f;
                quadBuilder
                        .color(palette.circleLineFren)
                        .pos(posHold)
                        .size(sizeHold * 6f)
                        .filter(circleLineShader)
                            .thickness(thickness)
                            .fadeThickness(fadeThickness)
                        .set()
                        .push();
            }
            if (!friendlyShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : enemyShips) {
                posHold = getShipLocation(ship);
                sizeHold = iconSizes.get(ship.getHullSize().name()) * radialmod;
                quadBuilder
                        .pos(posHold)
                        .size(sizeHold * 6f)
                        .filter(fadedCircleShader)
                            .color(palette.fadedCircleCon)
                            .color1(palette.fadedCircleEne)
                            .fadeStrength(fadeStrength)
                            .innerStrength(innerStrength)
                        .set()
                        .push();
            }
            if (!enemyShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : alliedShips) {
                posHold = getShipLocation(ship);
                sizeHold = iconSizes.get(ship.getHullSize().name()) * radialmod;
                quadBuilder
                        .pos(posHold)
                        .size(sizeHold * 6f)
                        .filter(fadedCircleShader)
                            .color(palette.fadedCircleCon)
                            .color1(palette.fadedCircleAlli)
                            .fadeStrength(fadeStrength)
                            .innerStrength(innerStrength)
                        .set()
                        .push();
            }
            if (!alliedShips.isEmpty())
                quadBuilder.render();

            for (ShipAPI ship : friendlyShips) {
                posHold = getShipLocation(ship);
                sizeHold = iconSizes.get(ship.getHullSize().name()) * radialmod;
                quadBuilder
                        .pos(posHold)
                        .size(sizeHold * 6f)
                        .filter(fadedCircleShader)
                            .color(palette.fadedCircleCon)
                            .color1(palette.fadedCircleFren)
                            .fadeStrength(fadeStrength)
                            .innerStrength(innerStrength)
                        .set()
                        .push();
            }
            if (!friendlyShips.isEmpty())
                quadBuilder.render();

            RTS_FBOManager.unbindFBO();
            RTS_FBOManager.paintFBO(new RTS_PaintJob(
                    RTS_MiniMapRenderer.miniMapFBO,
                    posRef,
                    0
            ));
        }
    };

    private RTS_DrawCall fighterSquaresFar = new RTS_DrawCall() {
        @Override
        public Integer zIndex() {
            return (layers.fighterFar);
        }

        @Override
        public void call() {
            fighterManager.set(
                    pos,
                    dim,
                    opacity,
                    fighterOpacity,
                    fighterBlockSizediv2,
                    friendlyFighters,
                    enemyFighters,
                    alliedFighters
            );
            fighterManager.drawFighterSquaresFar();
        }
    };

    private RTS_DrawCall fighterSquaresClose = new RTS_DrawCall() {
        @Override
        public Integer zIndex() {
            return (layers.fighterClose);
        }

        @Override
        public void call() {
            fighterManager.set(
                    pos,
                    dim,
                    opacity,
                    fighterOpacity,
                    fighterBlockSizediv2,
                    friendlyFighters,
                    enemyFighters,
                    alliedFighters
            );
            fighterManager.drawFighterSquaresClose();
        }
    };

    private RTS_DrawCall viewPortBox = new RTS_DrawCall() {

        @Override
        public Integer zIndex() {
            return (layers.viewPortBox);
        }

        @Override
        public void call() {
            if (!camera.init)
                return;
            RTS_GenericDrawMeth.viewPortBoxOutline_LEGACY(
                    new RTS_GenericDrawMeth.quadRec(
                            this.getCameraLocation(camera.pos, camera.visableDim),
                            this.getViewPortSize(),
                            palette.viewPortLine
                    ),
                    0.5f,
                    0.8f * opacity,
                    0.3f,
                    this.getConstraint()
            );
        }

        private Vector2f getCameraLocation (Vector2f camerPos, Vector2f visibleVec) {
            Vector2f location = new Vector2f();
            float battleW = Global.getCombatEngine().getMapWidth();
            float battleH = Global.getCombatEngine().getMapHeight();
            location.setX(
                      pos.getX()
                    + (dim.getX() / 2f)
                    + ((camerPos.getX() / battleW) * dim.getX())
                    + (((visibleVec.getX() / battleW) * dim.getX()) / 2f)
            );
            location.setY(
                      pos.getY()
                    - (dim.getY() / 2f)
                    + ((camerPos.getY() / battleH) * dim.getY())
                    + (((visibleVec.getY() / battleH) * dim.getY()) / 2f)
            );
            return (location);
        }

        private Vector2f getViewPortSize () {
            CombatEngineAPI eng = Global.getCombatEngine();
            return (new Vector2f(
                    (eng.getViewport().getVisibleWidth() / eng.getMapWidth()) * dim.getX(),
                    (eng.getViewport().getVisibleHeight() / eng.getMapHeight()) * dim.getY()
            ));
        }

        private RTS_GenericDrawMeth.quadConstraint getConstraint () {
            return (
                    new RTS_GenericDrawMeth.quadConstraint(
                            pos.getX(),
                            pos.getX() + dim.getX(),
                            pos.getY() - dim.getY(),
                            pos.getY()
                    )
            );
        }
    };

    private RTS_DrawCall fogOfwar = new RTS_DrawCall() {
        RTS_DrawQuad.quadCall quadBuilder = new RTS_DrawQuad.quadCall();
        RTS_GenericDrawMeth.quadToCircleArrayUnion unionShader = new RTS_GenericDrawMeth.quadToCircleArrayUnion();

        @Override
        public void modify () {
            float radRat = dim.getX() / Global.getCombatEngine().getMapWidth();
            radRat = radRat * radRat;
            unionShader
                    .blend(45000f * radRat)
                    .aliasing(10000f * radRat)
                    .size(miniMapFBO.dimensions())
                    .color(palette.fogOfWarBaseColor);
        }

        @Override
        public Integer zIndex() {
            return (layers.fogOfWar);
        }

        @Override
        public void call() {
            List<ShipAPI> shipWithVision = new ArrayList<>();
            shipWithVision.addAll(friendlyShips);
            shipWithVision.addAll(alliedShips);
            float rMod = dim.getX() / Global.getCombatEngine().getMapWidth();
            unionShader.clearCircles();
            Vector2f locPointer;
            float radius;
            for (ShipAPI ship : shipWithVision) {
                locPointer = getShipLocation(ship);
                radius = ship.getMutableStats().getSightRadiusMod().computeEffective(3000f) * rMod;
                unionShader.addCircle(locPointer.getX(), locPointer.getY(), radius);
            }

            RTS_FBOManager.bindFBO(miniMapFBO, posRef);
            quadBuilder
                    .size(miniMapFBO.dimensions())
                    .pos(posRef.getX() + (dim.getX() / 2f), posRef.getY() + (dim.getY() / 2f))
                    .color(palette.fogOfWarBaseColor)
                    .filter(unionShader)
                        .pos(posRef)
                    .set()
                    .render();

            GL11.glColorMask(true, true, true, false);
            for (BattleObjectiveAPI obj: Global.getCombatEngine().getObjectives()) {
                quadBuilder
                        .sprite(objectiveIcons.getOrDefault(obj.getType(), nullObjective))
                        .pos(getVectorLoc(obj.getLocation()))
                        .size(0.6f)
                        .color(obj.getOwner() == 100
                                ? palette.objectiveNeutral
                                : obj.getOwner() == 1
                                ? palette.objectiveEnemy
                                : palette.objectiveAlly)
                        .push();
            }
            quadBuilder.render();
            GL11.glColorMask(true, true, true, true);

            RTS_FBOManager.unbindFBO();
            RTS_FBOManager.paintFBO(new RTS_PaintJob(
                    RTS_MiniMapRenderer.miniMapFBO,
                    posRef,
                    0
            ));
        }
    };

    private RTS_DrawCall POImarkers = new RTS_DrawCall() {
        RTS_DrawQuad.quadCall quadBuilder = new RTS_DrawQuad.quadCall();

        @Override
        public Integer zIndex() {
            return (layers.POIMarkers);
        }

        @Override
        public void call() {
            for (BattleObjectiveAPI obj: Global.getCombatEngine().getObjectives()) {
//                System.out.println(((BattleObjective)obj).getIconName());
                quadBuilder
                        .sprite(objectiveIcons.getOrDefault(obj.getType(), nullObjective))
                        .pos(getVectorLoc(obj.getLocation()))
                        .size(0.6f)
                        .alpha(0.5f)
                        .color(obj.getOwner() == 100
                                ? palette.objectiveNeutral
                                : obj.getOwner() == 1
                                ? palette.objectiveEnemy
                                : palette.objectiveAlly)
                        .push();
            }
            quadBuilder.render();
        }
    };

    private RTS_DrawCall rightClickMarker = new RTS_DrawCall() {
        RTS_DrawQuad.quadCall quadBuilder = new RTS_DrawQuad.quadCall();
        RTS_GenericDrawMeth.quadToCircleLineShader circleShader = new RTS_GenericDrawMeth.quadToCircleLineShader();
        Color coreColor = palette.RCMCore;
        Color fadeColor = palette.RCMBorder;

        @Override
        public Integer zIndex() {
            return (layers.rightClick);
        }

        @Override
        public void call() {
            for (Map.Entry<Integer, markerStore> entry : aniStore.entrySet()) {
                if (entry.getValue().aniCont.ID == null)
                    continue;
                this.drawMarker(entry.getValue().location, entry.getValue().aniCont.getCalculatedDelta());
            }
        }

        public void drawMarker (Vector2f location, float delta) {
            float size = 10f + (delta / 2f);
            float alpha = 1f;
            if (delta < 20f)
                alpha = delta / 20f;
            else if (delta > 80f)
                alpha = (100f - delta) / 20f;
            alpha = MathUtils.clamp(alpha, 0f, 1f);
            alpha = alpha - (0.7f * (delta / 100f));
            alpha = MathUtils.clamp(alpha, 0f, 1f);
            Color main = new Color(
                    coreColor.getRed(),
                    coreColor.getGreen(),
                    coreColor.getBlue(),
                    ((Float)(alpha * 255f)).intValue()
            );
            Color fade = new Color(
                    fadeColor.getRed(),
                    fadeColor.getGreen(),
                    fadeColor.getBlue(),
                    ((Float)(alpha * 255f)).intValue()
            );
            quadBuilder
                    .pos(location)
                    .size(size)
                    .color(main)
                    .filter(circleShader)
                        .thickness(Math.min(5f, size * (2f/10f)))
                        .fadeThickness(5f)
                        .colorFade(fade)
                        .fitVsEncircle(true)
                    .set()
                    .render();
        }
    };

    //------------------------------------------------------------------------------------------------------------------

    public void updateAnimationControllers () {
        for (Map.Entry<Integer, markerStore> entry : aniStore.entrySet()) {
            markerStore hold = entry.getValue();
            if (hold.queueAnimation) {
                hold.queueAnimation = false;
                hold.aniCont.reset();
                hold.aniCont.setPlay(true);
                animator.queueAnimation(hold.aniCont);
            }
            if (hold.removeAnimation) {
                hold.removeAnimation = false;
                animator.removeAnimation(hold.aniCont.ID);
            }
        }
    }

    private Vector2f getShipLocation(ShipAPI ship) {
        Vector2f location = new Vector2f();
        float battleW = Global.getCombatEngine().getMapWidth();
        float battleH = Global.getCombatEngine().getMapHeight();
        location.setX(
                  this.pos.getX()
                + this.dim.getX() / 2f
                + ((ship.getLocation().getX() / battleW) * this.dim.getX())
        );
        location.setY(
                  this.pos.getY()
                - this.dim.getY() / 2f
                + ((ship.getLocation().getY() / battleH) * this.dim.getY())
        );
        return (location);
    }

    private Vector2f getVectorLoc (Vector2f loc) {
        Vector2f location = new Vector2f();
        float battleW = Global.getCombatEngine().getMapWidth();
        float battleH = Global.getCombatEngine().getMapHeight();
        location.setX(
                this.pos.getX()
                        + this.dim.getX() / 2f
                        + ((loc.getX() / battleW) * this.dim.getX())
        );
        location.setY(
                this.pos.getY()
                        - this.dim.getY() / 2f
                        + ((loc.getY() / battleH) * this.dim.getY())
        );
        return (location);
    }

    private Float getShipIconSizeMod (ShipAPI ship) {
        float spriteW = ship.getSpriteAPI().getWidth();
        float spriteH = ship.getSpriteAPI().getHeight();
        float shipSize = this.iconSizes.get(ship.getHullSize().name());
        // prevents squarish ships from appearing too large
        float dimRat = Math.max(spriteW, spriteH) / Math.min(spriteW, spriteH);
        float dimRatMod = dimRat >= 1.2f ? 1f : 1f / (2.2f - dimRat);
        // ------------------------------------------------
        float largestFace = Math.max(spriteW, spriteH);
        return ((shipSize / (largestFace)) * dimRatMod * this.iconMod);
    }

    private void buildShipLists (RTS_Root.shipList listOfShips) {
        this.allShips = listOfShips.allShips;
        this.friendlyShips = listOfShips.friendlyShips;
        this.alliedShips = listOfShips.alliedShips;
        this.enemyShips = listOfShips.enemyShips;
        this.hulks = listOfShips.hulks;
        this.friendlyFighters = listOfShips.friendlyFighters;
        this.enemyFighters = listOfShips.enemyFighters;
        this.alliedFighters = listOfShips.alliedFighters;
    }

    public int registerMarker (Vector2f location) {
        int place = this.nextMarker;
        markerStore hold = this.aniStore.get(place);
        hold.queueAnimation = true;
        hold.location = location;
        this.nextMarker++;
        this.nextMarker = this.nextMarker == 5 ? 0 : this.nextMarker;
        return (place);
    }

    public void deregisterMarker (int ID) {
        this.aniStore.get(ID).removeAnimation = true;
    }

    //------------------------------------------------------------------------------------------------------------------
}
