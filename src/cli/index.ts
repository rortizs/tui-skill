#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { discoverOpenCodeConfig } from "../adapters/opencode/config.js";
import { inventoryOpenCodeSurfaces } from "../adapters/opencode/surfaces.js";
import { APPROVAL_DECISION, SIDE_EFFECT } from "../domain/approval.js";
import { COMPATIBILITY_LEVEL, VALIDATION_SEVERITY } from "../domain/compatibility.js";
import {
  CLIENT_ID,
  LOAD_STATUS,
  SOURCE_KIND,
  type ClientId,
  type InventoryReport,
  type SkillIdentity,
  type SkillRecord,
} from "../domain/inventory.js";
import { PROFILE_SKILL_STATE, type ActivationProfile } from "../domain/profiles.js";
import { buildActivationProfileGuidance } from "../services/activation-profile-service.js";
import {
  COMMAND_SOURCE_KIND,
  OPENCODE_BUILTIN_COMMAND_NAMES,
  analyzeCommandCollisions,
  builtinCommandProjections,
  type CommandProjection,
  type CommandSourceKind,
} from "../services/collision-analyzer.js";
import { inventorySkills, type SkillInventoryRoot } from "../services/inventory-service.js";
import { REPAIR_PLAN_STATUS, planSkillRepair } from "../services/repair-planner.js";
import { requireApprovedSideEffect } from "../services/safety-service.js";
import { validateSkillFile } from "../services/validation-service.js";
import { presentJsonReport } from "../tui/boundary.js";

export interface CliRunInput {
  argv?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
}

interface ParsedArguments {
  command?: string;
  options: Record<string, string[]>;
}

interface SafetySummary {
  mode: "read-only";
  deniedActions: string[];
  note: string;
}

interface OpenCodeInventoryResult {
  inventory: InventoryReport;
  collisions: ReturnType<typeof analyzeCommandCollisions>;
}

const CLI_COMMAND = {
  INVENTORY: "inventory",
  VALIDATE: "validate",
  PLAN_REPAIR: "plan-repair",
  PROFILE_REPORT: "profile-report",
  DOCTOR: "doctor",
} as const;

type CliCommand = (typeof CLI_COMMAND)[keyof typeof CLI_COMMAND];

interface DoctorReport {
  kind: "doctor-report";
  command: typeof CLI_COMMAND.DOCTOR;
  client: ClientId;
  inventory: DoctorInventorySummary;
  validation: DoctorValidationSummary;
  collisions?: DoctorCollisionSummary;
  profile: ReturnType<typeof buildActivationProfileGuidance>;
  repair: DoctorRepairSummary;
  safety: SafetySummary;
}

interface DoctorInventorySummary {
  skills: DoctorSkillInventorySummary;
  surfaces: DoctorSurfaceInventorySummary;
}

interface DoctorSkillInventorySummary {
  total: number;
  available: number;
  duplicate: number;
  invalid: number;
  unavailableSources: number;
}

interface DoctorSurfaceInventorySummary {
  agents: number;
  modes: number;
  commands: number;
  plugins: number;
  mcpEntries: number;
}

interface DoctorValidationSummary {
  summary: {
    invalid: number;
    warnings: number;
    errors: number;
  };
  diagnostics: DoctorSkillValidationDiagnostic[];
  invalidSkills: DoctorSkillValidationDiagnostic[];
}

interface DoctorSkillValidationDiagnostic {
  name: string;
  sourcePath?: string;
  findings: ReturnType<typeof validateSkillFile>["findings"];
}

interface DoctorCollisionSummary {
  total: number;
  names: string[];
}

interface DoctorRepairSummary {
  mutatesFiles: false;
  safePlans: DoctorRepairPlanSummary[];
  manualReviewRequired: DoctorRepairPlanSummary[];
}

interface DoctorRepairPlanSummary {
  sourcePath: string;
  status: ReturnType<typeof planSkillRepair>["status"];
  summary: string;
}

const SAFETY_NOTE = "No files are mutated, plugins executed, MCP services connected, or config written without explicit approval.";

export async function runCli(input: CliRunInput = {}): Promise<number> {
  const parsed = parseArguments(input.argv ?? process.argv.slice(2));
  const output = input.stdout ?? ((chunk) => process.stdout.write(chunk));
  const errorOutput = input.stderr ?? ((chunk) => process.stderr.write(chunk));

  try {
    const command = parseCommand(parsed.command);
    const report = await buildCommandReport(command, parsed, input);
    presentJsonReport(report, { write: output });
    return 0;
  } catch (error) {
    errorOutput(`${errorMessage(error)}\n`);
    return 1;
  }
}

