import { COMPATIBILITY_LEVEL } from "../domain/compatibility";
import {
  LOAD_STATUS,
  type InventoryReport,
  type SkillIdentity,
  type SkillRecord,
  skillIdentityKey,
} from "../domain/inventory";
import {
  PROFILE_SKILL_STATE,
  SATURATION_RISK,
  type ActivationProfile,
  type ProfileGuidance,
  type SaturationRisk,
} from "../domain/profiles";

export interface ActivationProfileGuidanceInput {
  profile: ActivationProfile;
  inventory: InventoryReport;
  matchingContextSkills?: SkillIdentity[];
  saturationLimit?: number;
}

const DEFAULT_SATURATION_LIMIT = 7;

export function buildActivationProfileGuidance(input: ActivationProfileGuidanceInput): ProfileGuidance {
  const selected = identitiesBySelectionState(input.profile, PROFILE_SKILL_STATE.SELECTED);
  const duplicated = uniqueIdentities([
    ...identitiesBySelectionState(input.profile, PROFILE_SKILL_STATE.DUPLICATED),
    ...input.inventory.skills.filter(isDuplicatedSkill).map((skill) => skill.identity),
  ]);
  const incompatible = uniqueIdentities([
    ...identitiesBySelectionState(input.profile, PROFILE_SKILL_STATE.INCOMPATIBLE),
    ...input.inventory.skills.filter(isIncompatibleSkill).map((skill) => skill.identity),
  ]);
  const inactive = inactiveIdentities(input.profile, input.inventory, selected, duplicated, incompatible);
  const risk = saturationRisk(input.matchingContextSkills ?? selected, input.saturationLimit ?? DEFAULT_SATURATION_LIMIT);
  const recommendation = risk === SATURATION_RISK.NONE ? undefined : saturationRecommendation(risk);

  return {
    profileId: input.profile.id,
    risk,
    selected,
    inactive,
    duplicated,
    incompatible,
    ...(recommendation ? { recommendation } : {}),
  };
}

function identitiesBySelectionState(profile: ActivationProfile, state: typeof PROFILE_SKILL_STATE[keyof typeof PROFILE_SKILL_STATE]): SkillIdentity[] {
  return uniqueIdentities(profile.selections.filter((selection) => selection.state === state).map((selection) => selection.identity));
}

function inactiveIdentities(
  profile: ActivationProfile,
  inventory: InventoryReport,
  selected: SkillIdentity[],
  duplicated: SkillIdentity[],
  incompatible: SkillIdentity[],
): SkillIdentity[] {
  const explicitInactive = identitiesBySelectionState(profile, PROFILE_SKILL_STATE.INACTIVE);
  const excluded = new Set([...selected, ...duplicated, ...incompatible].map(skillIdentityKey));
  const inventoryInactive = inventory.skills
    .map((skill) => skill.identity)
    .filter((identity) => !excluded.has(skillIdentityKey(identity)));

  return uniqueIdentities([...explicitInactive, ...inventoryInactive]).filter((identity) => !excluded.has(skillIdentityKey(identity)));
}

function saturationRisk(matchingContextSkills: SkillIdentity[], saturationLimit: number): SaturationRisk {
  if (matchingContextSkills.length === 0) return SATURATION_RISK.NONE;
  if (matchingContextSkills.length > saturationLimit) return SATURATION_RISK.HIGH;
  if (matchingContextSkills.length === saturationLimit) return SATURATION_RISK.MEDIUM;
  if (matchingContextSkills.length >= Math.max(2, Math.ceil(saturationLimit / 2))) return SATURATION_RISK.LOW;
  return SATURATION_RISK.NONE;
}

function saturationRecommendation(risk: SaturationRisk): string {
  return `Refine the profile to reduce ${risk} saturation risk; no skills are disabled automatically.`;
}

function isDuplicatedSkill(skill: SkillRecord): boolean {
  return skill.status === LOAD_STATUS.DUPLICATE;
}

function isIncompatibleSkill(skill: SkillRecord): boolean {
  return skill.status === LOAD_STATUS.INVALID || skill.compatibility.includes(COMPATIBILITY_LEVEL.INCOMPATIBLE);
}

function uniqueIdentities(identities: SkillIdentity[]): SkillIdentity[] {
  const seen = new Set<string>();
  return identities.filter((identity) => {
    const key = skillIdentityKey(identity);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
