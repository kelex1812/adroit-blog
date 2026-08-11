/**
 * api-security — validateQuizName tests (ADR-101 colon tier names).
 */
import { describe, it, expect } from "vitest";
import { validateQuizName } from "./api-security";

describe("validateQuizName", () => {
  it("accepts tier quiz names with colons (ADR-101)", () => {
    expect(validateQuizName("omni-studio-cert:lesson:day-01-f1-omnistudio-solution-and-industry-use-cases", "quizName")).toBeNull();
    expect(validateQuizName("omni-studio-cert:check:3", "quizName")).toBeNull();
    expect(validateQuizName("omni-studio-cert:exam", "quizName")).toBeNull();
    // bare legacy series names still pass (fallback path)
    expect(validateQuizName("omni-studio-cert", "quizName")).toBeNull();
  });

  it("rejects dots, slashes, spaces, and empty values (path-traversal guard)", () => {
    expect(validateQuizName("../etc:lesson:x", "quizName")).toContain("invalid characters");
    expect(validateQuizName("a/b:lesson:x", "quizName")).toContain("invalid characters");
    expect(validateQuizName("a b:lesson:x", "quizName")).toContain("invalid characters");
    expect(validateQuizName("omni-studio-cert:lesson:x.y", "quizName")).toContain("invalid characters");
    expect(validateQuizName("", "quizName")).toContain("required");
    expect(validateQuizName(null, "quizName")).toContain("required");
  });

  it("rejects over-long names", () => {
    expect(validateQuizName("a".repeat(201), "quizName")).toContain("characters or fewer");
  });
});
