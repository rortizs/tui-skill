import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

interface PackageManifest {
  name?: string;
  version?: string;
  private?: boolean;
  description?: string;
  type?: string;
  license?: string;
  repository?: PackageRepository;
  engines?: Record<string, string>;
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
}

interface PackageRepository {
  type?: string;
  url?: string;
}

interface TsConfigFile {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
}

interface MissingImportExtension {
  filePath: string;
  specifier: string;
}

const STATIC_IMPORT_PATTERN = /\bfrom\s+["'](\.{1,2}\/[^"']+)["']|import\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

describe("npm package metadata", () => {
  it("publishes the built CLI from a constrained package", async () => {
    const manifest = await readPackageManifest();

    expect(manifest.private).not.toBe(true);
    expect(manifest.bin).toEqual({ "tui-skills": "./dist/cli/index.js" });
    expect(manifest.files).toEqual(["dist", "docs", "README.md"]);
    expect(manifest.scripts?.clean).toBe("node -e \"require('node:fs').rmSync('dist', { recursive: true, force: true })\"");
    expect(manifest.scripts?.prebuild).toBe("npm run clean");
    expect(manifest.scripts?.build).toBe("tsc -p tsconfig.json");
    expect(manifest.scripts?.prepack).toBe("npm run build");
  });

  it("declares consumer-facing package metadata", async () => {
    const manifest = await readPackageManifest();

    expect(manifest.name).toBe("tui-skills");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.description).toBeTruthy();
    expect(manifest.type).toBe("module");
    expect(manifest.license).toBe("UNLICENSED");
    expect(manifest.repository).toEqual({ type: "git", url: "git+https://github.com/rortizs/tui-skill.git" });
    expect(manifest.engines?.node).toBe(">=20");
  });

  it("keeps the production build output aligned with the CLI bin target", async () => {
    const tsconfig = await readJsonFile<TsConfigFile>("tsconfig.json");
    const testTsconfig = await readJsonFile<TsConfigFile>("tsconfig.test.json");

    expect(tsconfig.compilerOptions?.rootDir).toBe("src");
    expect(tsconfig.compilerOptions?.outDir).toBe("dist");
    expect(tsconfig.include).toEqual(["src/**/*.ts"]);
    expect(testTsconfig.compilerOptions?.rootDir).toBe(".");
  });

  it("uses Node-compatible JavaScript extensions for runtime source imports", async () => {
    const files = await sourceFiles(resolve(projectRoot(), "src"));
    const missingExtensions = await missingRuntimeImportExtensions(files);

    expect(missingExtensions).toEqual([]);
  });
});

async function readPackageManifest(): Promise<PackageManifest> {
  return readJsonFile<PackageManifest>("package.json");
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const packagePath = resolve(projectRoot(), relativePath);
  const content = await readFile(packagePath, "utf8");

  return JSON.parse(content) as T;
}

async function sourceFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(rootPath, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return entry.name.endsWith(".ts") ? [entryPath] : [];
    }),
  );

  return nested.flat();
}

async function missingRuntimeImportExtensions(files: string[]): Promise<MissingImportExtension[]> {
  const results = await Promise.all(files.map(missingRuntimeImportExtensionsInFile));

  return results.flat();
}

async function missingRuntimeImportExtensionsInFile(filePath: string): Promise<MissingImportExtension[]> {
  const content = await readFile(filePath, "utf8");
  const matches = content.matchAll(STATIC_IMPORT_PATTERN);

  return Array.from(matches)
    .map((match) => match[1] ?? match[2])
    .filter((specifier): specifier is string => typeof specifier === "string" && !specifier.endsWith(".js"))
    .map((specifier) => ({ filePath: filePath.replace(`${projectRoot()}/`, ""), specifier }));
}

function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}
