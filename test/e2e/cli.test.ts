import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { isDirectInvocation, runCli, type CliRunInput } from "../../src/cli/index";

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CliFixture {
  root: string;
  projectDir: string;
  homeDir: string;
  skillRoot: string;
  invalidSkillFile: string;
}

describe("CLI JSON reports", () => {
  it("prints inventory with collisions and denied safety actions", async () => {
    const fixture = await createCliFixture();

    const result = await runCommand([
      "inventory",
      "--client",
      "opencode",
      "--project-dir",
      fixture.projectDir,
      "--home-dir",
      fixture.homeDir,
      "--skill-root",
      fixture.skillRoot,
    ]);

    expect(result.exitCode).toBe(0);
    expect(normalizeJson(result.stdout, fixture.root)).toMatchInlineSnapshot(`
      {
        "client": "opencode",
        "collisions": {
          "collisions": [
            {
              "entries": [
                {
                  "name": "review",
                  "sourceKind": "builtin",
                  "sources": [
                    {
                      "client": "opencode",
                      "id": "opencode:builtin-command:review",
                      "kind": "builtin",
                    },
                  ],
                },
                {
                  "name": "review",
                  "sourceKind": "config-command",
                  "sources": [
                    {
                      "client": "opencode",
                      "id": "opencode:config:project-dot-opencode:opencode.json:command:review",
                      "kind": "command",
                      "layer": "project",
                      "rootPath": "<fixture>/project/.opencode",
                      "sourcePath": "<fixture>/project/.opencode/opencode.json",
                    },
                  ],
                },
                {
                  "name": "review",
                  "sourceKind": "mcp-prompt",
                  "sources": [
                    {
                      "client": "opencode",
                      "id": "opencode:mcp:review",
                      "kind": "mcp",
                      "rootPath": "<fixture>/project/.opencode",
                      "sourcePath": "<fixture>/project/.opencode/opencode.json",
                    },
                  ],
                },
                {
                  "name": "review",
                  "sourceKind": "skill-command",
                  "sources": [
                    {
                      "client": "opencode",
                      "id": "opencode:<fixture>/skills/review/SKILL.md",
                      "kind": "skill",
                      "rootPath": "<fixture>/skills",
                      "sourcePath": "<fixture>/skills/review/SKILL.md",
                    },
                  ],
                },
                {
                  "name": "review",
                  "sourceKind": "markdown-command",
                  "sources": [
                    {
                      "client": "opencode",
                      "id": "opencode:command:review:<fixture>/project/.opencode/commands/review.md",
                      "kind": "command",
                      "layer": "project",
                      "rootPath": "<fixture>/project/.opencode",
                      "sourcePath": "<fixture>/project/.opencode/commands/review.md",
                    },
                  ],
                },
              ],
              "name": "review",
              "precedence": {
                "reason": "Command precedence across built-ins, config commands, markdown commands, MCP prompts, and skill commands cannot be verified by static inventory alone.",
                "status": "unknown",
              },
            },
          ],
        },
        "command": "inventory",
        "inventory": {
          "agents": [],
          "client": "opencode",
          "commands": [
            {
              "id": "opencode:command:review",
              "kind": "command",
              "name": "review",
              "sources": [
                {
                  "client": "opencode",
                  "id": "opencode:config:project-dot-opencode:opencode.json:command:review",
                  "kind": "command",
                  "layer": "project",
                  "rootPath": "<fixture>/project/.opencode",
                  "sourcePath": "<fixture>/project/.opencode/opencode.json",
                },
              ],
            },
            {
              "description": "Review command",
              "id": "opencode:command:review:<fixture>/project/.opencode/commands/review.md",
              "kind": "command",
              "name": "review",
              "sources": [
                {
                  "client": "opencode",
                  "id": "opencode:command:review:<fixture>/project/.opencode/commands/review.md",
                  "kind": "command",
                  "layer": "project",
                  "rootPath": "<fixture>/project/.opencode",
                  "sourcePath": "<fixture>/project/.opencode/commands/review.md",
                },
              ],
            },
          ],
          "mcpEntries": [
            {
              "id": "opencode:mcp:review",
              "kind": "mcp",
              "name": "review",
              "sources": [
                {
                  "client": "opencode",
                  "id": "opencode:config:project-dot-opencode:opencode.json:mcp:review",
                  "kind": "mcp",
                  "layer": "project",
                  "rootPath": "<fixture>/project/.opencode",
                  "sourcePath": "<fixture>/project/.opencode/opencode.json",
                },
              ],
            },
          ],
          "modes": [],
          "plugins": [
            {
              "id": "opencode:plugin:opencode-plugin-diagnostics:0",
              "kind": "plugin",
              "name": "opencode-plugin-diagnostics",
              "sources": [
                {
                  "client": "opencode",
                  "id": "opencode:config:project-dot-opencode:opencode.json:plugin:opencode-plugin-diagnostics:0",
                  "kind": "plugin",
                  "layer": "project",
                  "rootPath": "<fixture>/project/.opencode",
                  "sourcePath": "<fixture>/project/.opencode/opencode.json",
                },
              ],
            },
          ],
          "skills": [
            {
              "compatibility": [
                "runtime-compatible",
                "docs-compatible",
                "portable-compatible",
              ],
              "description": "Reviews code safely.",
              "identity": {
                "client": "opencode",
                "name": "review",
              },
              "sources": [
                {
                  "client": "opencode",
                  "id": "opencode:<fixture>/skills/review/SKILL.md",
                  "kind": "skill",
                  "rootPath": "<fixture>/skills",
                  "sourcePath": "<fixture>/skills/review/SKILL.md",
                },
              ],
              "status": "available",
            },
          ],
          "unavailableSources": [],
        },
        "safety": {
          "deniedActions": [
            "file-write",
            "config-write",
            "plugin-execute",
            "mcp-connect",
            "mcp-auth",
          ],
          "mode": "read-only",
          "note": "No files are mutated, plugins executed, MCP services connected, or config written without explicit approval.",
        },
      }
    `);
  });

  it("prints validation and repair plan reports", async () => {
    const fixture = await createCliFixture();

    const validation = await runCommand(["validate", "--client", "codex", "--skill-file", fixture.invalidSkillFile]);
    const repair = await runCommand(["plan-repair", "--client", "codex", "--skill-file", fixture.invalidSkillFile]);

    expect(validation.exitCode).toBe(0);
    expect(repair.exitCode).toBe(0);
    expect(normalizeJson(validation.stdout, fixture.root)).toMatchInlineSnapshot(`
      {
        "command": "validate",
        "result": {
          "compatibility": [
            "incompatible",
          ],
          "fields": {},
          "findings": [
            {
              "code": "skill.frontmatter.missing-opening-boundary",
              "level": "incompatible",
              "message": "SKILL.md is missing opening frontmatter delimiter.",
              "severity": "error",
              "sourceId": "<fixture>/invalid-skills/invalid/SKILL.md",
              "targetClient": "codex",
            },
          ],
        },
        "safety": {
          "deniedActions": [
            "file-write",
            "config-write",
            "plugin-execute",
            "mcp-connect",
            "mcp-auth",
          ],
          "mode": "read-only",
          "note": "No files are mutated, plugins executed, MCP services connected, or config written without explicit approval.",
        },
      }
    `);
    expect(normalizeJson(repair.stdout, fixture.root)).toMatchInlineSnapshot(`
      {
        "command": "plan-repair",
        "plan": {
          "diff": {
            "after": "---
      name: invalid
      description: Missing opening delimiter.
      ---
      Body.
      ",
            "before": "name: invalid
      description: Missing opening delimiter.
      ---
      Body.
      ",
            "kind": "insert-opening-delimiter",
          },
          "id": "codex:repair:<fixture>/invalid-skills/invalid/SKILL.md",
          "proposedContent": "---
      name: invalid
      description: Missing opening delimiter.
      ---
      Body.
      ",
          "requiresManualReview": false,
          "sourceId": "<fixture>/invalid-skills/invalid/SKILL.md",
          "sourcePath": "<fixture>/invalid-skills/invalid/SKILL.md",
          "status": "safe",
          "summary": "Add YAML frontmatter delimiters around existing author-provided fields.",
        },
        "safety": {
          "deniedActions": [
            "file-write",
            "config-write",
            "plugin-execute",
            "mcp-connect",
            "mcp-auth",
          ],
          "mode": "read-only",
          "note": "No files are mutated, plugins executed, MCP services connected, or config written without explicit approval.",
        },
      }
    `);
    expect(await readFile(fixture.invalidSkillFile, "utf8")).toBe("name: invalid\ndescription: Missing opening delimiter.\n---\nBody.\n");
  });

  it("prints activation profile reports through the thin TUI presenter boundary", async () => {
    const fixture = await createCliFixture();

    const result = await runCommand([
      "profile-report",
      "--client",
      "opencode",
      "--skill-root",
      fixture.skillRoot,
      "--profile-id",
      "reviewers",
      "--selected",
      "review",
      "--saturation-limit",
      "1",
    ]);

    expect(result.exitCode).toBe(0);
    expect(normalizeJson(result.stdout, fixture.root)).toMatchInlineSnapshot(`
      {
        "command": "profile-report",
        "profile": {
          "duplicated": [],
          "inactive": [],
          "incompatible": [],
          "profileId": "reviewers",
          "recommendation": "Refine the profile to reduce medium saturation risk; no skills are disabled automatically.",
          "risk": "medium",
          "selected": [
            {
              "client": "opencode",
              "name": "review",
            },
          ],
        },
        "safety": {
          "deniedActions": [
            "file-write",
            "config-write",
            "plugin-execute",
            "mcp-connect",
            "mcp-auth",
          ],
          "mode": "read-only",
          "note": "No files are mutated, plugins executed, MCP services connected, or config written without explicit approval.",
        },
      }
    `);
  });

  it("detects direct execution through an npm bin symlink", async () => {
    const root = await mkdtemp(join(tmpdir(), "tui-skills-bin-"));
    const cliSourcePath = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url));
    const binPath = join(root, "tui-skills");

    await symlink(cliSourcePath, binPath);

    expect(isDirectInvocation(pathToFileURL(cliSourcePath).href, binPath)).toBe(true);
  });
});

