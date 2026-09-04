/**
 * HubbleFieldLab — the star chart lab.
 *
 * This was once a four-study WebGL sandbox (star material, deep field, volume
 * atlas, warp). Those studies were built, reviewed, and rejected: faithful to
 * Hubble, unreadable as a progress surface. They have been deleted rather than
 * left to rot — `docs/implementation-plan-hubble-field.md` §0 records why, and
 * git history has them if the reasoning ever needs revisiting.
 *
 * What remains is the study that won: a 2D SVG celestial chart. It owns the
 * whole stage, so this shell is only the focus state around it.
 */
"use client";

import { useState } from "react";
import { ChartAtlasStudy } from "./chart-atlas";

export function HubbleFieldLab() {
  const [focusSlug, setFocusSlug] = useState<string | null>(
    "salesforce-architect",
  );

  return (
    <div data-testid="hubble-field-lab">
      <ChartAtlasStudy focusSlug={focusSlug} onFocusChange={setFocusSlug} />
    </div>
  );
}

export default HubbleFieldLab;
