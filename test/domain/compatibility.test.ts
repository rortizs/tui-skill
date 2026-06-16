import { describe, expect, it } from "vitest";

import { COMPATIBILITY_LEVEL, isCompatibilityLevel } from "../../src/domain/compatibility";

describe("compatibility contracts", () => {
  it("exposes the required compatibility levels", () => {
    expect(Object.values(COMPATIBILITY_LEVEL)).toEqual([
      "runtime-compatible",
      "docs-compatible",
      "portable-compatible",
      "incompatible",
    ]);
  });

  it("rejects unknown compatibility levels", () => {
    expect(isCompatibilityLevel("runtime-compatible")).toBe(true);
    expect(isCompatibilityLevel("unknown")).toBe(false);
  });
});
