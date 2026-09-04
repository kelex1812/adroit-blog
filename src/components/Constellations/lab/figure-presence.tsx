/**
 * figure-presence.tsx — makes an asterism feel like a *place*, not a CAD diagram.
 *
 * Three layers, all in world space (no HTML labels):
 *
 *   1. Soft star auras — camera-facing additive discs under lit members
 *      (tight falloff — glow, not bokeh balloons).
 *   2. Luminous rails — dual additive strokes (wide veil + bright core).
 *   3. Mythic ghost — a billboard painted from the real star positions:
 *      thick glowing strokes + a soft filled wash. This is the 3D answer to
 *      "overlay what the constellation represents": the figure *is* the myth,
 *      as a luminous afterimage behind the stars — not a pasted PNG.
 */
"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { buildFigureLines, type FigureStar } from "./deep-field-model";

export interface FigurePresenceProps {
  stars: readonly FigureStar[];
  connections: ReadonlyArray<readonly [number, number]>;
  origin: [number, number, number];
  scale?: number;
  focused?: boolean;
  enabled?: boolean;
  figureName?: string;
}

function auraTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,248,230,0.55)");
  g.addColorStop(0.55, "rgba(180,200,255,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function buildGhostTexture(
  stars: readonly FigureStar[],
  connections: ReadonlyArray<readonly [number, number]>,
  figureName: string | undefined,
  seed: string,
): { map: THREE.CanvasTexture; width: number; height: number } | null {
  if (stars.length < 2 || typeof document === "undefined") return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of stars) {
    minX = Math.min(minX, s.position[0]);
    maxX = Math.max(maxX, s.position[0]);
    minY = Math.min(minY, s.position[1]);
    maxY = Math.max(maxY, s.position[1]);
  }
  const pad = 0.55;
  const spanX = Math.max(maxX - minX, 0.4) + pad * 2;
  const spanY = Math.max(maxY - minY, 0.4) + pad * 2;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const toPx = (x: number, y: number): [number, number] => {
    const u = (x - (minX - pad)) / spanX;
    const v = 1 - (y - (minY - pad)) / spanY;
    return [u * size, v * size];
  };

  ctx.clearRect(0, 0, size, size);

  const wash = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.48,
  );
  wash.addColorStop(0, "rgba(255, 236, 210, 0.26)");
  wash.addColorStop(0.45, "rgba(180, 200, 255, 0.12)");
  wash.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  const litConnections = connections.filter(([a, b]) => {
    const sa = stars[a];
    const sb = stars[b];
    return Boolean(sa && sb && (sa.lit || sb.lit));
  });

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(200, 220, 255, 0.18)";
  ctx.lineWidth = 30;
  ctx.beginPath();
  for (const [a, b] of litConnections) {
    const pa = toPx(stars[a]!.position[0], stars[a]!.position[1]);
    const pb = toPx(stars[b]!.position[0], stars[b]!.position[1]);
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 244, 220, 0.62)";
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(180, 210, 255, 0.85)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  for (const [a, b] of litConnections) {
    const pa = toPx(stars[a]!.position[0], stars[a]!.position[1]);
    const pb = toPx(stars[b]!.position[0], stars[b]!.position[1]);
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  for (const s of stars) {
    const [x, y] = toPx(s.position[0], s.position[1]);
    const r = s.lit ? 8 : 3.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, s.lit ? "rgba(255, 248, 230, 0.95)" : "rgba(180, 200, 230, 0.35)");
    g.addColorStop(0.35, s.lit ? "rgba(200, 220, 255, 0.4)" : "rgba(140, 160, 200, 0.1)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (figureName) {
    ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(230, 236, 255, 0.32)";
    ctx.textAlign = "center";
    ctx.fillText(figureName.toUpperCase(), size * 0.5, size * 0.92);
  }

  const img = ctx.getImageData(0, 0, size, size);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  for (let i = 0; i < img.data.length; i += 20) {
    h = (h * 1664525 + 1013904223) | 0;
    img.data[i] = Math.min(255, img.data[i]! + ((h >>> 8) & 7));
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  return {
    map,
    width: Math.max(spanX * 1.2, 1.3),
    height: Math.max(spanY * 1.2, 1.3),
  };
}

function SoftRails({
  stars,
  connections,
  origin,
  scale,
  focused,
}: {
  stars: readonly FigureStar[];
  connections: ReadonlyArray<readonly [number, number]>;
  origin: [number, number, number];
  scale: number;
  focused: boolean;
}) {
  const geom = useMemo(() => {
    const usable = connections.filter(([a, b]) => {
      const sa = stars[a];
      const sb = stars[b];
      return Boolean(sa && sb && (sa.lit || sb.lit));
    });
    return buildFigureLines(stars, usable, { origin, scale });
  }, [stars, connections, origin, scale]);

  if (geom.length < 6) return null;

  return (
    <group>
      <lineSegments renderOrder={12}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geom, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={focused ? "#c9d8ff" : "#7a8db0"}
          transparent
          opacity={focused ? 0.28 : 0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments renderOrder={13}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geom, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={focused ? "#fff4e0" : "#b8c6dc"}
          transparent
          opacity={focused ? 0.7 : 0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function StarAuras({
  stars,
  origin,
  scale,
  focused,
  map,
}: {
  stars: readonly FigureStar[];
  origin: [number, number, number];
  scale: number;
  focused: boolean;
  map: THREE.CanvasTexture;
}) {
  return (
    <group>
      {stars.map((s, i) => {
        const size = (s.lit ? 0.55 : 0.22) * scale * (focused ? 1.25 : 0.75);
        const color = s.isRedGiantAccent
          ? "#ff8a4a"
          : s.lit
            ? focused
              ? "#fff1d6"
              : "#d7e2ff"
            : "#6a7a96";
        return (
          <sprite
            key={`${s.name}-${i}`}
            position={[
              origin[0] + s.position[0] * scale,
              origin[1] + s.position[1] * scale,
              origin[2] + s.position[2] * scale,
            ]}
            scale={[size, size, 1]}
            renderOrder={14}
          >
            <spriteMaterial
              map={map}
              color={color}
              transparent
              opacity={focused ? (s.lit ? 0.85 : 0.28) : s.lit ? 0.4 : 0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        );
      })}
    </group>
  );
}

function MythicGhost({
  stars,
  connections,
  origin,
  scale,
  focused,
  figureName,
}: {
  stars: readonly FigureStar[];
  connections: ReadonlyArray<readonly [number, number]>;
  origin: [number, number, number];
  scale: number;
  focused: boolean;
  figureName?: string;
}) {
  const ghost = useMemo(
    () => buildGhostTexture(stars, connections, figureName, figureName ?? "fig"),
    [stars, connections, figureName],
  );

  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useLayoutEffect(() => {
    if (mat.current) mat.current.opacity = focused ? 0.75 : 0.14;
  }, [focused]);

  useFrame((_, dt) => {
    if (!mat.current) return;
    const target = focused ? 0.75 : 0.14;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, dt * 3.5);
  });

  if (!ghost) return null;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const s of stars) {
    cx += origin[0] + s.position[0] * scale;
    cy += origin[1] + s.position[1] * scale;
    cz += origin[2] + s.position[2] * scale;
  }
  const n = stars.length || 1;
  cx /= n;
  cy /= n;
  cz /= n;

  return (
    <Billboard position={[cx, cy, cz]} follow>
      <mesh renderOrder={11}>
        <planeGeometry args={[ghost.width * scale, ghost.height * scale]} />
        <meshBasicMaterial
          ref={mat}
          map={ghost.map}
          transparent
          opacity={focused ? 0.75 : 0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

export function FigurePresence({
  stars,
  connections,
  origin,
  scale = 1,
  focused = false,
  enabled = true,
  figureName,
}: FigurePresenceProps) {
  const map = useMemo(() => {
    if (typeof document === "undefined") return null;
    return auraTexture();
  }, []);

  if (!enabled || stars.length === 0 || !map) return null;

  return (
    <group>
      <MythicGhost
        stars={stars}
        connections={connections}
        origin={origin}
        scale={scale}
        focused={focused}
        figureName={figureName}
      />
      <SoftRails
        stars={stars}
        connections={connections}
        origin={origin}
        scale={scale}
        focused={focused}
      />
      <StarAuras
        stars={stars}
        origin={origin}
        scale={scale}
        focused={focused}
        map={map}
      />
    </group>
  );
}

export default FigurePresence;
