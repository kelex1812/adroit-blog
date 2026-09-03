/**
 * meteors.tsx — shooting stars (deep-sky v1.2.0, AC-3).
 *
 * Occasionally a meteor streaks down across the field: a single additive line
 * whose head advances and fades in/out over ~0.7–1.3s, then waits for a random
 * gap before the next one. One declaratively-declared THREE.Line whose 2-vertex
 * geometry is mutated per frame (exactly the demo's approach — cheap, no DOM
 * churn). Visibility is governed purely by material opacity (never toggling the
 * line's .visible, which keeps the JSX ref-free like the scene's figure lines).
 * Reduced motion disables meteors entirely.
 */
"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface MeteorsProps {
  /** Disable spawning + animation (prefers-reduced-motion). */
  staticMode?: boolean;
  /** Master opacity ceiling. */
  opacity?: number;
}

interface MeteorState {
  active: boolean;
  life: number;
  dur: number;
  nextSpawn: number;
  start: THREE.Vector3;
  delta: THREE.Vector3;
}

/** Hidden trailing tail behind the head, as a fraction of total length. */
const TAIL = 0.4;

export function Meteors({ staticMode = false, opacity = 0.9 }: MeteorsProps) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const stateRef = useRef<MeteorState>({
    active: false,
    life: 0,
    dur: 1,
    nextSpawn: 2.5,
    start: new THREE.Vector3(),
    delta: new THREE.Vector3(),
  });

  useFrame((state) => {
    const mat = matRef.current;
    const geo = geoRef.current;
    const s = stateRef.current;
    if (!mat || !geo) return;

    if (staticMode) {
      mat.opacity = 0;
      return;
    }

    const t = state.clock.elapsedTime;

    if (!s.active) {
      if (t >= s.nextSpawn) {
        // Spawn a meteor high in the sky streaking downward.
        const sx = (Math.random() - 0.5) * 16;
        const sy = 6 + Math.random() * 6;
        const sz = -8 - Math.random() * 8;
        const len = 2.5 + Math.random() * 3;
        const dx = (Math.random() - 0.5) * 0.8;
        const dy = -0.6 - Math.random() * 0.4;
        const dz = (Math.random() - 0.5) * 0.5;
        s.start.set(sx, sy, sz);
        s.delta.set(dx, dy, dz).multiplyScalar(len);
        s.life = 0;
        s.dur = 0.7 + Math.random() * 0.6;
        s.active = true;
        s.nextSpawn = t + 2.5 + Math.random() * 3;
      } else {
        mat.opacity = 0;
        return;
      }
    }

    s.life += state.clock.getDelta();
    const p = Math.min(s.life / s.dur, 1);
    const fade = p < 0.15 ? p / 0.15 : 1 - p; // brighten in, fade out
    mat.opacity = Math.max(0, fade) * opacity;

    const pos = geo.attributes.position.array as Float32Array;
    const x = s.start.x + s.delta.x * p;
    const y = s.start.y + s.delta.y * p;
    const z = s.start.z + s.delta.z * p;
    pos[0] = x;
    pos[1] = y;
    pos[2] = z;
    // Tail trails behind the head along the trajectory.
    pos[3] = x - s.delta.x * TAIL;
    pos[4] = y - s.delta.y * TAIL;
    pos[5] = z - s.delta.z * TAIL;
    geo.attributes.position.needsUpdate = true;

    if (p >= 1) {
      s.active = false;
      mat.opacity = 0;
    }
  });

  return (
    <line>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(6), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        color={0xffffff}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  );
}
