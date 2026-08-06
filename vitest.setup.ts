import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Keep the DOM clean between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
