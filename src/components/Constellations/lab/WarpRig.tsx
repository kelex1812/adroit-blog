/**
 * WarpRig.tsx — framed ↔ observatory camera for the Hubble Field lab.
 *
 * Driving an r3f camera means imperatively mutating the `THREE.Camera` that
 * `useThree` hands back, and holding animation state in refs that OrbitControls
 * reads by identity. `react-hooks/immutability` and `react-hooks/refs` both
 * flag that as unsafe; here it is the supported pattern, and the alternative —
 * routing per-frame camera state through React — would re-render the scene
 * every frame. Disabled file-wide rather than at five separate call sites.
 */
/* eslint-disable react-hooks/immutability, react-hooks/refs */
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export type WarpMode = "framed" | "observatory" | "warping-in" | "warping-out";

export interface WarpRigProps {
  mode: WarpMode;
  onSettled?: (mode: "framed" | "observatory") => void;
  prefersReducedMotion?: boolean;
  lookAt?: [number, number, number];
}

const FRAMED_POS = new THREE.Vector3(0, 0.4, 11);
const OBS_POS = new THREE.Vector3(0, 1.2, 6.5);
const FOV_FRAMED = 42;
const FOV_OBS = 55;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function WarpRig({
  mode,
  onSettled,
  prefersReducedMotion = false,
  lookAt = [0, 0, 0],
}: WarpRigProps) {
  const camera = useThree((s) => s.camera);
  const progress = useRef(1);
  const fromPos = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const fromFov = useRef(FOV_FRAMED);
  const toFov = useRef(FOV_FRAMED);
  const lastMode = useRef<WarpMode>(mode);
  const look = useRef(new THREE.Vector3(...lookAt));

  useEffect(() => {
    look.current.set(...lookAt);
  }, [lookAt]);

  useEffect(() => {
    if (mode === lastMode.current) return;
    const prev = lastMode.current;
    lastMode.current = mode;
    const cam = camera as THREE.PerspectiveCamera;

    if (prefersReducedMotion) {
      if (mode === "observatory" || mode === "warping-in") {
        cam.position.copy(OBS_POS);
        cam.fov = FOV_OBS;
        cam.updateProjectionMatrix();
        onSettled?.("observatory");
      } else if (mode === "framed" || mode === "warping-out") {
        cam.position.copy(FRAMED_POS);
        cam.fov = FOV_FRAMED;
        cam.updateProjectionMatrix();
        onSettled?.("framed");
      }
      return;
    }

    if (mode === "warping-in" || (mode === "observatory" && prev === "framed")) {
      fromPos.current.copy(cam.position);
      toPos.current.copy(OBS_POS);
      fromFov.current = cam.fov;
      toFov.current = FOV_OBS;
      progress.current = 0;
    } else if (
      mode === "warping-out" ||
      (mode === "framed" && (prev === "observatory" || prev === "warping-in"))
    ) {
      fromPos.current.copy(cam.position);
      toPos.current.copy(FRAMED_POS);
      fromFov.current = cam.fov;
      toFov.current = FOV_FRAMED;
      progress.current = 0;
    }
  }, [mode, camera, prefersReducedMotion, onSettled]);

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const warping = mode === "warping-in" || mode === "warping-out";

    if (warping && progress.current < 1) {
      progress.current = Math.min(1, progress.current + dt * 0.85);
      const t = easeInOutCubic(progress.current);
      const breath = Math.sin(t * Math.PI) * 6;
      cam.position.lerpVectors(fromPos.current, toPos.current, t);
      cam.fov = fromFov.current + (toFov.current - fromFov.current) * t + breath;
      cam.updateProjectionMatrix();
      cam.lookAt(look.current);
      if (progress.current >= 1) {
        onSettled?.(mode === "warping-in" ? "observatory" : "framed");
      }
      return;
    }

    if (mode === "framed") {
      const t = performance.now() * 0.001;
      const drift = new THREE.Vector3(
        FRAMED_POS.x + Math.sin(t * 0.07) * 0.15,
        FRAMED_POS.y + Math.cos(t * 0.05) * 0.08,
        FRAMED_POS.z,
      );
      cam.position.lerp(drift, 1 - Math.exp(-dt * 1.2));
      cam.lookAt(look.current);
      if (Math.abs(cam.fov - FOV_FRAMED) > 0.05) {
        cam.fov += (FOV_FRAMED - cam.fov) * 0.08;
        cam.updateProjectionMatrix();
      }
    }
  });

  const orbitEnabled = mode === "observatory" && !prefersReducedMotion;

  return (
    <OrbitControls
      makeDefault
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.06}
      minDistance={3.5}
      maxDistance={18}
      maxPolarAngle={Math.PI * 0.82}
      minPolarAngle={Math.PI * 0.18}
      target={look.current}
    />
  );
}
