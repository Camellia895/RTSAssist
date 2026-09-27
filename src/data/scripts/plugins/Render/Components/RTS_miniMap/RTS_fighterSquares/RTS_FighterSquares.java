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

package data.scripts.plugins.Render.Components.RTS_miniMap.RTS_fighterSquares;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.ShipAPI;
import data.scripts.plugins.Render.Components.RTS_miniMap.RTS_MiniMapRenderer;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_FBO;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_FBOManager;
import data.scripts.plugins.Render.RTS_drawManager.RTS_FBO.RTS_PaintJob;
import data.scripts.plugins.Render.RTS_drawManager.RTS_GenericDrawMeth;
import data.scripts.plugins.Render.RTS_drawManager.RTS_ShaderManager;
import data.scripts.plugins.Utils.RTS_StatefulClasses;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL20;
import org.lwjgl.util.vector.Vector2f;
import org.lwjgl.util.vector.Vector4f;

import java.awt.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.lwjgl.opengl.GL11.GL_BLEND;

public class RTS_FighterSquares {

    public RTS_FighterSquares () {
        this.fiFBO = RTS_MiniMapRenderer.miniMapFBO;
    }

    public static class shNames {
        public static String fighterPostOutlineProgram = RTS_StatefulClasses.getUniqueIdentifier();
        public static String fighterPreOutlineProgram = RTS_StatefulClasses.getUniqueIdentifier();
    }

    private static HashMap<String, RTS_ShaderManager.shaderInfo> rawShaderStore = new HashMap<>() {{
        put(RTS_FighterSquares.shNames.fighterPostOutlineProgram, new RTS_ShaderManager.shaderInfo(
                "data/shaders/passCoOrd.vert",
                "data/shaders/fighterSquarePostShader.frag"
        ));
        put(RTS_FighterSquares.shNames.fighterPreOutlineProgram, new RTS_ShaderManager.shaderInfo(
                "data/shaders/passCoOrd.vert",
                "data/shaders/fighterSquarePreShader.frag"
        ));
    }};

    static {
        for (Map.Entry<String, RTS_ShaderManager.shaderInfo> entry : RTS_FighterSquares.rawShaderStore.entrySet())
            RTS_ShaderManager.loadProgram_LEGACY(entry.getKey(), entry.getValue());
    }

    private float fighterBlockSizediv2;
    private float fighterOpacity;
    private Vector2f pos;
    private Vector2f dim;

    private List<ShipAPI> friendlyFighters;
    private List<ShipAPI> enemyFighters;
    private List<ShipAPI> alliedFighters;

    private class varHold {
        Vector4f frColor255 = new Vector4f();
        Vector4f alColor255 = new Vector4f();;
        Vector4f enColor255 = new Vector4f();;
        float x;
        float y;
        float wh;
        Vector2f posRev = new Vector2f();
        Vector2f shipMinimapLoc = new Vector2f();
    }
    private varHold vh = new varHold();

    private RTS_FBO fiFBO;

    public void set (
            Vector2f pos,
            Vector2f dim,
            float alphaMult,
            float fighterOpacity,
            float fighterBlockSizediv2,
            List<ShipAPI> friendlyFighters,
            List<ShipAPI> enemyFighters,
            List<ShipAPI> alliedFighters
    ) {
        this.pos = pos;
        this.dim = dim;
        this.fighterOpacity = fighterOpacity;
        this.fighterBlockSizediv2 = fighterBlockSizediv2;
        this.friendlyFighters = friendlyFighters;
        this.enemyFighters = enemyFighters;
        this.alliedFighters = alliedFighters;
    }

