import { describe, expect, it } from "vitest";

import { SIDE_EFFECT, requiresExplicitApproval } from "../../src/domain/approval";

describe("approval contracts", () => {
  it("requires approval for every side-effecting action", () => {
    for (const effect of Object.values(SIDE_EFFECT)) {
      expect(requiresExplicitApproval(effect)).toBe(true);
    }
  });

  it("does not classify read-only inventory as a side effect", () => {
    expect(requiresExplicitApproval("read-only-inventory")).toBe(false);
  });
});
