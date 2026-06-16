import type { CompatibilityLevel } from "./compatibility.js";

export const CLIENT_ID = {
  OPENCODE: "opencode",
  CODEX: "codex",
} as const;

export type ClientId = (typeof CLIENT_ID)[keyof typeof CLIENT_ID];

export const SOURCE_KIND = {
  SKILL: "skill",
  AGENT: "agent",
  MODE: "mode",
  COMMAND: "command",
  PLUGIN: "plugin",
  MCP: "mcp",
  CONFIG: "config",
  BUILTIN: "builtin",
} as const;

export type SourceKind = (typeof SOURCE_KIND)[keyof typeof SOURCE_KIND];

export const CONFIG_LAYER = {
  GLOBAL: "global",
  PROJECT: "project",
  CUSTOM: "custom",
  EXTERNAL: "external",
} as const;

export type ConfigLayer = (typeof CONFIG_LAYER)[keyof typeof CONFIG_LAYER];

export const LOAD_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  DUPLICATE: "duplicate",
  INVALID: "invalid",
  DISABLED: "disabled",
} as const;

export type LoadStatus = (typeof LOAD_STATUS)[keyof typeof LOAD_STATUS];

export interface SourceProvenance {
  id: string;
  client: ClientId;
  kind: SourceKind;
  layer?: ConfigLayer;
  rootPath?: string;
  sourcePath?: string;
}

export interface SkillIdentity {
  client: ClientId;
  name: string;
}

export interface SkillRecord {
  identity: SkillIdentity;
  description?: string;
  status: LoadStatus;
  compatibility: CompatibilityLevel[];
  sources: SourceProvenance[];
}

export interface NamedSurfaceRecord {
  id: string;
  name: string;
  kind: SourceKind;
  sources: SourceProvenance[];
}

export interface UnavailableSource {
  provenance: SourceProvenance;
  reason: string;
}

export interface InventoryReport {
  client: ClientId;
  skills: SkillRecord[];
  agents: NamedSurfaceRecord[];
  modes: NamedSurfaceRecord[];
  commands: NamedSurfaceRecord[];
  plugins: NamedSurfaceRecord[];
  mcpEntries: NamedSurfaceRecord[];
  unavailableSources: UnavailableSource[];
}

export function skillIdentityKey(identity: SkillIdentity): string {
  return `${identity.client}:${identity.name}`;
}