async function buildCommandReport(command: CliCommand, parsed: ParsedArguments, input: CliRunInput): Promise<unknown> {
  if (command === CLI_COMMAND.INVENTORY) {
    const client = requiredClient(parsed);
    if (client === CLIENT_ID.OPENCODE) {
      const result = await buildOpenCodeInventory(parsed, input);
      return { command, client, inventory: result.inventory, collisions: result.collisions, safety: safetySummary() };
    }

    return { command, client, inventory: await buildSkillInventory(client, skillRoots(parsed)), safety: safetySummary() };
  }

  if (command === CLI_COMMAND.VALIDATE) {
    const sourcePath = requiredOption(parsed, "skill-file");
    const client = requiredClient(parsed);
    const content = await readFile(sourcePath, "utf8");
    return {
      command,
      result: validateSkillFile({ client, sourceId: sourcePath, sourcePath, content }),
      safety: safetySummary(),
    };
  }

  if (command === CLI_COMMAND.PLAN_REPAIR) {
    const sourcePath = requiredOption(parsed, "skill-file");
    const client = requiredClient(parsed);
    const content = await readFile(sourcePath, "utf8");
    return {
      command,
      plan: planSkillRepair({ client, sourceId: sourcePath, sourcePath, content }),
      safety: safetySummary(),
    };
  }

  if (command === CLI_COMMAND.DOCTOR) {
    return buildDoctorReport(parsed, input);
  }

  const client = requiredClient(parsed);
  const inventory = await buildSkillInventory(client, skillRoots(parsed));
  const profile = activationProfileFromArguments(parsed, client);
  const saturationLimit = optionalNumber(parsed, "saturation-limit");
  const guidance = buildActivationProfileGuidance({
    profile,
    inventory,
    matchingContextSkills: profile.selections.map((selection) => selection.identity),
    ...(saturationLimit === undefined ? {} : { saturationLimit }),
  });

  return { command, profile: guidance, safety: safetySummary() };
}

async function buildOpenCodeInventory(parsed: ParsedArguments, input: CliRunInput): Promise<OpenCodeInventoryResult> {
  const projectDir = optionalValue(parsed, "project-dir") ?? input.cwd ?? process.cwd();
  const homeDir = optionalValue(parsed, "home-dir") ?? input.env?.HOME ?? process.env.HOME ?? projectDir;
  const globalConfigDir = optionalValue(parsed, "global-config-dir");
  const envConfigDir = optionalValue(parsed, "env-config-dir");
  const config = await discoverOpenCodeConfig({
    projectDir,
    ...(globalConfigDir ? { globalConfigDir } : {}),
    ...(envConfigDir ? { envConfigDir } : {}),
  });
  const surfaces = await inventoryOpenCodeSurfaces({ config, projectDir, homeDir });
  const skills = await buildSkillInventory(CLIENT_ID.OPENCODE, skillRoots(parsed));
  const inventory: InventoryReport = {
    ...surfaces.report,
    skills: skills.skills,
    unavailableSources: [...surfaces.report.unavailableSources, ...skills.unavailableSources],
  };

  await proveDeniedSafetyActions();

  return { inventory, collisions: analyzeCommandCollisions({ projections: commandProjectionsFor(inventory) }) };
}

async function buildDoctorReport(parsed: ParsedArguments, input: CliRunInput): Promise<DoctorReport> {
  const client = requiredClient(parsed);
  const inventoryResult = client === CLIENT_ID.OPENCODE ? await buildOpenCodeInventory(parsed, input) : undefined;
  const inventory = inventoryResult?.inventory ?? (await buildSkillInventory(client, skillRoots(parsed)));
  const profile = activationProfileFromArguments(parsed, client);
  const saturationLimit = optionalNumber(parsed, "saturation-limit");
  const guidance = buildActivationProfileGuidance({
    profile,
    inventory,
    matchingContextSkills: profile.selections.map((selection) => selection.identity),
    ...(saturationLimit === undefined ? {} : { saturationLimit }),
  });
  const validation = await buildDoctorValidationSummary(client, inventory);
  const repair = await buildDoctorRepairSummary(client, validation.invalidSkills);

  return {
    kind: "doctor-report",
    command: CLI_COMMAND.DOCTOR,
    client,
    inventory: summarizeDoctorInventory(inventory),
    validation,
    ...(inventoryResult ? { collisions: summarizeDoctorCollisions(inventoryResult.collisions) } : {}),
    profile: guidance,
    repair,
    safety: safetySummary(),
  };
}

