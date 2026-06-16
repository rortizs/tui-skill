import { CLIENT_ID, SOURCE_KIND, type SourceKind, type SourceProvenance } from "../domain/inventory";

export const COMMAND_SOURCE_KIND = {
  BUILTIN: "builtin",
  CONFIG_COMMAND: "config-command",
  MARKDOWN_COMMAND: "markdown-command",
  MCP_PROMPT: "mcp-prompt",
  SKILL_COMMAND: "skill-command",
} as const;

export type CommandSourceKind = (typeof COMMAND_SOURCE_KIND)[keyof typeof COMMAND_SOURCE_KIND];

export const COMMAND_PRECEDENCE_STATUS = {
  KNOWN: "known",
  UNKNOWN: "unknown",
} as const;

export type CommandPrecedenceStatus = (typeof COMMAND_PRECEDENCE_STATUS)[keyof typeof COMMAND_PRECEDENCE_STATUS];

export const OPENCODE_BUILTIN_COMMAND_NAMES = ["init", "review"] as const;

export interface CommandProjectionSourceInput {
  id: string;
  kind: SourceKind;
  rootPath?: string;
  sourcePath?: string;
}

export interface CommandProjection {
  name: string;
  sourceKind: CommandSourceKind;
  sources: SourceProvenance[];
}

export interface KnownCommandPrecedence {
  status: typeof COMMAND_PRECEDENCE_STATUS.KNOWN;
  order: CommandSourceKind[];
  reason: string;
}

export interface UnknownCommandPrecedence {
  status: typeof COMMAND_PRECEDENCE_STATUS.UNKNOWN;
  reason: string;
}

export type CommandPrecedence = KnownCommandPrecedence | UnknownCommandPrecedence;

export interface CommandCollisionGroup {
  name: string;
  entries: CommandProjection[];
  precedence: CommandPrecedence;
}

export interface CommandCollisionReport {
  collisions: CommandCollisionGroup[];
}

export interface AnalyzeCommandCollisionsInput {
  projections: CommandProjection[];
  knownPrecedence?: Record<string, KnownCommandPrecedence>;
}

export function builtinCommandProjections(names: readonly string[]): CommandProjection[] {
  return names.map((name) =>
    commandProjection(name, COMMAND_SOURCE_KIND.BUILTIN, {
      id: `opencode:builtin-command:${name}`,
      kind: SOURCE_KIND.BUILTIN,
    }),
  );
}

export function commandProjection(
  name: string,
  sourceKind: CommandSourceKind,
  source: CommandProjectionSourceInput,
): CommandProjection {
  const provenance: SourceProvenance = {
    id: source.id,
    client: CLIENT_ID.OPENCODE,
    kind: source.kind,
    ...(source.rootPath ? { rootPath: source.rootPath } : {}),
    ...(source.sourcePath ? { sourcePath: source.sourcePath } : {}),
  };

  return { name, sourceKind, sources: [provenance] };
}

export function analyzeCommandCollisions(input: AnalyzeCommandCollisionsInput): CommandCollisionReport {
  const byName = new Map<string, CommandProjection[]>();

  for (const projection of input.projections) {
    const existing = byName.get(projection.name) ?? [];
    existing.push(projection);
    byName.set(projection.name, existing);
  }

  const collisions = [...byName.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([name, entries]) => ({
      name,
      entries,
      precedence: input.knownPrecedence?.[name] ?? unknownPrecedence(),
    }));

  return { collisions };
}

function unknownPrecedence(): UnknownCommandPrecedence {
  return {
    status: COMMAND_PRECEDENCE_STATUS.UNKNOWN,
    reason:
      "Command precedence across built-ins, config commands, markdown commands, MCP prompts, and skill commands cannot be verified by static inventory alone.",
  };
}
