import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Stub Supabase env vars so importing lib/supabase/* in tests doesn't throw
// at module load (server.ts/client.ts guard on missing keys). Individual tests
// that actually talk to Supabase mock the client — these are inert placeholders.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "stub-anon-key";
}

// jsdom does not implement matchMedia; the ThemeProvider depends on it.
// Provide a minimal no-op matchMedia (never matches dark) so theme logic
// renders deterministically in tests.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Keep the DOM clean between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
