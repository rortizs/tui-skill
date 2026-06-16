import { describe, expect, it } from "vitest";

import { SOURCE_KIND } from "../../../src/domain/inventory";
import {
  COMMAND_PRECEDENCE_STATUS,
  OPENCODE_BUILTIN_COMMAND_NAMES,
  analyzeCommandCollisions,
  builtinCommandProjections,
  commandProjection,
} from "../../../src/services/collision-analyzer";

describe("OpenCode command collision analysis", () => {
  it("reports collisions across built-ins, config commands, markdown commands, MCP prompts, and skill commands", () => {
    const projections = [
      ...builtinCommandProjections(OPENCODE_BUILTIN_COMMAND_NAMES),
      commandProjection("review", "config-command", { id: "config:review", kind: SOURCE_KIND.CONFIG }),
      commandProjection("review", "markdown-command", { id: "file:review", kind: SOURCE_KIND.COMMAND }),
      commandProjection("review", "mcp-prompt", { id: "mcp:review", kind: SOURCE_KIND.MCP }),
      commandProjection("review", "skill-command", { id: "skill:review", kind: SOURCE_KIND.SKILL }),
    ];

    const report = analyzeCommandCollisions({ projections });
    const collision = report.collisions.find((group) => group.name === "review");

    expect(collision?.entries.map((entry) => entry.sourceKind)).toEqual([
      "builtin",
      "config-command",
      "markdown-command",
      "mcp-prompt",
      "skill-command",
    ]);
    expect(collision?.precedence.status).toBe(COMMAND_PRECEDENCE_STATUS.UNKNOWN);
    expect(collision?.precedence.reason).toContain("cannot be verified");
  });

  it("keeps non-colliding commands out of collision groups", () => {
    const report = analyzeCommandCollisions({
      projections: [
        commandProjection("solo", "config-command", { id: "config:solo", kind: SOURCE_KIND.CONFIG }),
        commandProjection("docs", "markdown-command", { id: "file:docs", kind: SOURCE_KIND.COMMAND }),
      ],
    });

    expect(report.collisions).toEqual([]);
  });
});
