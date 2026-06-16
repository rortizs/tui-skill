import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import {
  CLIENT_ID,
  SOURCE_KIND,
  type InventoryReport,
  type NamedSurfaceRecord,
  type SourceKind,
  type SourceProvenance,
  type UnavailableSource,
} from "../../domain/inventory";
import type { OpenCodeConfigDiscovery, OpenCodeConfigDirectory, OpenCodeConfigDocument } from "./config";

export const OPENCODE_SKILL_SOURCE_TYPE = {
  DIRECTORY: "directory",
  URL: "url",
} as const;

export type OpenCodeSkillSourceType = (typeof OPENCODE_SKILL_SOURCE_TYPE)[keyof typeof OPENCODE_SKILL_SOURCE_TYPE];

export interface OpenCodeSurfaceInventoryInput {
  config: OpenCodeConfigDiscovery;
  projectDir: string;
  homeDir: string;
}

export interface OpenCodeSkillSourceRecord {
  type: OpenCodeSkillSourceType;
  value: string;
  provenance: SourceProvenance;
}

export interface OpenCodePermissionRecord {
  action: string;
  resource: string;
  effect: string;
  provenance: SourceProvenance;
}

export interface OpenCodeSurfaceInventory {
  report: InventoryReport;
  skillSources: OpenCodeSkillSourceRecord[];
  permissions: OpenCodePermissionRecord[];
}

interface MarkdownSurfaceFile {
  directory: OpenCodeConfigDirectory;
  filePath: string;
  kind: SourceKind;
  stripPrefix: RegExp;
}

export async function inventoryOpenCodeSurfaces(input: OpenCodeSurfaceInventoryInput): Promise<OpenCodeSurfaceInventory> {
  const report = createEmptyOpenCodeReport();
  const permissions: OpenCodePermissionRecord[] = [];
  const skillSources = collectSkillSources(input);

  for (const document of input.config.documents) {
    report.commands.push(...commandsFromConfigDocument(document));
    report.agents.push(...agentsFromConfigDocument(document));
    report.plugins.push(...pluginsFromConfigDocument(document));
    report.mcpEntries.push(...mcpFromConfigDocument(document));
    permissions.push(...permissionsFromConfigDocument(document));
  }

  for (const directory of input.config.directories) {
    const surfaces = await surfacesFromDirectory(directory, report.unavailableSources);
    report.agents.push(...surfaces.agents);
    report.modes.push(...surfaces.modes);
    report.commands.push(...surfaces.commands);
  }

  return { report, skillSources: dedupeSkillSources(skillSources), permissions };
}

function createEmptyOpenCodeReport(): InventoryReport {
  return {
    client: CLIENT_ID.OPENCODE,
    skills: [],
    agents: [],
    modes: [],
    commands: [],
    plugins: [],
    mcpEntries: [],
    unavailableSources: [],
  };
}

function collectSkillSources(input: OpenCodeSurfaceInventoryInput): OpenCodeSkillSourceRecord[] {
  const sources: OpenCodeSkillSourceRecord[] = [];

  for (const directory of input.config.directories) {
    sources.push(skillDirectorySource(join(directory.directory, "skill"), directory.provenance));
    sources.push(skillDirectorySource(join(directory.directory, "skills"), directory.provenance));
  }

  for (const document of input.config.documents) {
    for (const item of stringArray(document.info.skills)) {
      sources.push(skillSourceFromConfigItem(item, document, input.projectDir, input.homeDir));
    }
  }

  return sources;
}

function skillDirectorySource(value: string, provenance: SourceProvenance): OpenCodeSkillSourceRecord {
  return { type: OPENCODE_SKILL_SOURCE_TYPE.DIRECTORY, value, provenance };
}

function skillSourceFromConfigItem(
  item: string,
  document: OpenCodeConfigDocument,
  projectDir: string,
  homeDir: string,
): OpenCodeSkillSourceRecord {
  const provenance = document.provenance;

  if (URL.canParse(item) && ["http:", "https:"].includes(new URL(item).protocol)) {
    return { type: OPENCODE_SKILL_SOURCE_TYPE.URL, value: item, provenance };
  }

  if (item.startsWith("~/")) {
    return skillDirectorySource(join(homeDir, item.slice(2)), provenance);
  }

  if (item.startsWith("/")) {
    return skillDirectorySource(item, provenance);
  }

  return skillDirectorySource(join(projectDir, item), provenance);
}

async function surfacesFromDirectory(
  directory: OpenCodeConfigDirectory,
  unavailableSources: UnavailableSource[],
): Promise<Pick<InventoryReport, "agents" | "modes" | "commands">> {
  try {
    const files = await collectMarkdownSurfaceFiles(directory);
    const records = await Promise.all(files.map(readMarkdownSurface));

    return {
      agents: records.filter((record) => record.kind === SOURCE_KIND.AGENT),
      modes: records.filter((record) => record.kind === SOURCE_KIND.MODE),
      commands: records.filter((record) => record.kind === SOURCE_KIND.COMMAND),
    };
  } catch (error) {
    unavailableSources.push({
      provenance: directory.provenance,
      reason: `OpenCode surface directory is not readable: ${errorMessage(error)}`,
    });
    return { agents: [], modes: [], commands: [] };
  }
}