function summarizeDoctorInventory(inventory: InventoryReport): DoctorInventorySummary {
  return {
    skills: {
      total: inventory.skills.length,
      available: inventory.skills.filter((skill) => skill.status === LOAD_STATUS.AVAILABLE).length,
      duplicate: inventory.skills.filter((skill) => skill.status === LOAD_STATUS.DUPLICATE).length,
      invalid: inventory.skills.filter(isInvalidSkill).length,
      unavailableSources: inventory.unavailableSources.length,
    },
    surfaces: {
      agents: inventory.agents.length,
      modes: inventory.modes.length,
      commands: inventory.commands.length,
      plugins: inventory.plugins.length,
      mcpEntries: inventory.mcpEntries.length,
    },
  };
}

function summarizeDoctorCollisions(collisions: OpenCodeInventoryResult["collisions"]): DoctorCollisionSummary {
  return {
    total: collisions.collisions.length,
    names: collisions.collisions.map((collision) => collision.name),
  };
}

async function buildDoctorValidationSummary(client: ClientId, inventory: InventoryReport): Promise<DoctorValidationSummary> {
  const skillsWithDiagnostics = await Promise.all(
    inventory.skills.map(async (skill) => ({ skill, diagnostic: await buildSkillValidationDiagnostic(client, skill) })),
  );
  const diagnostics = skillsWithDiagnostics.map(({ diagnostic }) => diagnostic).filter(hasValidationFindings);
  const invalidSkills = skillsWithDiagnostics.filter(({ skill }) => isInvalidSkill(skill)).map(({ diagnostic }) => diagnostic);
  const findings = diagnostics.flatMap((skill) => skill.findings);

  return {
    summary: {
      invalid: invalidSkills.length,
      warnings: findings.filter((finding) => finding.severity === VALIDATION_SEVERITY.WARNING).length,
      errors: findings.filter((finding) => finding.severity === VALIDATION_SEVERITY.ERROR).length,
    },
    diagnostics,
    invalidSkills,
  };
}

async function buildSkillValidationDiagnostic(client: ClientId, skill: SkillRecord): Promise<DoctorSkillValidationDiagnostic> {
  const sourcePath = firstSkillSourcePath(skill);
  if (!sourcePath) return { name: skill.identity.name, findings: [] };

  const content = await readFile(sourcePath, "utf8");
  const validation = validateSkillFile({
    client,
    sourceId: `${client}:${sourcePath}`,
    sourcePath,
    content,
  });

  return { name: skill.identity.name, sourcePath, findings: validation.findings };
}

function hasValidationFindings(diagnostic: DoctorSkillValidationDiagnostic): boolean {
  return diagnostic.findings.length > 0;
}

async function buildDoctorRepairSummary(client: ClientId, invalidSkills: DoctorSkillValidationDiagnostic[]): Promise<DoctorRepairSummary> {
  const repairPlans = await Promise.all(
    invalidSkills.flatMap((skill) => {
      if (!skill.sourcePath) return [];
      return [buildDoctorRepairPlan(client, skill.sourcePath)];
    }),
  );

  return {
    mutatesFiles: false,
    safePlans: repairPlans.filter((plan) => plan.status === REPAIR_PLAN_STATUS.SAFE),
    manualReviewRequired: repairPlans.filter((plan) => plan.status === REPAIR_PLAN_STATUS.MANUAL_REVIEW),
  };
}

async function buildDoctorRepairPlan(client: ClientId, sourcePath: string): Promise<DoctorRepairPlanSummary> {
  const content = await readFile(sourcePath, "utf8");
  const plan = planSkillRepair({ client, sourceId: sourcePath, sourcePath, content });

  return { sourcePath, status: plan.status, summary: plan.summary };
}

function isInvalidSkill(skill: SkillRecord): boolean {
  return skill.status === LOAD_STATUS.INVALID || skill.compatibility.includes(COMPATIBILITY_LEVEL.INCOMPATIBLE);
}

function firstSkillSourcePath(skill: SkillRecord): string | undefined {
  return skill.sources.find((source) => source.sourcePath)?.sourcePath;
}

async function buildSkillInventory(client: ClientId, roots: string[]): Promise<InventoryReport> {
  const [report] = await inventorySkills(roots.map((rootPath): SkillInventoryRoot => ({ client, rootPath })));

  return report ?? emptyInventoryReport(client);
}

