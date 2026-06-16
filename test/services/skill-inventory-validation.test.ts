import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { inventoryCodexSkills } from "../../src/adapters/codex/index";
import { COMPATIBILITY_LEVEL } from "../../src/domain/compatibility";
import { CLIENT_ID, LOAD_STATUS } from "../../src/domain/inventory";
import { validateSkillFile } from "../../src/services/validation-service";

const fixtureRoot = join(import.meta.dirname, "..", "fixtures", "skills");

describe("skill inventory and validation", () => {
  it("discovers Codex skills from multiple roots and groups duplicates by identity", async () => {
    const firstRoot = join(fixtureRoot, "root-a");
    const secondRoot = join(fixtureRoot, "root-b");

    const report = await inventoryCodexSkills({ roots: [firstRoot, secondRoot] });

    const duplicated = report.skills.find((skill) => skill.identity.name === "shared-skill");

    expect(report.client).toBe(CLIENT_ID.CODEX);
    expect(duplicated?.status).toBe(LOAD_STATUS.DUPLICATE);
    expect(duplicated?.sources).toHaveLength(2);
    expect(duplicated?.sources.map((source) => source.rootPath).sort()).toEqual([firstRoot, secondRoot].sort());
  });

  it("reports unavailable roots and continues inventory for remaining roots", async () => {
    const validRoot = join(fixtureRoot, "root-a");
    const unavailableRoot = join(fixtureRoot, "not-a-directory");

    const report = await inventoryCodexSkills({ roots: [unavailableRoot, validRoot] });

    expect(report.unavailableSources).toEqual([
      expect.objectContaining({ reason: expect.stringContaining("not readable") }),
    ]);
    expect(report.skills.some((skill) => skill.identity.name === "shared-skill")).toBe(true);
  });

  it("reports missing frontmatter boundaries as incompatible", async () => {
    const sourcePath = join(fixtureRoot, "invalid", "missing-boundary", "SKILL.md");
    const content = await readFile(sourcePath, "utf8");

    const result = validateSkillFile({ client: CLIENT_ID.CODEX, sourceId: "missing-boundary", sourcePath, content });

    expect(result.compatibility).toEqual([COMPATIBILITY_LEVEL.INCOMPATIBLE]);
    expect(result.findings).toEqual([
      expect.objectContaining({ code: "skill.frontmatter.missing-opening-boundary" }),
    ]);
  });

  it("distinguishes OpenCode runtime compatibility from documented schema compatibility", async () => {
    const sourcePath = join(fixtureRoot, "opencode-runtime-only", "SKILL.md");
    const content = await readFile(sourcePath, "utf8");

    const result = validateSkillFile({ client: CLIENT_ID.OPENCODE, sourceId: "runtime-only", sourcePath, content });

    expect(result.compatibility).toEqual([COMPATIBILITY_LEVEL.RUNTIME]);
    expect(result.findings).toEqual([
      expect.objectContaining({ code: "skill.frontmatter.missing-docs-field", level: COMPATIBILITY_LEVEL.DOCS }),
    ]);
  });
});
