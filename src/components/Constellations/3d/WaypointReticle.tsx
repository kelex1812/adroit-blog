/**
 * WaypointReticle — the pulsing cyan reticle ring + "NEXT · [course]" tag on
 * the frontier sector (deep-sky "Sky Roads", kara t_ea789325). The beacon that
 * tells the learner where to go next; the ring pulses gently (off for reduced
 * motion) and the tag stays billboarded above the node.
 */
"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { WaypointReticleProps } from "@/shared/contracts-galaxy";

export function WaypointReticle({
  sector,
  prefersReducedMotion = false,
}: WaypointReticleProps) {
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);

  // Pulse: scale 1→1.3 + opacity 0.8→0.2 (cyan), disabled for reduced motion.
  useFrame((state) => {
    const m = ring.current;
    const mat = ringMat.current;
    if (!m || !mat) return;
    const t = state.clock.elapsedTime;
    const pulse = prefersReducedMotion ? 0 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (1 / 1.8));
    m.scale.setScalar(1 + pulse * 0.35);
    mat.opacity = 0.75 - pulse * 0.55;
  });

  return (
    <group position={sector.position}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.5, 48]} />
        <meshBasicMaterial
          ref={ringMat}
          color="#22D3EE"
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <Html position={[0, 2.4, 0]} center style={{ pointerEvents: "none" }}>
        <span className="cx3d-waypoint-tag">
          <span className="cx3d-waypoint-tag-kicker">NEXT</span>
          <span className="cx3d-waypoint-tag-course">{sector.name}</span>
        </span>
      </Html>
    </group>
  );
}