function commandProjectionsFor(inventory: InventoryReport): CommandProjection[] {
  const commandRecords = inventory.commands.flatMap(commandRecordProjections);
  const configCommands = commandRecords.filter((projection) => projection.sourceKind === COMMAND_SOURCE_KIND.CONFIG_COMMAND);
  const markdownCommands = commandRecords.filter((projection) => projection.sourceKind === COMMAND_SOURCE_KIND.MARKDOWN_COMMAND);

  return [
    ...builtinCommandProjections(OPENCODE_BUILTIN_COMMAND_NAMES),
    ...configCommands,
    ...inventory.mcpEntries.map((entry): CommandProjection => ({
      name: entry.name,
      sourceKind: COMMAND_SOURCE_KIND.MCP_PROMPT,
      sources: entry.sources.map((source) => ({
        id: `opencode:mcp:${entry.name}`,
        client: source.client,
        kind: SOURCE_KIND.MCP,
        ...(source.rootPath ? { rootPath: source.rootPath } : {}),
        ...(source.sourcePath ? { sourcePath: source.sourcePath } : {}),
      })),
    })),
    ...inventory.skills.map((skill): CommandProjection => ({
      name: skill.identity.name,
      sourceKind: COMMAND_SOURCE_KIND.SKILL_COMMAND,
      sources: skill.sources,
    })),
    ...markdownCommands,
  ];
}

function commandRecordProjections(record: InventoryReport["commands"][number]): CommandProjection[] {
  return record.sources.map((source): CommandProjection => ({
    name: record.name,
    sourceKind: commandSourceKindFor(source.sourcePath),
    sources: [source],
  }));
}

function commandSourceKindFor(sourcePath: string | undefined): CommandSourceKind {
  return sourcePath?.endsWith(".md") ? COMMAND_SOURCE_KIND.MARKDOWN_COMMAND : COMMAND_SOURCE_KIND.CONFIG_COMMAND;
}

function activationProfileFromArguments(parsed: ParsedArguments, client: ClientId): ActivationProfile {
  const selected = values(parsed, "selected");
  return {
    id: optionalValue(parsed, "profile-id") ?? "default",
    name: optionalValue(parsed, "profile-name") ?? optionalValue(parsed, "profile-id") ?? "Default",
    client,
    selections: selected.map((name) => ({ identity: { client, name }, state: PROFILE_SKILL_STATE.SELECTED })),
  };
}

async function proveDeniedSafetyActions(): Promise<void> {
  await Promise.all(
    Object.values(SIDE_EFFECT).map(async (effect) => {
      await requireApprovedSideEffect(
        { effect, planId: `read-only:${effect}`, reason: "CLI MVP runs in read-only mode by default." },
        { require: async () => APPROVAL_DECISION.DENIED },
        async () => "not executed",
      );
    }),
  );
}

function safetySummary(): SafetySummary {
  return { mode: "read-only", deniedActions: Object.values(SIDE_EFFECT), note: SAFETY_NOTE };
}

function parseArguments(argv: string[]): ParsedArguments {
  const [command, ...rest] = argv;
  const options: Record<string, string[]> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = [...(options[key] ?? []), "true"];
      continue;
    }
    options[key] = [...(options[key] ?? []), value];
    index += 1;
  }

  return { ...(command === undefined ? {} : { command }), options };
}

function parseCommand(command: string | undefined): CliCommand {
  if (command && Object.values(CLI_COMMAND).includes(command as CliCommand)) return command as CliCommand;
  throw new Error(`Unknown command: ${command ?? "<missing>"}`);
}

function requiredClient(parsed: ParsedArguments): ClientId {
  const client = requiredOption(parsed, "client");
  if (client === CLIENT_ID.OPENCODE || client === CLIENT_ID.CODEX) return client;
  throw new Error(`Unsupported client: ${client}`);
}

function skillRoots(parsed: ParsedArguments): string[] {
  return values(parsed, "skill-root");
}

function values(parsed: ParsedArguments, key: string): string[] {
  return parsed.options[key] ?? [];
}

function requiredOption(parsed: ParsedArguments, key: string): string {
  const value = optionalValue(parsed, key);
  if (!value) throw new Error(`Missing required option: --${key}`);
  return value;
}

function optionalValue(parsed: ParsedArguments, key: string): string | undefined {
  return values(parsed, key)[0];
}

function optionalNumber(parsed: ParsedArguments, key: string): number | undefined {
  const value = optionalValue(parsed, key);
  if (!value) return undefined;
  const parsedNumber = Number(value);
  return Number.isFinite(parsedNumber) ? parsedNumber : undefined;
}

function emptyInventoryReport(client: ClientId): InventoryReport {
  return {
    client,
    skills: [],
    agents: [],
    modes: [],
    commands: [],
    plugins: [],
    mcpEntries: [],
    unavailableSources: [],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

export function isDirectInvocation(moduleUrl: string = import.meta.url, argvEntry: string | undefined = process.argv[1]): boolean {
  if (!argvEntry) return false;

  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvEntry);
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  process.exitCode = await runCli();
}
