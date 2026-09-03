/**
 * SkyRoad — the additive guided route line through the sector nodes
 * (deep-sky "Sky Roads", kara t_ea789325).
 *
 * The road's Catmull-Rom curve (computed deterministically in galaxy-model)
 * renders faint cool as the untraveled base; the traveled portion (completed /
 * certified sectors, warm gold) is overlaid so the learner sees the path
 * behind them glowing and the path ahead as a dim dashed promise. Additive
 * blending + depthWrite off so the line never occludes stars.
 */
"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { SkyRoadProps } from "@/shared/contracts-galaxy";
import { catmullRomSamples } from "./galaxy-model";

export function SkyRoad({
  road,
  sectors,
}: SkyRoadProps) {
  // Untraveled base: the full curve, faint cool (dashed when motion allowed).
  const full = useMemo(
    () => new Float32Array(road.curve.flat()),
    [road.curve],
  );

  // Traveled overlay: Catmull-Rom through the completed/certified nodes only,
  // warm gold. Uses the same pure sampler as the model (deterministic).
  const traveledPoints = useMemo(() => {
    const traveled = sectors.filter((s) =>
      road.traveled.includes(s.seriesSlug),
    );
    if (traveled.length < 2) return null;
    return new Float32Array(catmullRomSamples(traveled, 24).flat());
  }, [sectors, road.traveled]);

  if (road.curve.length < 2) return null;

  return (
    <group>
      {/* Untraveled base */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[full, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#7DD3FC"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      {/* Traveled warm overlay */}
      {traveledPoints ? (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[traveledPoints, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#FFC46B"
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </line>
      ) : null}
    </group>
  );
}
