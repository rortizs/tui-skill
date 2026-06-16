import { describe, expect, it } from "vitest";

import { inventoryOpenCodeSurfaces } from "../../src/adapters/opencode/surfaces";
import { APPROVAL_DECISION, SIDE_EFFECT, type ApprovalGate, type ApprovalRequest } from "../../src/domain/approval";
import { CLIENT_ID, CONFIG_LAYER, SOURCE_KIND } from "../../src/domain/inventory";
import { requireApprovedSideEffect } from "../../src/services/safety-service";

describe("safety service", () => {
  it("requires approval for every file, config, plugin, and MCP side effect", async () => {
    const requests: ApprovalRequest[] = [];
    const gate: ApprovalGate = {
      require: async (request) => {
        requests.push(request);
        return APPROVAL_DECISION.DENIED;
      },
    };
    let sideEffects = 0;

    for (const effect of Object.values(SIDE_EFFECT)) {
      const result = await requireApprovedSideEffect({ effect, planId: `plan:${effect}`, reason: "test refusal" }, gate, async () => {
        sideEffects += 1;
        return "executed";
      });

      expect(result.decision).toBe(APPROVAL_DECISION.DENIED);
      expect(result.value).toBeUndefined();
    }

    expect(requests.map((request) => request.effect)).toEqual(Object.values(SIDE_EFFECT));
    expect(sideEffects).toBe(0);
  });

  it("inventories plugin and MCP declarations while refused execution and connection do nothing", async () => {
    const inventory = await inventoryOpenCodeSurfaces({
      projectDir: "/project",
      homeDir: "/home/user",
      config: {
        documents: [
          {
            directory: "/project/.opencode",
            fileName: "opencode.json",
            info: {
              plugins: ["opencode-plugin-diagnostics"],
              mcp: { servers: { local: { type: "local", command: ["node", "server.js"] } } },
            },
            provenance: {
              id: "opencode:config:project-dot-opencode:opencode.json",
              client: CLIENT_ID.OPENCODE,
              kind: SOURCE_KIND.CONFIG,
              layer: CONFIG_LAYER.PROJECT,
              rootPath: "/project/.opencode",
              sourcePath: "/project/.opencode/opencode.json",
            },
          },
        ],
        directories: [],
        unavailableSources: [],
      },
    });
    const gate = denyAllGate();
    let pluginExecutions = 0;
    let mcpConnections = 0;

    const pluginResult = await requireApprovedSideEffect(
      { effect: SIDE_EFFECT.PLUGIN_EXECUTE, planId: "plugin:diagnostics", reason: "execute plugin" },
      gate,
      async () => {
        pluginExecutions += 1;
        return "plugin executed";
      },
    );
    const mcpResult = await requireApprovedSideEffect(
      { effect: SIDE_EFFECT.MCP_CONNECT, planId: "mcp:local", reason: "connect MCP" },
      gate,
      async () => {
        mcpConnections += 1;
        return "mcp connected";
      },
    );

    expect(inventory.report.plugins).toEqual([expect.objectContaining({ name: "opencode-plugin-diagnostics" })]);
    expect(inventory.report.mcpEntries).toEqual([expect.objectContaining({ name: "local" })]);
    expect(pluginResult.decision).toBe(APPROVAL_DECISION.DENIED);
    expect(mcpResult.decision).toBe(APPROVAL_DECISION.DENIED);
    expect(pluginExecutions).toBe(0);
    expect(mcpConnections).toBe(0);
  });
});

function denyAllGate(): ApprovalGate {
  return { require: async () => APPROVAL_DECISION.DENIED };
}
