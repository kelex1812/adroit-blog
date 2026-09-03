/**
 * CameraRig — dolly-and-tilt flight controller for the profile galaxy
 * (deep-sky "Sky Roads", kara t_ea789325 §3).
 *
 * Overview: camera at sky-chart altitude with slow Keplerian drift + pointer
 * parallax so you feel inside the volume; sees the whole atlas.
 *
 * Fly to node: 3-phase dolly-and-tilt — (1) pull back slightly along the
 * current look axis, (2) arc toward the target node's approach position with
 * damped easing while tilting so the figure frames correctly, (3) decelerate
 * + subtle FOV breath on settle. Near field-stars parallax past during the
 * flight = the sense of travel.
 *
 * Reduced motion: static settled overview; selecting swaps focus instantly
 * (no flight), exactly as the spec's `staticMode` requires.
 *
 * NOTE: all camera mutation happens inside `useFrame(state)` (r3f passes the
 * live camera) to satisfy the react-hooks/immutability rule — we never mutate
 * the hook-returned camera outside the frame callback.
 */
"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { CameraRigProps } from "@/shared/contracts-galaxy";

const HOME: THREE.Vector3 = new THREE.Vector3(0, 4.6, 9.5);
const LOOK_HOME: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
const FOV_BASE = 45;

/** Exponential damp factor per mode (higher = snappier). */
const DAMP_OVERVIEW = 0.9;
const DAMP_FLY = 1.5;
const DAMP_SETTLE = 3.0;

export function CameraRig({
  focusSlug,
  sectors,
  prefersReducedMotion = false,
  onSettled,
}: CameraRigProps) {
  const { pointer } = useThree();
  const mode = useRef<"overview" | "flying" | "settled">("overview");
  const phase = useRef(0); // 0=pullback, 1=arc, 2=settle
  const progress = useRef(0);
  const approach = useRef(new THREE.Vector3());
  const pullBack = useRef(new THREE.Vector3());
  const lastFocus = useRef<string | null>(null);
  const settledNotified = useRef(false);
  const fov = useRef(FOV_BASE);

  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const dtc = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    const sectorBySlug = new Map(sectors.map((s) => [s.seriesSlug, s]));
    const targetPos = focusSlug
      ? (() => {
          const s = sectorBySlug.get(focusSlug);
          return s ? new THREE.Vector3(...s.position) : null;
        })()
      : null;

    // On focus change → start a flight (or snap when reduced motion).
    if (focusSlug !== lastFocus.current) {
      lastFocus.current = focusSlug;
      settledNotified.current = false;
      if (focusSlug && targetPos && !prefersReducedMotion) {
        const dir = targetPos.clone().normalize();
        approach.current.copy(targetPos.clone().add(dir.clone().multiplyScalar(3.1)));
        approach.current.y += 0.7;
        pullBack.current.copy(
          camera.position
            .clone()
            .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1.1)),
        );
        mode.current = "flying";
        phase.current = 0;
        progress.current = 0;
      } else {
        // Reduced motion: snap to settled (overview when no focus).
        mode.current = focusSlug ? "settled" : "overview";
      }
    }

    if (mode.current === "overview") {
      // Slow Keplerian drift + pointer parallax (damped), no flight.
      const driftX = Math.sin(t * 0.08) * 0.6;
      const driftY = Math.cos(t * 0.06) * 0.25;
      const target = new THREE.Vector3(
        HOME.x + driftX + pointer.x * 0.7,
        HOME.y + driftY + pointer.y * 0.4,
        HOME.z + Math.cos(t * 0.05) * 0.35,
      );
      camera.position.lerp(target, 1 - Math.exp(-dtc * DAMP_OVERVIEW));
      camera.lookAt(LOOK_HOME);
      fov.current += (FOV_BASE - fov.current) * (1 - Math.exp(-dtc * 2));
      if (Math.abs(camera.fov - fov.current) > 0.01) {
        camera.fov = fov.current;
        camera.updateProjectionMatrix();
      }
      return;
    }

    if (mode.current === "flying") {
      progress.current += dtc;
      if (phase.current === 0) {
        // Phase 1: pull back slightly.
        camera.position.lerp(pullBack.current, 1 - Math.exp(-dtc * DAMP_FLY));
        if (progress.current > 0.25) {
          phase.current = 1;
          progress.current = 0;
        }
      } else if (phase.current === 1) {
        // Phase 2: arc toward the approach position with banking.
        const k = 1 - Math.exp(-dtc * DAMP_FLY * 0.7);
        const arc = camera.position.clone().lerp(approach.current, k);
        arc.y += Math.sin(progress.current * Math.PI) * 0.6;
        camera.position.copy(arc);
        if (targetPos) camera.lookAt(targetPos);
        if (camera.position.distanceTo(approach.current) < 0.12) {
          phase.current = 2;
          progress.current = 0;
        }
      } else {
        // Phase 3: decelerate + FOV breath on settle.
        camera.position.lerp(approach.current, 1 - Math.exp(-dtc * DAMP_SETTLE));
        if (targetPos) camera.lookAt(targetPos);
        const breath = Math.sin(t * 1.4) * 1.2;
        fov.current += (FOV_BASE + breath - fov.current) * (1 - Math.exp(-dtc * 2));
        camera.fov = fov.current;
        camera.updateProjectionMatrix();
        if (camera.position.distanceTo(approach.current) < 0.03 && !settledNotified.current) {
          settledNotified.current = true;
          mode.current = "settled";
          onSettled?.(focusSlug);
        }
      }
      return;
    }

    // Settled: keep framing + subtle FOV breathing.
    if (targetPos) camera.lookAt(targetPos);
    else camera.lookAt(LOOK_HOME);
    fov.current += (FOV_BASE - fov.current) * (1 - Math.exp(-dtc * 2));
    if (Math.abs(camera.fov - fov.current) > 0.01) {
      camera.fov = fov.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