async function runCommand(argv: string[]): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const input: CliRunInput = {
    argv,
    stdout: (chunk) => {
      stdout += chunk;
    },
    stderr: (chunk) => {
      stderr += chunk;
    },
  };
  const exitCode = await runCli(input);

  return { exitCode, stdout, stderr };
}

async function createCliFixture(): Promise<CliFixture> {
  const root = await mkdtemp(join(tmpdir(), "tui-skills-cli-"));
  const projectDir = join(root, "project");
  const homeDir = join(root, "home");
  const skillRoot = join(root, "skills");
  const validSkillDir = join(skillRoot, "review");
  const invalidSkillDir = join(root, "invalid-skills", "invalid");
  const dotOpenCodeDir = join(projectDir, ".opencode");
  const invalidSkillFile = join(invalidSkillDir, "SKILL.md");

  await Promise.all([
    mkdir(validSkillDir, { recursive: true }),
    mkdir(invalidSkillDir, { recursive: true }),
    mkdir(join(dotOpenCodeDir, "commands"), { recursive: true }),
    mkdir(homeDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(validSkillDir, "SKILL.md"), "---\nname: review\ndescription: Reviews code safely.\n---\nBody.\n"),
    writeFile(invalidSkillFile, "name: invalid\ndescription: Missing opening delimiter.\n---\nBody.\n"),
    writeFile(
      join(dotOpenCodeDir, "opencode.json"),
      JSON.stringify({
        commands: { review: { template: "Review" } },
        plugins: ["opencode-plugin-diagnostics"],
        mcp: { servers: { review: { type: "local", command: ["node", "server.js"] } } },
      }),
    ),
    writeFile(join(dotOpenCodeDir, "commands", "review.md"), "---\ndescription: Review command\n---\nReview."),
  ]);

  return { root, projectDir, homeDir, skillRoot, invalidSkillFile };
}

function normalizeJson(output: string, fixtureRoot: string): unknown {
  return normalizeValue(JSON.parse(output), fixtureRoot);
}

function normalizeValue(value: unknown, fixtureRoot: string): unknown {
  if (typeof value === "string") return value.replaceAll(fixtureRoot, "<fixture>");
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item, fixtureRoot));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeValue(nested, fixtureRoot)]),
    );
  }

  return value;
}
