import type { ClientId, SkillIdentity } from "./inventory";

export const PROFILE_SKILL_STATE = {
  SELECTED: "selected",
  INACTIVE: "inactive",
  DUPLICATED: "duplicated",
  INCOMPATIBLE: "incompatible",
} as const;

export type ProfileSkillState = (typeof PROFILE_SKILL_STATE)[keyof typeof PROFILE_SKILL_STATE];

export const SATURATION_RISK = {
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type SaturationRisk = (typeof SATURATION_RISK)[keyof typeof SATURATION_RISK];

export interface ProfileSkillSelection {
  identity: SkillIdentity;
  state: ProfileSkillState;
  reason?: string;
}

export interface ActivationProfile {
  id: string;
  name: string;
  client: ClientId;
  selections: ProfileSkillSelection[];
}

export interface ProfileGuidance {
  profileId: string;
  risk: SaturationRisk;
  selected: SkillIdentity[];
  inactive: SkillIdentity[];
  duplicated: SkillIdentity[];
  incompatible: SkillIdentity[];
  recommendation?: string;
}
