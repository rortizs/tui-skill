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

  it("prints a doctor report that composes inventory validation collisions profile and repair guidance", async () => {
    const fixture = await createCliFixture();
    const brokenSkillDir = join(fixture.skillRoot, "broken");
    const brokenSkillFile = join(brokenSkillDir, "SKILL.md");

    await mkdir(brokenSkillDir, { recursive: true });
    await writeFile(brokenSkillFile, "name: broken\ndescription: Needs delimiter repair.\n---\nBody.\n");

    const result = await runCommand([
      "doctor",
      "--client",
      "opencode",
      "--project-dir",
      fixture.projectDir,
      "--home-dir",
      fixture.homeDir,
      "--skill-root",
      fixture.skillRoot,
      "--selected",
      "review",
      "--saturation-limit",
      "1",
    ]);

    expect(result.exitCode).toBe(0);
    expect(normalizeJson(result.stdout, fixture.root)).toMatchInlineSnapshot(`
      {
        "client": "opencode",
        "collisions": {
          "names": [
            "review",
          ],
          "total": 1,
        },
        "command": "doctor",
        "inventory": {
          "skills": {
            "available": 1,
            "duplicate": 0,
            "invalid": 1,
            "roots": {
              "count": 1,
              "paths": [
                "<fixture>/skills",
              ],
            },
            "total": 2,
            "unavailableSources": 0,
          },
          "surfaces": {
            "agents": 0,
            "commands": 2,
            "mcpEntries": 1,
            "modes": 0,
            "plugins": 1,
          },
        },
        "kind": "doctor-report",
        "profile": {
          "duplicated": [],
          "inactive": [],
          "incompatible": [
            {
              "client": "opencode",
              "name": "broken",
            },
          ],
          "profileId": "default",
          "recommendation": "Refine the profile to reduce medium saturation risk; no skills are disabled automatically.",
          "risk": "medium",
          "selected": [
            {
              "client": "opencode",
              "name": "review",
            },
          ],
        },
        "repair": {
          "manualReviewRequired": [],
          "mutatesFiles": false,
          "safePlans": [
            {
              "sourcePath": "<fixture>/skills/broken/SKILL.md",
              "status": "safe",
              "summary": "Add YAML frontmatter delimiters around existing author-provided fields.",
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
        "validation": {
          "diagnostics": [
            {
              "findings": [
                {
                  "code": "skill.frontmatter.missing-opening-boundary",
                  "level": "incompatible",
                  "message": "SKILL.md is missing opening frontmatter delimiter.",
                  "severity": "error",
                  "sourceId": "opencode:<fixture>/skills/broken/SKILL.md",
                  "targetClient": "opencode",
                },
              ],
              "name": "broken",
              "sourcePath": "<fixture>/skills/broken/SKILL.md",
            },
          ],
          "invalidSkills": [
            {
              "findings": [
                {
                  "code": "skill.frontmatter.missing-opening-boundary",
                  "level": "incompatible",
                  "message": "SKILL.md is missing opening frontmatter delimiter.",
                  "severity": "error",
                  "sourceId": "opencode:<fixture>/skills/broken/SKILL.md",
                  "targetClient": "opencode",
                },
              ],
              "name": "broken",
              "sourcePath": "<fixture>/skills/broken/SKILL.md",
            },
          ],
          "summary": {
            "errors": 1,
            "invalid": 1,
            "warnings": 0,
          },
        },
      }
    `);
    expect(await readFile(brokenSkillFile, "utf8")).toBe("name: broken\ndescription: Needs delimiter repair.\n---\nBody.\n");
  });

  it("includes warning-only validation findings for loadable skills in doctor reports", async () => {
    const fixture = await createCliFixture();
    const runtimeOnlySkillDir = join(fixture.skillRoot, "runtime-only");

    await mkdir(runtimeOnlySkillDir, { recursive: true });
    await writeFile(join(runtimeOnlySkillDir, "SKILL.md"), "---\nname: runtime-only\n---\nBody.\n");

    const result = await runCommand([
      "doctor",
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
    const report = normalizeJson(result.stdout, fixture.root) as {
      validation: {
        summary: { errors: number; invalid: number; warnings: number };
        diagnostics: Array<{ findings: Array<{ code: string; severity: string }>; name: string; sourcePath?: string }>;
        invalidSkills: Array<{ findings: Array<{ code: string; severity: string }>; name: string; sourcePath?: string }>;
      };
    };

    expect(report.validation.summary).toEqual({ errors: 0, invalid: 0, warnings: 1 });
    expect(report.validation.invalidSkills).toEqual([]);
    expect(report.validation.diagnostics).toEqual([
      {
        findings: [expect.objectContaining({ code: "skill.frontmatter.missing-docs-field", severity: "warning" })],
        name: "runtime-only",
        sourcePath: "<fixture>/skills/runtime-only/SKILL.md",
      },
    ]);
  });

  it("diagnoses only the skill root selected with doctor --root", async () => {
    const fixture = await createCliFixture();
    const scopedRoot = join(fixture.root, "scoped-skills");

    await mkdir(join(scopedRoot, "scoped"), { recursive: true });
    await writeFile(join(scopedRoot, "scoped", "SKILL.md"), "---\nname: scoped\ndescription: Scoped diagnostic skill.\n---\nBody.\n");

    const result = await runCommand([
      "doctor",
      "--client",
      "opencode",
      "--project-dir",
      fixture.projectDir,
      "--home-dir",
      fixture.homeDir,
      "--root",
      scopedRoot,
    ]);

    expect(result.exitCode).toBe(0);
    const report = normalizeJson(result.stdout, fixture.root) as {
      inventory: { skills: { roots: { count: number; paths: string[] }; total: number; available: number; invalid: number } };
      validation: { summary: { errors: number; invalid: number; warnings: number } };
    };

    expect(report.inventory.skills.roots).toEqual({ count: 1, paths: ["<fixture>/scoped-skills"] });
    expect(report.inventory.skills.total).toBe(1);
    expect(report.inventory.skills.available).toBe(1);
    expect(report.inventory.skills.invalid).toBe(0);
    expect(report.validation.summary).toEqual({ errors: 0, invalid: 0, warnings: 0 });
  });

  it("returns a JSON error when doctor --root is not readable", async () => {
    const fixture = await createCliFixture();
    const missingRoot = join(fixture.root, "missing-skills");

    const result = await runCommand(["doctor", "--client", "opencode", "--root", missingRoot]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(normalizeJson(result.stderr, fixture.root)).toEqual({
      command: "doctor",
      error: {
        message: "Skill root is not readable.",
        option: "--root",
        path: "<fixture>/missing-skills",
      },
      kind: "error-report",
    });
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
