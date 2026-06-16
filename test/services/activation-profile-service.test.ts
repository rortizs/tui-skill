import { describe, expect, it } from "vitest";

import { COMPATIBILITY_LEVEL } from "../../src/domain/compatibility";
import { CLIENT_ID, LOAD_STATUS, SOURCE_KIND, type InventoryReport, type SkillIdentity } from "../../src/domain/inventory";
import { PROFILE_SKILL_STATE, SATURATION_RISK, type ActivationProfile } from "../../src/domain/profiles";
import { buildActivationProfileGuidance } from "../../src/services/activation-profile-service";

const typescript: SkillIdentity = { client: CLIENT_ID.OPENCODE, name: "typescript" };
const testing: SkillIdentity = { client: CLIENT_ID.OPENCODE, name: "testing" };
const duplicate: SkillIdentity = { client: CLIENT_ID.OPENCODE, name: "shared" };
const incompatible: SkillIdentity = { client: CLIENT_ID.OPENCODE, name: "legacy" };

describe("activation profile service", () => {
  it("separates selected, inactive, duplicated, and incompatible skills without changing config", () => {
    const inventory = createInventory();
    const before = JSON.stringify(inventory);
    const profile: ActivationProfile = {
      id: "frontend",
      name: "Frontend",
      client: CLIENT_ID.OPENCODE,
      selections: [{ identity: typescript, state: PROFILE_SKILL_STATE.SELECTED }],
    };

    const guidance = buildActivationProfileGuidance({ profile, inventory });

    expect(guidance.selected).toEqual([typescript]);
    expect(guidance.inactive).toEqual([testing]);
    expect(guidance.duplicated).toEqual([duplicate]);
    expect(guidance.incompatible).toEqual([incompatible]);
    expect(JSON.stringify(inventory)).toBe(before);
  });

  it("reports saturation risk and suggests profile refinement instead of silent disabling", () => {
    const profile: ActivationProfile = {
      id: "busy",
      name: "Busy",
      client: CLIENT_ID.OPENCODE,
      selections: [typescript, testing, duplicate, incompatible].map((identity) => ({
        identity,
        state: PROFILE_SKILL_STATE.SELECTED,
      })),
    };

    const guidance = buildActivationProfileGuidance({
      profile,
      inventory: createInventory(),
      matchingContextSkills: [typescript, testing, duplicate, incompatible],
      saturationLimit: 3,
    });

    expect(guidance.risk).toBe(SATURATION_RISK.HIGH);
    expect(guidance.recommendation).toContain("Refine the profile");
    expect(guidance.recommendation).toContain("no skills are disabled automatically");
  });
});

function createInventory(): InventoryReport {
  return {
    client: CLIENT_ID.OPENCODE,
    skills: [
      skill(typescript, LOAD_STATUS.AVAILABLE, [COMPATIBILITY_LEVEL.PORTABLE]),
      skill(testing, LOAD_STATUS.AVAILABLE, [COMPATIBILITY_LEVEL.PORTABLE]),
      skill(duplicate, LOAD_STATUS.DUPLICATE, [COMPATIBILITY_LEVEL.PORTABLE]),
      skill(incompatible, LOAD_STATUS.INVALID, [COMPATIBILITY_LEVEL.INCOMPATIBLE]),
    ],
    agents: [],
    modes: [],
    commands: [],
    plugins: [],
    mcpEntries: [],
    unavailableSources: [],
  };
}

function skill(identity: SkillIdentity, status: typeof LOAD_STATUS[keyof typeof LOAD_STATUS], compatibility: typeof COMPATIBILITY_LEVEL[keyof typeof COMPATIBILITY_LEVEL][]) {
  return {
    identity,
    status,
    compatibility,
    sources: [{ id: identity.name, client: identity.client, kind: SOURCE_KIND.SKILL }],
  };
}