    public void drawFighterSquaresFar () {
        RTS_FBOManager.bindFBO(this.fiFBO);

        GL11.glEnable(GL_BLEND);
        GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        GL11.glDisable(GL11.GL_TEXTURE_2D);
        RTS_GenericDrawMeth.unbindTexture();
        this.initFighterQuadOutPrelineShader();

        this.vh.frColor255.set(
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getRed() / 255f,
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getGreen() / 255f,
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getBlue() / 255f,
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getAlpha() / 255f
        );
        this.vh.alColor255.set(
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getRed() / 255f,
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getGreen() / 255f,
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getBlue() / 255f,
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getAlpha() / 255f
        );
        this.vh.enColor255.set(
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getRed() / 255f,
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getGreen() / 255f,
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getBlue() / 255f,
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getAlpha() / 255f
        );

        this.vh.wh = this.fighterBlockSizediv2 * 1.05f;
        this.vh.posRev.set(this.pos.getX(), this.pos.getY() - this.dim.getY());

        GL11.glBegin(GL11.GL_QUADS);
        for (ShipAPI fighter : friendlyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.frColor255.getX(),
                    this.vh.frColor255.getY(),
                    this.vh.frColor255.getZ(),
                    this.vh.frColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : enemyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.enColor255.getX(),
                    this.vh.enColor255.getY(),
                    this.vh.enColor255.getZ(),
                    this.vh.enColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : alliedFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.alColor255.getX(),
                    this.vh.alColor255.getY(),
                    this.vh.alColor255.getZ(),
                    this.vh.alColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        GL11.glEnd();

        this.vh.wh = this.fighterBlockSizediv2;
        RTS_ShaderManager.clearProgram();

        GL11.glBegin(GL11.GL_QUADS);
        for (ShipAPI fighter : friendlyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.frColor255.getX(),
                    this.vh.frColor255.getY(),
                    this.vh.frColor255.getZ(),
                    this.vh.frColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : enemyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.enColor255.getX(),
                    this.vh.enColor255.getY(),
                    this.vh.enColor255.getZ(),
                    this.vh.enColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x +this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : alliedFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.alColor255.getX(),
                    this.vh.alColor255.getY(),
                    this.vh.alColor255.getZ(),
                    this.vh.alColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y -this.vh. wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        GL11.glEnd();
        RTS_FBOManager.unbindFBO();

        this.initFighterQuadOutPostlineShader(RTS_MiniMapRenderer.palette.fighterQuadOutline, 3f, 1f);
        RTS_FBOManager.paintFBO(new RTS_PaintJob(
                this.fiFBO,
                this.vh.posRev,
                null
        ));
    }

    public void drawFighterSquaresClose () {
        RTS_FBOManager.bindFBO(this.fiFBO);
        GL11.glEnable(GL_BLEND);
        GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        RTS_GenericDrawMeth.unbindTexture();
        GL11.glBindTexture(GL11.GL_TEXTURE_2D,0);
        this.initFighterQuadOutPrelineShader();

        this.vh.frColor255.set(
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getRed() / 255f,
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getGreen() / 255f,
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getBlue() / 255f,
                RTS_MiniMapRenderer.palette.friendlyFighterQuad.getAlpha() / 255f
        );
        this.vh.alColor255.set(
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getRed() / 255f,
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getGreen() / 255f,
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getBlue() / 255f,
                RTS_MiniMapRenderer.palette.aliiedFighterQuad.getAlpha() / 255f
        );
        this.vh.enColor255.set(
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getRed() / 255f,
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getGreen() / 255f,
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getBlue() / 255f,
                RTS_MiniMapRenderer.palette.enemyFighterQuad.getAlpha() / 255f
        );

        this.vh.wh = this.fighterBlockSizediv2 * 1.05f;
        this.vh.posRev.set(this.pos.getX(), this.pos.getY() - this.dim.getY());

        GL11.glBegin(GL11.GL_QUADS);
        for (ShipAPI fighter : friendlyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.frColor255.getX(),
                    this.vh.frColor255.getY(),
                    this.vh.frColor255.getZ(),
                    this.vh.frColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : enemyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.enColor255.getX(),
                    this.vh.enColor255.getY(),
                    this.vh.enColor255.getZ(),
                    this.vh.enColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : alliedFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.alColor255.getX(),
                    this.vh.alColor255.getY(),
                    this.vh.alColor255.getZ(),
                    this.vh.alColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        GL11.glEnd();

        this.vh.wh = this.fighterBlockSizediv2;
        RTS_ShaderManager.clearProgram();

        GL11.glBegin(GL11.GL_QUADS);
        for (ShipAPI fighter : friendlyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.frColor255.getX(),
                    this.vh.frColor255.getY(),
                    this.vh.frColor255.getZ(),
                    this.vh.frColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : enemyFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.enColor255.getX(),
                    this.vh.enColor255.getY(),
                    this.vh.enColor255.getZ(),
                    this.vh.enColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        for (ShipAPI fighter : alliedFighters) {
            this.vh.shipMinimapLoc = this.getShipLocation(fighter);
            this.vh.x = this.vh.shipMinimapLoc.getX() - this.vh.posRev.getX();
            this.vh.y = this.vh.shipMinimapLoc.getY() - this.vh.posRev.getY();
            GL11.glColor4f(
                    this.vh.alColor255.getX(),
                    this.vh.alColor255.getY(),
                    this.vh.alColor255.getZ(),
                    this.vh.alColor255.getW()
            );
            GL11.glTexCoord2f(0.0f, 0.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 0.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y - this.vh.wh);
            GL11.glTexCoord2f(1.0f, 1.0f);
            GL11.glVertex2f(this.vh.x + this.vh.wh, this.vh.y + this.vh.wh);
            GL11.glTexCoord2f(0.0f, 1.0f);
            GL11.glVertex2f(this.vh.x - this.vh.wh, this.vh.y + this.vh.wh);
        }
        GL11.glEnd();
        RTS_FBOManager.unbindFBO();
        RTS_FBOManager.paintFBO(new RTS_PaintJob(
                this.fiFBO,
                this.vh.posRev,
                0,
                new Color(1f,1f,1f, this.fighterOpacity)
        ));
    }

    private void initFighterQuadOutPostlineShader (Color outlineColor, float lineThickness, float opacity) {
        int programID = RTS_ShaderManager.getProgram(RTS_FighterSquares.shNames.fighterPostOutlineProgram);
        RTS_ShaderManager.useProgram(programID);
        int colorLoc = GL20.glGetUniformLocation(programID, "outlineColor");
        GL20.glUniform4f(
                colorLoc,
                outlineColor.getRed()/255f,
                outlineColor.getGreen()/255f,
                outlineColor.getBlue()/255f,
                outlineColor.getAlpha()/255f
        );
        int thicknessLoc = GL20.glGetUniformLocation(programID, "lineThickness");
        GL20.glUniform1f(
                thicknessLoc,
                lineThickness
        );
        int opacityLoc = GL20.glGetUniformLocation(programID, "opacity");
        GL20.glUniform1f(
                opacityLoc,
                opacity
        );
    }

    private void initFighterQuadOutPrelineShader () {
        int programID = RTS_ShaderManager.getProgram(RTS_FighterSquares.shNames.fighterPreOutlineProgram);
        RTS_ShaderManager.useProgram(programID);
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

    public void rebuildShaders () {
        for (Map.Entry<String, RTS_ShaderManager.shaderInfo> entry : RTS_FighterSquares.rawShaderStore.entrySet())
            RTS_ShaderManager.loadProgram_LEGACY(entry.getKey(), entry.getValue());
    }
}
