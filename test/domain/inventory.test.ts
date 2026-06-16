import { describe, expect, it } from "vitest";

import { CLIENT_ID, type SkillIdentity, skillIdentityKey } from "../../src/domain/inventory";

describe("inventory contracts", () => {
  it("derives stable skill identity keys without using source paths", () => {
    const first: SkillIdentity = { client: CLIENT_ID.OPENCODE, name: "typescript" };
    const second: SkillIdentity = { client: CLIENT_ID.OPENCODE, name: "typescript" };

    expect(skillIdentityKey(first)).toBe(skillIdentityKey(second));
  });
});
