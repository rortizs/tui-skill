import { describe, expect, it } from "vitest";

import { COMPATIBILITY_LEVEL } from "../../../src/domain/compatibility";
import {
  OPENCODE_COMPATIBILITY_CONFIDENCE,
  OPENCODE_COMPATIBILITY_DATA,
  openCodeCompatibilityRulesFor,
} from "../../../src/adapters/opencode/compatibility-data";

describe("OpenCode compatibility data", () => {
  it("records command precedence as explicit uncertainty instead of verified OpenCode behavior", () => {
    const precedenceRule = OPENCODE_COMPATIBILITY_DATA.find(
      (rule) => rule.id === "opencode.command.precedence",
    );

    expect(precedenceRule).toEqual(
      expect.objectContaining({
        subject: "command precedence across built-ins, config files, MCP prompts, and skills",
        level: COMPATIBILITY_LEVEL.RUNTIME,
        confidence: OPENCODE_COMPATIBILITY_CONFIDENCE.EXPLICIT_UNCERTAINTY,
      }),
    );
    expect(precedenceRule?.confidence).not.toBe(OPENCODE_COMPATIBILITY_CONFIDENCE.OBSERVED_SOURCE);
    expect(precedenceRule?.evidence).toContain("did not verify MCP prompt or skill slash command precedence");
    expect(precedenceRule?.uncertainty).toContain("mark precedence unknown");
  });

  it("can query compatibility rules by subject while preserving uncertainty metadata", () => {
    const rules = openCodeCompatibilityRulesFor(
      "command precedence across built-ins, config files, MCP prompts, and skills",
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.confidence).toBe(OPENCODE_COMPATIBILITY_CONFIDENCE.EXPLICIT_UNCERTAINTY);
    expect(rules[0]?.uncertainty).toBeDefined();
  });
});