async function collectMarkdownSurfaceFiles(directory: OpenCodeConfigDirectory): Promise<MarkdownSurfaceFile[]> {
  const agents = await markdownFilesFor(directory, ["agent", "agents"], SOURCE_KIND.AGENT, /^(agent|agents)\//);
  const modes = await markdownFilesFor(directory, ["mode", "modes"], SOURCE_KIND.MODE, /^(mode|modes)\//);
  const commands = await markdownFilesFor(directory, ["command", "commands"], SOURCE_KIND.COMMAND, /^(command|commands)\//);

  return [...agents, ...modes, ...commands];
}

async function markdownFilesFor(
  directory: OpenCodeConfigDirectory,
  names: string[],
  kind: SourceKind,
  stripPrefix: RegExp,
): Promise<MarkdownSurfaceFile[]> {
  const nestedFiles = await Promise.all(names.map((name) => collectMarkdownFiles(join(directory.directory, name))));
  return nestedFiles.flat().map((filePath) => ({ directory, filePath, kind, stripPrefix }));
}

async function collectMarkdownFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) return collectMarkdownFiles(entryPath);
        if (entry.isFile() && entry.name.endsWith(".md")) return [entryPath];
        return [];
      }),
    );

    return nested.flat().sort();
  } catch {
    return [];
  }
}

async function readMarkdownSurface(file: MarkdownSurfaceFile): Promise<NamedSurfaceRecord> {
  const content = await readFile(file.filePath, "utf8");
  const frontmatter = parseMarkdownFrontmatter(content);
  const name = relative(file.directory.directory, file.filePath).replaceAll("\\", "/").replace(file.stripPrefix, "").replace(/\.md$/, "");
  const id = `opencode:${file.kind}:${name}:${file.filePath}`;

  return {
    id,
    name,
    kind: file.kind,
    sources: [
      {
        id,
        client: CLIENT_ID.OPENCODE,
        kind: file.kind,
        ...(file.directory.provenance.layer ? { layer: file.directory.provenance.layer } : {}),
        rootPath: file.directory.directory,
        sourcePath: file.filePath,
      },
    ],
    ...(frontmatter.description ? { description: frontmatter.description } : {}),
  };
}

function commandsFromConfigDocument(document: OpenCodeConfigDocument): NamedSurfaceRecord[] {
  return Object.keys(record(document.info.commands)).map((name) => namedSurfaceFromDocument(document, SOURCE_KIND.COMMAND, name));
}

function agentsFromConfigDocument(document: OpenCodeConfigDocument): NamedSurfaceRecord[] {
  return Object.keys(record(document.info.agents)).map((name) => namedSurfaceFromDocument(document, SOURCE_KIND.AGENT, name));
}

function pluginsFromConfigDocument(document: OpenCodeConfigDocument): NamedSurfaceRecord[] {
  return array(document.info.plugins).flatMap((plugin, index) => {
    const name = pluginName(plugin);
    if (!name) return [];
    return [namedSurfaceFromDocument(document, SOURCE_KIND.PLUGIN, name, index)];
  });
}

function mcpFromConfigDocument(document: OpenCodeConfigDocument): NamedSurfaceRecord[] {
  const mcp = record(document.info.mcp);
  const servers = record(mcp.servers);
  return Object.keys(servers).map((name) => namedSurfaceFromDocument(document, SOURCE_KIND.MCP, name));
}

function permissionsFromConfigDocument(document: OpenCodeConfigDocument): OpenCodePermissionRecord[] {
  return array(document.info.permissions).flatMap((permission, index) => {
    const value = record(permission);
    const action = stringValue(value.action);
    const resource = stringValue(value.resource);
    const effect = stringValue(value.effect);

    if (!action || !resource || !effect) return [];

    return [{ action, resource, effect, provenance: sourceFromDocument(document, SOURCE_KIND.CONFIG, `permission:${index}`) }];
  });
}

function namedSurfaceFromDocument(
  document: OpenCodeConfigDocument,
  kind: SourceKind,
  name: string,
  index?: number,
): NamedSurfaceRecord {
  const suffix = index === undefined ? name : `${name}:${index}`;
  return {
    id: `opencode:${kind}:${suffix}`,
    name,
    kind,
    sources: [sourceFromDocument(document, kind, suffix)],
  };
}

function sourceFromDocument(document: OpenCodeConfigDocument, kind: SourceKind, suffix: string): SourceProvenance {
  return {
    id: `${document.provenance.id}:${kind}:${suffix}`,
    client: CLIENT_ID.OPENCODE,
    kind,
    ...(document.provenance.layer ? { layer: document.provenance.layer } : {}),
    rootPath: document.directory,
    ...(document.provenance.sourcePath ? { sourcePath: document.provenance.sourcePath } : {}),
  };
}

function parseMarkdownFrontmatter(content: string): Record<string, string> {
  const lines = content.replaceAll("\r\n", "\n").split("\n");

  if (lines[0]?.trim() !== "---") return {};

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex < 0) return {};

  const result: Record<string, string> = {};
  for (const line of lines.slice(1, closingIndex)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    const key = match?.[1];
    if (key) result[key] = match[2]?.trim() ?? "";
  }
  return result;
}

function dedupeSkillSources(sources: OpenCodeSkillSourceRecord[]): OpenCodeSkillSourceRecord[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.type}:${source.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pluginName(plugin: unknown): string | undefined {
  if (typeof plugin === "string") return plugin;
  return stringValue(record(plugin).package);
}

function stringArray(value: unknown): string[] {
  return array(value).filter((item): item is string => typeof item === "string");
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
