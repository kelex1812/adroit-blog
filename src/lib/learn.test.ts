import { describe, expect, it } from "vitest";
import { toIsoDate } from "@/lib/learn";

describe("toIsoDate (SEO ISO-8601 structured data t_fa2f15c7)", () => {
  it("converts a human-readable 'Month DD, YYYY' lesson date to ISO-8601", () => {
    expect(toIsoDate("August 04, 2026")).toBe("2026-08-04");
  });

  it("passes through 'Date unknown' unchanged", () => {
    expect(toIsoDate("Date unknown")).toBe("Date unknown");
  });

  it("passes through an empty string unchanged", () => {
    expect(toIsoDate("")).toBe("");
  });

  it("passes through any other unparseable string unchanged (no invalid dates)", () => {
    expect(toIsoDate("not a date")).toBe("not a date");
  });

  it("is a valid parseable ISO-8601 full-date for JSON-LD datePublished", () => {
    const iso = toIsoDate("August 04, 2026");
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
    // ISO-8601 must not carry the authored human "Month" form.
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
