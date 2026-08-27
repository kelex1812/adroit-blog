/**
 * src/lib/completion.test.ts — Learn v2 completion derivation (plan §3f).
 *
 * deriveProgress is pure and unit-testable without a DB: lessons/courses/tracks
 * completed, streaks, and time-to-complete from the append-only event log.
 */
import { describe, expect, it } from "vitest";
import { deriveProgress } from "@/lib/completion";
import type { CompletionEventRow } from "@/shared/contracts-course-catalog";

const NOW = "2026-08-27T12:00:00.000Z";

function ev(over: Partial<CompletionEventRow> = {}): CompletionEventRow {
  return {
    id: 1,
    user_id: "u1",
    course_id: null,
    event_type: "lesson",
    lesson: null,
    lesson_slug: null,
    completed_at: NOW,
    ...over,
  };
}

describe("deriveProgress", () => {
  it("counts distinct lessons + course completions + tracks", () => {
    const result = deriveProgress({
      now: NOW,
      courseTracks: {
        c1: "track-a",
        c2: "track-a",
        c3: "track-b",
      },
      events: [
        ev({ event_type: "lesson", lesson_slug: "l1" }),
        ev({ event_type: "lesson", lesson_slug: "l1" }), // dup → still 1 lesson
        ev({ event_type: "lesson", lesson_slug: "l2" }),
        ev({ event_type: "course", course_id: "c1" }),
        ev({ event_type: "course", course_id: "c2" }), // track-a complete
        ev({ event_type: "course", course_id: "c3" }), // track-b complete
      ],
    });
    expect(result.lessonsCompleted).toBe(2);
    expect(result.coursesCompleted).toBe(3);
    expect(result.tracksCompleted).toBe(2);
  });

  it("track not complete when one of its courses is missing a course event", () => {
    const result = deriveProgress({
      now: NOW,
      courseTracks: { c1: "track-a", c2: "track-a" },
      events: [ev({ event_type: "course", course_id: "c1" })],
    });
    expect(result.tracksCompleted).toBe(0);
  });

  it("computes current + longest streak over consecutive days", () => {
    const result = deriveProgress({
      now: "2026-08-27T12:00:00.000Z",
      courseTracks: {},
      events: [
        ev({ completed_at: "2026-08-25T10:00:00.000Z" }),
        ev({ completed_at: "2026-08-26T10:00:00.000Z" }),
        ev({ completed_at: "2026-08-27T09:00:00.000Z" }),
        // a separate earlier run of 2 days
        ev({ completed_at: "2026-08-20T09:00:00.000Z" }),
        ev({ completed_at: "2026-08-21T09:00:00.000Z" }),
      ],
    });
    expect(result.streakDays).toBe(3);
    expect(result.longestStreakDays).toBe(3);
  });

  it("longest streak beats current streak", () => {
    const result = deriveProgress({
      now: "2026-08-27T12:00:00.000Z",
      courseTracks: {},
      events: [
        ev({ completed_at: "2026-08-20T09:00:00.000Z" }),
        ev({ completed_at: "2026-08-21T09:00:00.000Z" }),
        ev({ completed_at: "2026-08-22T09:00:00.000Z" }),
        ev({ completed_at: "2026-08-25T09:00:00.000Z" }), // gap → current streak 1
      ],
    });
    expect(result.longestStreakDays).toBe(3);
    expect(result.streakDays).toBe(1);
  });

  it("time-to-complete is the whole-day span across events; null under 2 events", () => {
    const span = deriveProgress({
      now: NOW,
      courseTracks: {},
      events: [
        ev({ completed_at: "2026-08-01T09:00:00.000Z" }),
        ev({ completed_at: "2026-08-10T09:00:00.000Z" }),
      ],
    });
    expect(span.timeToCompleteDays).toBe(9);

    const single = deriveProgress({
      now: NOW,
      courseTracks: {},
      events: [ev({ completed_at: "2026-08-01T09:00:00.000Z" })],
    });
    expect(single.timeToCompleteDays).toBeNull();
  });

  it("empty event set → zeros and null time-to-complete", () => {
    const result = deriveProgress({ now: NOW, courseTracks: {}, events: [] });
    expect(result).toEqual({
      lessonsCompleted: 0,
      coursesCompleted: 0,
      tracksCompleted: 0,
      streakDays: 0,
      longestStreakDays: 0,
      timeToCompleteDays: null,
    });
  });
});
