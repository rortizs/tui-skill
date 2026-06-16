import { COMPATIBILITY_LEVEL, type CompatibilityLevel } from "../../domain/compatibility.js";

export const OPENCODE_COMPATIBILITY_CONFIDENCE = {
  OBSERVED_SOURCE: "observed-source",
  EXPLICIT_UNCERTAINTY: "explicit-uncertainty",
} as const;

export type OpenCodeCompatibilityConfidence =
  (typeof OPENCODE_COMPATIBILITY_CONFIDENCE)[keyof typeof OPENCODE_COMPATIBILITY_CONFIDENCE];

export interface OpenCodeCompatibilityRule {
  id: string;
  subject: string;
  level: CompatibilityLevel;
  confidence: OpenCodeCompatibilityConfidence;
  evidence: string;
  uncertainty?: string;
}

export const OPENCODE_OBSERVED_SOURCE_PATHS = {
  CONFIG: "/home/richard/workspace/opencode/packages/core/src/config.ts",
  GLOBAL: "/home/richard/workspace/opencode/packages/core/src/global.ts",
  SKILL: "/home/richard/workspace/opencode/packages/core/src/skill.ts",
  CONFIG_SKILL_PLUGIN: "/home/richard/workspace/opencode/packages/core/src/config/plugin/skill.ts",
  CONFIG_COMMAND_PLUGIN: "/home/richard/workspace/opencode/packages/core/src/config/plugin/command.ts",
  CONFIG_AGENT_PLUGIN: "/home/richard/workspace/opencode/packages/core/src/config/plugin/agent.ts",
  BUILTIN_COMMAND_PLUGIN: "/home/richard/workspace/opencode/packages/core/src/plugin/command.ts",
  MCP_CONFIG: "/home/richard/workspace/opencode/packages/core/src/config/mcp.ts",
} as const;

export const OPENCODE_COMPATIBILITY_DATA: OpenCodeCompatibilityRule[] = [
  {
    id: "opencode.skill.runtime-frontmatter",
    subject: "skill frontmatter",
    level: COMPATIBILITY_LEVEL.RUNTIME,
    confidence: OPENCODE_COMPATIBILITY_CONFIDENCE.OBSERVED_SOURCE,
    evidence: `${OPENCODE_OBSERVED_SOURCE_PATHS.SKILL} decodes name, optional description, and optional slash from markdown frontmatter.`,
  },
  {
    id: "opencode.config.layers",
    subject: "config layers",
    level: COMPATIBILITY_LEVEL.RUNTIME,
    confidence: OPENCODE_COMPATIBILITY_CONFIDENCE.OBSERVED_SOURCE,
    evidence: `${OPENCODE_OBSERVED_SOURCE_PATHS.CONFIG} loads global config, direct project config files, and .opencode directories; ${OPENCODE_OBSERVED_SOURCE_PATHS.GLOBAL} allows OPENCODE_CONFIG_DIR to replace the default global config directory.`,
  },
  {
    id: "opencode.command.precedence",
    subject: "command precedence across built-ins, config files, MCP prompts, and skills",
    level: COMPATIBILITY_LEVEL.RUNTIME,
    confidence: OPENCODE_COMPATIBILITY_CONFIDENCE.EXPLICIT_UNCERTAINTY,
    evidence: `${OPENCODE_OBSERVED_SOURCE_PATHS.BUILTIN_COMMAND_PLUGIN} and ${OPENCODE_OBSERVED_SOURCE_PATHS.CONFIG_COMMAND_PLUGIN} show built-in and config/file command registration, but this slice did not verify MCP prompt or skill slash command precedence in a running OpenCode instance.`,
    uncertainty: "Report collisions without auto-renaming and mark precedence unknown unless a future runtime check proves ordering.",
  },
];

export function openCodeCompatibilityRulesFor(subject: string): OpenCodeCompatibilityRule[] {
  return OPENCODE_COMPATIBILITY_DATA.filter((rule) => rule.subject === subject);
}
