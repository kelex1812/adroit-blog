/**
 * AdminShell — back-nav + sidebar nav integrity (G5, t_f94e01d5) + v5 nav
 * regroup (t_888621eb). The admin is a multi-page operating surface; the
 * "Back to site" link must live in the sidebar (NOT a modal) and point to the
 * public site so an admin can leave /admin back to the marketing/blog surface.
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

  it("groups the nav by admin job (Access/Content/System) with no Matrix", () => {
    render(<AdminShell>content</AdminShell>);
    for (const label of [
      "Overview",
      "People",
      "Courses",
      "Catalog",
      "Analytics",
      "Audit Log",
      "Offers · Coupons",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // The Access Matrix page is killed (ADR-222) — its job absorbed into
    // People + Access·Courses via the shared AccessGrid.
    expect(screen.queryByRole("link", { name: /access matrix/i })).toBeNull();
    expect(screen.getByRole("link", { name: /back to site/i })).toBeInTheDocument();
  });

  it("marks the active admin route with aria-current", () => {
    render(<AdminShell>content</AdminShell>);
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
