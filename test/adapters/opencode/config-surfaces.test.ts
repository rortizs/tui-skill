import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { discoverOpenCodeConfig } from "../../../src/adapters/opencode/config";
import { inventoryOpenCodeSurfaces } from "../../../src/adapters/opencode/surfaces";
import { CLIENT_ID, CONFIG_LAYER, SOURCE_KIND } from "../../../src/domain/inventory";

async function createConfigFixture(): Promise<{ root: string; globalDir: string; envDir: string; projectDir: string; homeDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "tui-skills-opencode-"));
  const globalDir = join(root, "global-opencode");
  const envDir = join(root, "env-opencode");
  const projectDir = join(root, "project");
  const dotOpenCodeDir = join(projectDir, ".opencode");
  const homeDir = join(root, "home");

  await Promise.all([
    mkdir(globalDir, { recursive: true }),
    mkdir(envDir, { recursive: true }),
    mkdir(dotOpenCodeDir, { recursive: true }),
    mkdir(homeDir, { recursive: true }),
    mkdir(join(dotOpenCodeDir, "commands"), { recursive: true }),
    mkdir(join(dotOpenCodeDir, "agents"), { recursive: true }),
    mkdir(join(dotOpenCodeDir, "modes"), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(
      join(globalDir, "opencode.json"),
      JSON.stringify({ skills: ["~/global-skills", "https://example.test/skills/"] }),
    ),
    writeFile(
      join(envDir, "opencode.json"),
      JSON.stringify({ commands: { shared: { template: "custom shared" } } }),
    ),
    writeFile(
      join(projectDir, "opencode.jsonc"),
      `{
        // project-level skill path
        "skills": ["./project-skills"],
        "commands": { "project-only": { "template": "Project command" } }
      }`,
    ),
    writeFile(
      join(dotOpenCodeDir, "opencode.json"),
      JSON.stringify({
        plugins: ["opencode-plugin-example"],
        mcp: { servers: { local: { type: "local", command: ["node", "server.js"] } } },
        permissions: [{ action: "skill", resource: "typescript", effect: "deny" }],
      }),
    ),
    writeFile(join(dotOpenCodeDir, "commands", "review.md"), "---\ndescription: Review docs\n---\nReview docs"),
    writeFile(join(dotOpenCodeDir, "agents", "helper.md"), "---\ndescription: Helper\nmode: subagent\n---\nHelp"),
    writeFile(join(dotOpenCodeDir, "modes", "build.md"), "---\ndescription: Build mode\n---\nBuild"),
  ]);

  return { root, globalDir, envDir, projectDir, homeDir };
}

describe("OpenCode config and surface inventory", () => {
  it("discovers global, project, dot-opencode, and OPENCODE_CONFIG_DIR config layers with provenance", async () => {
    const fixture = await createConfigFixture();

    const result = await discoverOpenCodeConfig({
      projectDir: fixture.projectDir,
      globalConfigDir: fixture.globalDir,
      envConfigDir: fixture.envDir,
    });

    expect(result.documents.map((document) => document.provenance.layer)).toEqual([
      CONFIG_LAYER.GLOBAL,
      CONFIG_LAYER.CUSTOM,
      CONFIG_LAYER.PROJECT,
      CONFIG_LAYER.PROJECT,
    ]);
    expect(result.documents.map((document) => document.provenance.sourcePath)).toEqual([
      join(fixture.globalDir, "opencode.json"),
      join(fixture.envDir, "opencode.json"),
      join(fixture.projectDir, "opencode.jsonc"),
      join(fixture.projectDir, ".opencode", "opencode.json"),
    ]);
    expect(await readFile(join(fixture.projectDir, "opencode.jsonc"), "utf8")).toContain("project-level skill path");
  });

  it("inventories OpenCode surfaces without executing plugins or connecting MCP", async () => {
    const fixture = await createConfigFixture();
    const config = await discoverOpenCodeConfig({
      projectDir: fixture.projectDir,
      globalConfigDir: fixture.globalDir,
      envConfigDir: fixture.envDir,
    });

    const inventory = await inventoryOpenCodeSurfaces({ config, projectDir: fixture.projectDir, homeDir: fixture.homeDir });

    expect(inventory.report.client).toBe(CLIENT_ID.OPENCODE);
    expect(inventory.report.commands.map((command) => command.name).sort()).toEqual(["project-only", "review", "shared"]);
    expect(inventory.report.agents).toEqual([
      expect.objectContaining({ name: "helper", kind: SOURCE_KIND.AGENT }),
    ]);
    expect(inventory.report.modes).toEqual([
      expect.objectContaining({ name: "build", kind: SOURCE_KIND.MODE }),
    ]);
    expect(inventory.report.plugins).toEqual([
      expect.objectContaining({ name: "opencode-plugin-example", kind: SOURCE_KIND.PLUGIN }),
    ]);
    expect(inventory.report.mcpEntries).toEqual([
      expect.objectContaining({ name: "local", kind: SOURCE_KIND.MCP }),
    ]);
    expect(inventory.permissions).toEqual([
      expect.objectContaining({ action: "skill", resource: "typescript", effect: "deny" }),
    ]);
    expect(inventory.skillSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "directory", value: join(fixture.homeDir, "global-skills") }),
        expect.objectContaining({ type: "directory", value: join(fixture.projectDir, "project-skills") }),
        expect.objectContaining({ type: "url", value: "https://example.test/skills/" }),
      ]),
    );
  });
});
