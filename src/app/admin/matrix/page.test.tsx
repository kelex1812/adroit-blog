/**
 * page.test.tsx — /admin/matrix Access Matrix subscription surfacing
 * (t_32ce7d79). A user with an active subscription but zero entitlements must
 * show a distinct S indicator / Sub badge, and G/P entitlements must still
 * render.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/hooks/useAdminUsers", () => ({
  useAdminUsers: vi.fn(),
}));
vi.mock("@/lib/hooks/useAdminCourses", () => ({
  useAdminCourses: vi.fn(),
}));
vi.mock("@/components/Catalog/AccessModelChip", () => ({
  AccessModelChip: () => <span data-testid="model-chip" />,
}));

import { useAdminUsers } from "@/lib/hooks/useAdminUsers";
import { useAdminCourses } from "@/lib/hooks/useAdminCourses";
import AdminMatrixPage from "./page";

const useAdminUsersMock = useAdminUsers as unknown as ReturnType<typeof vi.fn>;
const useAdminCoursesMock = useAdminCourses as unknown as ReturnType<typeof vi.fn>;

function courses() {
  return [
    { course: { id: "c-sub", series_slug: "hermes-consultant", access_model: "subscription" } },
    { course: { id: "c-granted", series_slug: "granted-track", access_model: "granted" } },
  ];
}

function users(withSub: boolean, entitlements: Record<string, string>) {
  return [
    {
      user_id: "u1",
      email: "user@adroit.io",
      display_name: "Subscriber",
      role: "member",
      entitlements,
      subscription: withSub
        ? { id: "s1", user_id: "u1", plan: "learn", status: "active", current_period_end: null, created_at: "" }
        : null,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  // Details fetch (per-user) fails → component falls back to list-row fields.
  global.fetch = vi.fn().mockResolvedValue({ ok: false });
});

describe("/admin/matrix — subscription indicator (t_32ce7d79)", () => {
  it("shows an S chip and Sub badge for a subscriber with zero entitlements", async () => {
    useAdminUsersMock.mockReturnValue({ rows: users(true, {}), loading: false });
    useAdminCoursesMock.mockReturnValue({ rows: courses(), loading: false });
    render(<AdminMatrixPage />);
    // Sub badge next to the user name.
    expect(await screen.findByText("Sub")).toBeTruthy();
    // Per-cell S indicator on the subscription-gated course.
    expect(screen.getAllByText("S")).toHaveLength(1);
    // Legend documents the new indicator.
    expect(screen.getByText(/S = active subscription/)).toBeTruthy();
  });

  it("still shows G/P for granted/one-time entitlements", async () => {
    useAdminUsersMock.mockReturnValue({
      rows: users(false, { "c-granted": "granted" }),
      loading: false,
    });
    useAdminCoursesMock.mockReturnValue({ rows: courses(), loading: false });
    render(<AdminMatrixPage />);
    expect(await screen.findByText("G")).toBeTruthy();
    expect(screen.queryByText("Sub")).toBeNull();
    expect(screen.queryAllByText("S")).toHaveLength(0);
  });
});
