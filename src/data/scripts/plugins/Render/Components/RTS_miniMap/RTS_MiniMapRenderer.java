/*
  **********************************************************************************************************
  * RTSAssist version 0.2.11exp
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
import data.scripts.plugins.Render.RTS_drawManager.*;
import data.scripts.plugins.Render.RTS_drawManager.RTS_animator.RTS_AnimationController;
import data.scripts.plugins.Render.RTS_drawManager.RTS_animator.RTS_Animator;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_BoundTexture;
import data.scripts.plugins.Render.JXDOM.Props.*;
import data.scripts.plugins.Render.RTS_RenderManager;
import data.scripts.plugins.Render.RTS_Root;
import org.lwjgl.util.vector.Vector2f;

import java.awt.*;
import java.util.*;
import java.util.List;

import org.lwjgl.opengl.GL11;

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
        /* Vanilla command-page colours, from starsector-core/data/config/settings.json:
         *   iconFriendColor [0,255,0]  iconEnemyColor [255,0,0]  iconNeutralShipColor [75,75,75].
         * Allies have no vanilla key; the gold matches the vanilla ally look. */
        public static Color friendly = new Color(0, 255, 0, 235);
        public static Color enemy = new Color(255, 0, 0, 235);
        public static Color allied = new Color(226, 196, 70, 235);
        public static Color neutral = new Color(75, 75, 75, 255);
        public static Color viewPortLine = new Color(255, 255, 255, 255);
        public static Color RCMCore = new Color(113, 234, 14, 255);
        public static Color RCMBorder = new Color(2, 255, 255, 132);
    }
    public static final class layers {
        public static int miniMap = RTS_RenderManager.ziNames.UIBase;
        public static int viewPortBox = miniMap + 7;
        public static int rightClick = miniMap + 8;
    }
    private static final HashMap<String, Float> iconSizes = new HashMap<>() {{
        put("FRIGATE", 14f);
        put("DESTROYER", 19f);
        put("CRUISER", 27f);
        put("CAPITAL_SHIP", 42f);
    }};
    private static final float fighterIconSize = 7f;
    /* Velocity lines: pixels of length per (su/s), relative to the minimap width. Fighters fly
     * much faster, so their scale is cut down to keep the map readable. */
    private static final float shipSpeedLineScale = 0.10f / 250f;
    private static final float fighterSpeedLineScale = shipSpeedLineScale * 0.45f;
    private static final float speedLineMaxLenMod = 0.16f;
    private static final float shipLineThickness = 2f;
    private static final float fighterLineThickness = 1.2f;
    private static final float rightClickMarkerDuration = 0.4f;

    /* Radar sweep presentation. Each refresh cycle is split in two phases: ships are re-swept
     * during the first half, fighters during the second. Units are swept one by one in a fresh
     * random order every cycle; a sweep hit flashes (brighten + ring), then the unit decays
     * towards a dim floor until its next sweep. */
    private static final float sweepPhaseSplit = 0.5f;      // ships [0,split), fighters [split,1)
    private static final float sweepFloor = 0.25f;          // dimmest state between sweeps
    private static final float sweepTauFactor = 0.55f;      // decay constant, x cycle duration
    private static final float sweepFlashDurFactor = 0.8f;  // flash duration, x phase duration
    private static final float sweepFlashWhiteness = 0.75f; // how far the flash pushes towards white
    private static final float sweepRingGrow = 1.9f;        // ring end radius, x unit icon size
    private static final float sweepRingAlpha = 0.55f;

    private RTS_DrawManager drawManager;
    public RTS_Animator animator;
    /* Data refresh cadence in ms; one sweep cycle equals one refresh. Set from RTS_Root. */
    public float refreshMs = 200f;
    private long cycleStart = 0;
    private boolean cycleValid = false;
    private boolean firstCycle = true;

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

    /* Data snapshot taken once per cycle; the sweep animates over this frozen frame of data. */
    private static final class Blip {
        final Vector2f loc = new Vector2f();
        final Vector2f vel = new Vector2f();
        float facing;
        float size;
        float thickness;
        float lineScale;
        Color color;
        float sweepOffset; // 0..1 position within its phase, in sweep order
    }
    private final ArrayList<Blip> shipBlips = new ArrayList<>();
    private final ArrayList<Blip> fighterBlips = new ArrayList<>();

    //------------------------------------------------------------------------------------------------------------------

    public void render(
            RTS_Root.camera camera,
            RTS_Root.shipList listOfShips,
            HashMap<Integer, RTS_BoundTexture> marginedShipSprites
    ) {
        if (disabled || !this.init)
            return;
        this.updateAnimationControllers();
        this.drawManager.registerDrawCall(this.sweepLayerCall);
        this.drawManager.registerDrawCall(this.viewPortBox);
        this.drawManager.registerDrawCall(this.rightClickMarker);
    }

    protected void update (HashMap<String, Object> props, Map<String, Object> rawProps) {
        this.disabled = (boolean)props.get(RTS_P_Inert.ID());
        this.opacity = (float)props.get(RTS_P_Opacity.ID());
        this.pos.set((float)props.get(RTS_P_Left.ID()), RTS_Root.screenDim.getY() - (float)props.get(RTS_P_Top.ID()));
        this.dim.set((float)props.get(RTS_P_Width.ID()), (float)props.get(RTS_P_Height.ID()));
        this.posRef.set(this.pos.getX(), this.pos.getY() - this.dim.getY());
        this.init = true;
    }

    //------------------------------------------------------------------------------------------------------------------

    /* Per frame: advance the sweep cycle, take a data snapshot at each cycle boundary and draw
     * every unit at a brightness driven by the time since its last sweep hit. */
    private RTS_DrawCall sweepLayerCall = new RTS_DrawCall() {
        @Override
        public Integer zIndex() {
            return (layers.miniMap);
        }

        @Override
        public void call() {
            long now = System.currentTimeMillis();
            long cycleMs = (long)refreshMs;
            if (!cycleValid || now - cycleStart >= cycleMs) {
                if (cycleValid && RTS_MiniMapRenderer.this.firstCycle)
                    RTS_MiniMapRenderer.this.firstCycle = false;
                cycleStart = now;
                cycleValid = true;
                snapshot();
            }
            drawSweep(now, cycleMs);
        }
    };

    private void snapshot () {
        this.shipBlips.clear();
        this.fighterBlips.clear();
        CombatEngineAPI eng = Global.getCombatEngine();
        float battleW = eng.getMapWidth();
        float battleH = eng.getMapHeight();
        for (ShipAPI ship : eng.getShips()) {
            if (ship.isShuttlePod() || ship.getHullSize() == null || ship.getOriginalOwner() == 100)
                continue;
            boolean fighter = !ship.isHulk() && (ship.getHullSize().name().equals("FIGHTER") || ship.isFighter());
            Color color;
            if (fighter)
                color = ship.isAlly() ? palette.allied : ship.getOriginalOwner() == 0 ? palette.friendly : palette.enemy;
            else if (ship.isAlly())
                color = palette.allied;
            else if (ship.getOriginalOwner() == 0)
                color = palette.friendly;
            else if (ship.getOriginalOwner() == 1)
                color = palette.enemy;
            else
                continue;
            Blip blip = new Blip();
            blip.loc.set(toMapX(ship.getLocation().getX(), battleW), toMapY(ship.getLocation().getY(), battleH));
            blip.vel.set(ship.getVelocity().getX(), ship.getVelocity().getY());
            blip.facing = ship.getFacing();
            blip.size = fighter ? fighterIconSize : getShipIconSize(ship);
            blip.thickness = fighter ? fighterLineThickness : shipLineThickness;
            blip.lineScale = fighter ? fighterSpeedLineScale : shipSpeedLineScale;
            blip.color = color;
            if (fighter)
                this.fighterBlips.add(blip);
            else
                this.shipBlips.add(blip);
        }
        assignSweepOffsets(this.shipBlips);
        assignSweepOffsets(this.fighterBlips);
    }

    /* Fresh random sweep order every cycle; sweepOffset positions each hit within its phase. */
    private void assignSweepOffsets (ArrayList<Blip> blips) {
        int n = blips.size();
        Integer[] order = new Integer[n];
        for (int i = 0; i < n; i++)
            order[i] = i;
        Collections.shuffle(Arrays.asList(order));
        for (int i = 0; i < n; i++)
            blips.get(order[i]).sweepOffset = n <= 1 ? 0f : (float)i / (float)n;
    }

    private void drawSweep (long now, long cycleMs) {
        GL11.glEnable(GL11.GL_BLEND);
        GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        GL11.glDisable(GL11.GL_TEXTURE_2D);

        drawSweepGroup(this.shipBlips, now, cycleMs, 0f);
        drawSweepGroup(this.fighterBlips, now, cycleMs, sweepPhaseSplit);

        drawObjectives();
        GL11.glEnable(GL11.GL_TEXTURE_2D);
    }

    private void drawSweepGroup (ArrayList<Blip> blips, long now, long cycleMs, float phaseStart) {
        if (blips.isEmpty())
            return;
        long phaseMs = (long)(cycleMs * sweepPhaseSplit);
        long flashDur = (long)(phaseMs * sweepFlashDurFactor);
        float tau = cycleMs * sweepTauFactor;
        for (Blip blip : blips) {
            long sweptAt = cycleStart
                    + (long)((phaseStart + blip.sweepOffset * sweepPhaseSplit) * cycleMs);
            long sinceSweep = now - sweptAt;
            boolean notYetSwept = sinceSweep < 0;
            /* Not hit yet this cycle: still showing last cycle's pass, further decayed. */
            if (notYetSwept)
                sinceSweep += cycleMs;
            /* First cycle: units that have not been swept yet have never existed. */
            if (this.firstCycle && notYetSwept)
                continue;
            float bright = sweepFloor
                    + (1f - sweepFloor) * (float)Math.exp(-sinceSweep / tau);
            float glowK = notYetSwept ? 0f : 1f - (float)sinceSweep / (float)flashDur;
            if (glowK < 0f)
                glowK = 0f;

            Color c = sweepColor(blip.color, bright, glowK);
            float thickness = blip.thickness * (1f + 0.8f * glowK);
            drawTriangle(blip.loc, blip.facing, blip.size, thickness, c);
            drawVelocityLine(blip, c);
            if (glowK > 0f)
                drawFlashRing(blip, glowK, c);
        }
    }

    /* Blend the base colour towards white and scale alpha by the sweep brightness. */
    private Color sweepColor (Color base, float bright, float glowK) {
        float whiten = sweepFlashWhiteness * glowK;
        int r = base.getRed() + ((int)((255 - base.getRed()) * whiten));
        int g = base.getGreen() + ((int)((255 - base.getGreen()) * whiten));
        int b = base.getBlue() + ((int)((255 - base.getBlue()) * whiten));
        int a = (int)(base.getAlpha() * this.opacity * bright);
        return (new Color(r, g, b, Math.min(a, 255)));
    }

    private void drawTriangle (Vector2f centre, float facingDeg, float size, float thickness, Color color) {
        double rad = Math.toRadians(facingDeg);
        double nose = size * 0.62;
        double tail = size * 0.38;
        double halfW = size * 0.48;
        float nx = centre.getX() + ((float)(Math.cos(rad) * nose));
        float ny = centre.getY() + ((float)(Math.sin(rad) * nose));
        float tx = centre.getX() - ((float)(Math.cos(rad) * tail));
        float ty = centre.getY() - ((float)(Math.sin(rad) * tail));
        float px = -((float)Math.sin(rad));
        float py = ((float)Math.cos(rad));
        drawSegment(
                new Vector2f(nx, ny),
                new Vector2f(tx + px * (float)halfW, ty + py * (float)halfW),
                thickness, color
        );
        drawSegment(
                new Vector2f(tx + px * (float)halfW, ty + py * (float)halfW),
                new Vector2f(tx - px * (float)halfW, ty - py * (float)halfW),
                thickness, color
        );
        drawSegment(
                new Vector2f(tx - px * (float)halfW, ty - py * (float)halfW),
                new Vector2f(nx, ny),
                thickness, color
        );
    }

    private void drawVelocityLine (Blip blip, Color color) {
        Vector2f vel = blip.vel;
        float speed = (float)Math.sqrt(vel.getX() * vel.getX() + vel.getY() * vel.getY());
        if (speed < 1f)
            return;
        float len = Math.min(speed * blip.lineScale * dim.getX(), dim.getX() * speedLineMaxLenMod);
        if (len < 1.5f)
            return;
        drawSegment(
                blip.loc,
                new Vector2f(
                        blip.loc.getX() + (vel.getX() / speed) * len,
                        blip.loc.getY() + (vel.getY() / speed) * len
                ),
                blip.thickness, color
        );
    }

    private final RTS_DrawQuad.quadCall ringQuad = new RTS_DrawQuad.quadCall();
    private final RTS_GenericDrawMeth.quadToCircleLineShader ringShader = new RTS_GenericDrawMeth.quadToCircleLineShader();

    /* Expanding fading ring on the unit that has just been swept. */
    private void drawFlashRing (Blip blip, float glowK, Color color) {
        float k = 1f - glowK; // 0 at flash start -> 1 at end
        float ringSize = blip.size * (0.8f + sweepRingGrow * k);
        int alpha = (int)(255 * sweepRingAlpha * glowK * this.opacity);
        Color ring = new Color(color.getRed(), color.getGreen(), color.getBlue(), alpha);
        Color ringFade = new Color(ring.getRed(), ring.getGreen(), ring.getBlue(), alpha / 3);
        ringQuad
                .pos(blip.loc)
                .size(ringSize)
                .color(ring)
                .filter(ringShader)
                    .thickness(Math.max(1.5f, ringSize * 0.18f))
                    .fadeThickness(3f)
                    .colorFade(ringFade)
                    .fitVsEncircle(true)
                .set()
                .render();
    }

    /* Objectives as small hollow diamonds, tinted by owner like the vanilla command page.
     * Deliberately outside the sweep: constant, quiet reference points. */
    private void drawObjectives () {
        float size = 9f;
        float thickness = 1.4f;
        for (BattleObjectiveAPI obj : Global.getCombatEngine().getObjectives()) {
            Color color = obj.getOwner() == 100
                    ? palette.neutral
                    : obj.getOwner() == 1
                    ? palette.enemy
                    : palette.friendly;
            color = new Color(
                    color.getRed(),
                    color.getGreen(),
                    color.getBlue(),
                    ((Float)(color.getAlpha() * opacity * 0.55f)).intValue()
            );
            Vector2f loc = getVectorLoc(obj.getLocation());
            drawSegment(new Vector2f(loc.getX(), loc.getY() + size), new Vector2f(loc.getX() + size, loc.getY()), thickness, color);
            drawSegment(new Vector2f(loc.getX() + size, loc.getY()), new Vector2f(loc.getX(), loc.getY() - size), thickness, color);
            drawSegment(new Vector2f(loc.getX(), loc.getY() - size), new Vector2f(loc.getX() - size, loc.getY()), thickness, color);
            drawSegment(new Vector2f(loc.getX() - size, loc.getY()), new Vector2f(loc.getX(), loc.getY() + size), thickness, color);
        }
    }

    /* Thin quad between two points; quad-based so the width is not capped by glLineWidth. */
    private void drawSegment (Vector2f from, Vector2f to, float thickness, Color color) {
        float dx = to.getX() - from.getX();
        float dy = to.getY() - from.getY();
        float len = (float)Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01f)
            return;
        float nx = (-dy / len) * (thickness / 2f);
        float ny = (dx / len) * (thickness / 2f);
        GL11.glBegin(GL11.GL_QUADS);
        GL11.glColor4ub(
                (byte)color.getRed(),
                (byte)color.getGreen(),
                (byte)color.getBlue(),
                (byte)color.getAlpha()
        );
        GL11.glVertex2f(from.getX() + nx, from.getY() + ny);
        GL11.glVertex2f(to.getX() + nx, to.getY() + ny);
        GL11.glVertex2f(to.getX() - nx, to.getY() - ny);
        GL11.glVertex2f(from.getX() - nx, from.getY() - ny);
        GL11.glEnd();
    }

    private RTS_DrawCall viewPortBox = new RTS_DrawCall() {

        @Override
        public Integer zIndex() {
            return (layers.viewPortBox);
        }

        @Override
        public void call() {
            if (!RTS_MiniMapRenderer.this.camera.init)
                return;
            RTS_GenericDrawMeth.viewPortBoxOutline_LEGACY(
                    new RTS_GenericDrawMeth.quadRec(
                            this.getCameraLocation(RTS_MiniMapRenderer.this.camera.pos, RTS_MiniMapRenderer.this.camera.visableDim),
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
            alpha = clamp(alpha, 0f, 1f);
            alpha = alpha - (0.7f * (delta / 100f));
            alpha = clamp(alpha, 0f, 1f);
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

    private static float clamp (float value, float min, float max) {
        return (value < min ? min : value > max ? max : value);
    }

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
        if (this.cycleValid)
            this.firstCycle = false;
    }

    public RTS_Root.camera camera;

    private float toMapX (float worldX, float battleW) {
        return (this.pos.getX() + this.dim.getX() / 2f + ((worldX / battleW) * this.dim.getX()));
    }

    private float toMapY (float worldY, float battleH) {
        return (this.pos.getY() - this.dim.getY() / 2f + ((worldY / battleH) * this.dim.getY()));
    }

    private Vector2f getVectorLoc (Vector2f loc) {
        float battleW = Global.getCombatEngine().getMapWidth();
        float battleH = Global.getCombatEngine().getMapHeight();
        return (new Vector2f(toMapX(loc.getX(), battleW), toMapY(loc.getY(), battleH)));
    }

    private Float getShipIconSize (ShipAPI ship) {
        return (this.iconSizes.get(ship.getHullSize().name()));
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
