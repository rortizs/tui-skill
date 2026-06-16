import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CLIENT_ID } from "../../src/domain/inventory";
import { REPAIR_PLAN_STATUS, planSkillRepair } from "../../src/services/repair-planner";

const fixtureRoot = join(import.meta.dirname, "..", "fixtures", "skills");

describe("repair planner", () => {
  it("plans a safe delimiter repair without mutating the skill file", async () => {
    const sourcePath = join(fixtureRoot, "invalid", "missing-boundary", "SKILL.md");
    const original = await readFile(sourcePath, "utf8");

    const plan = planSkillRepair({ client: CLIENT_ID.CODEX, sourceId: "missing-boundary", sourcePath, content: original });

    expect(plan.status).toBe(REPAIR_PLAN_STATUS.SAFE);
    if (plan.status !== REPAIR_PLAN_STATUS.SAFE) throw new Error("Expected a safe repair plan.");
    expect(plan.requiresManualReview).toBe(false);
    expect(plan.proposedContent).toBe(`---\n${original}`);
    expect(plan.diff).toEqual(
      expect.objectContaining({
        kind: "insert-opening-delimiter",
        before: original,
        after: `---\n${original}`,
      }),
    );
    expect(await readFile(sourcePath, "utf8")).toBe(original);
  });

  it("requires manual review when author intent cannot be safely inferred", () => {
    const plan = planSkillRepair({
      client: CLIENT_ID.OPENCODE,
      sourceId: "ambiguous",
      sourcePath: "/tmp/ambiguous/SKILL.md",
      content: "description: Missing a name field.\n\nBody text.",
    });

    expect(plan.status).toBe(REPAIR_PLAN_STATUS.MANUAL_REVIEW);
    if (plan.status !== REPAIR_PLAN_STATUS.MANUAL_REVIEW) throw new Error("Expected a manual-review repair plan.");
    expect(plan.requiresManualReview).toBe(true);
    expect("proposedContent" in plan).toBe(false);
    expect(plan.reason).toContain("manual review");
  });
});
