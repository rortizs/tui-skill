import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { CLIENT_ID, CONFIG_LAYER, SOURCE_KIND, type ConfigLayer, type SourceProvenance } from "../../domain/inventory";

export const OPENCODE_CONFIG_FILE_NAME = {
  LEGACY: "config.json",
  JSON: "opencode.json",
  JSONC: "opencode.jsonc",
} as const;

export type OpenCodeConfigFileName = (typeof OPENCODE_CONFIG_FILE_NAME)[keyof typeof OPENCODE_CONFIG_FILE_NAME];

export interface OpenCodeConfigInput {
  projectDir: string;
  globalConfigDir?: string;
  envConfigDir?: string;
  configFileNames?: OpenCodeConfigFileName[];
}

export interface OpenCodeConfigDocument {
  provenance: SourceProvenance;
  directory: string;
  fileName: OpenCodeConfigFileName;
  info: Record<string, unknown>;
}

export interface OpenCodeConfigDirectory {
  provenance: SourceProvenance;
  directory: string;
}

export interface OpenCodeConfigUnavailableSource {
  provenance: SourceProvenance;
  reason: string;
}

export interface OpenCodeConfigDiscovery {
  documents: OpenCodeConfigDocument[];
  directories: OpenCodeConfigDirectory[];
  unavailableSources: OpenCodeConfigUnavailableSource[];
}

const DEFAULT_CONFIG_FILE_NAMES: OpenCodeConfigFileName[] = [
  OPENCODE_CONFIG_FILE_NAME.LEGACY,
  OPENCODE_CONFIG_FILE_NAME.JSON,
  OPENCODE_CONFIG_FILE_NAME.JSONC,
];

export async function discoverOpenCodeConfig(input: OpenCodeConfigInput): Promise<OpenCodeConfigDiscovery> {
  const fileNames = input.configFileNames ?? DEFAULT_CONFIG_FILE_NAMES;
  const discovery: OpenCodeConfigDiscovery = { documents: [], directories: [], unavailableSources: [] };

  if (input.globalConfigDir) {
    await readConfigDirectory(discovery, input.globalConfigDir, CONFIG_LAYER.GLOBAL, fileNames, "global");
  }

  if (input.envConfigDir) {
    await readConfigDirectory(discovery, input.envConfigDir, CONFIG_LAYER.CUSTOM, fileNames, "OPENCODE_CONFIG_DIR");
  }

  await readProjectConfig(discovery, input.projectDir, fileNames);

  return discovery;
}

async function readProjectConfig(
  discovery: OpenCodeConfigDiscovery,
  projectDir: string,
  fileNames: OpenCodeConfigFileName[],
): Promise<void> {
  await readConfigFiles(discovery, projectDir, CONFIG_LAYER.PROJECT, fileNames, "project");
  await readConfigDirectory(discovery, join(projectDir, ".opencode"), CONFIG_LAYER.PROJECT, fileNames, "project-dot-opencode");
}

async function readConfigDirectory(
  discovery: OpenCodeConfigDiscovery,
  directory: string,
  layer: ConfigLayer,
  fileNames: OpenCodeConfigFileName[],
  idPrefix: string,
): Promise<void> {
  discovery.directories.push({
    directory,
    provenance: {
      id: `opencode:config-directory:${idPrefix}`,
      client: CLIENT_ID.OPENCODE,
      kind: SOURCE_KIND.CONFIG,
      layer,
      rootPath: directory,
    },
  });
  await readConfigFiles(discovery, directory, layer, fileNames, idPrefix);
}

async function readConfigFiles(
  discovery: OpenCodeConfigDiscovery,
  directory: string,
  layer: ConfigLayer,
  fileNames: OpenCodeConfigFileName[],
  idPrefix: string,
): Promise<void> {
  await Promise.all(
    fileNames.map(async (fileName) => {
      const sourcePath = join(directory, fileName);

      try {
        const content = await readFile(sourcePath, "utf8");
        discovery.documents.push({
          directory,
          fileName,
          info: parseJsonConfig(content),
          provenance: {
            id: `opencode:config:${idPrefix}:${fileName}`,
            client: CLIENT_ID.OPENCODE,
            kind: SOURCE_KIND.CONFIG,
            layer,
            rootPath: directory,
            sourcePath,
          },
        });
      } catch (error) {
        if (isMissingFileError(error)) return;
        discovery.unavailableSources.push({
          provenance: {
            id: `opencode:config:${idPrefix}:${fileName}`,
            client: CLIENT_ID.OPENCODE,
            kind: SOURCE_KIND.CONFIG,
            layer,
            rootPath: directory,
            sourcePath,
          },
          reason: `OpenCode config source is not readable: ${errorMessage(error)}`,
        });
      }
    }),
  );
}

function parseJsonConfig(content: string): Record<string, unknown> {
  const parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(content)) as unknown;

  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return {};
}

function stripJsonCommentsAndTrailingCommas(content: string): string {
  const withoutComments = stripJsonComments(content);
  return withoutComments.replace(/,\s*([}\]])/g, "$1");
}

function stripJsonComments(content: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index] ?? "";
    const next = content[index + 1] ?? "";

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        output += current;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inString && current === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (!inString && current === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += current;

    if (current === "\\" && !escaped) {
      escaped = true;
      continue;
    }

    if (current === '"' && !escaped) {
      inString = !inString;
    }

    escaped = false;
  }

  return output;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
