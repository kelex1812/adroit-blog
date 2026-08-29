/**
 * AdminShell — back-nav + sidebar nav integrity (G5, t_f94e01d5).
 *
 * The admin is a multi-page operating surface; the "Back to site" link must
 * live in the sidebar (NOT a modal) and point to the public site so an admin
 * can leave /admin back to the marketing/blog surface.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminShell } from "./AdminShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/courses",
}));

describe("AdminShell back-nav (t_f94e01d5)", () => {
  it("renders a Back to site link in the sidebar pointing to the public site", () => {
    render(<AdminShell>content</AdminShell>);
    const link = screen.getByRole("link", { name: /back to site/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveClass("no-underline");
  });

  it("keeps the full admin nav present alongside the back link", () => {
    render(<AdminShell>content</AdminShell>);
    for (const label of [
      "Dashboard",
      "Courses",
      "Users",
      "Access Matrix",
      "Analytics",
      "Audit Log",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /back to site/i })).toBeInTheDocument();
  });

  it("marks the active admin route with aria-current", () => {
    render(<AdminShell>content</AdminShell>);
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
