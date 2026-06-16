import {
  COMPATIBILITY_LEVEL,
  VALIDATION_SEVERITY,
  type CompatibilityLevel,
  type ValidationFinding,
} from "../domain/compatibility";
import { CLIENT_ID, type ClientId } from "../domain/inventory";

export const SKILL_VALIDATION_CODE = {
  MISSING_OPENING_BOUNDARY: "skill.frontmatter.missing-opening-boundary",
  MISSING_CLOSING_BOUNDARY: "skill.frontmatter.missing-closing-boundary",
  MISSING_RUNTIME_FIELD: "skill.frontmatter.missing-runtime-field",
  MISSING_DOCS_FIELD: "skill.frontmatter.missing-docs-field",
} as const;

export type SkillValidationCode = (typeof SKILL_VALIDATION_CODE)[keyof typeof SKILL_VALIDATION_CODE];

export interface SkillFileValidationInput {
  client: ClientId;
  sourcePath: string;
  content: string;
  sourceId?: string;
}

export interface SkillFrontmatterParseResult {
  hasOpeningBoundary: boolean;
  hasClosingBoundary: boolean;
  fields: Record<string, string>;
}

export interface SkillValidationResult {
  compatibility: CompatibilityLevel[];
  findings: ValidationFinding[];
  fields: Record<string, string>;
}

const FRONTMATTER_BOUNDARY = "---";

export function parseSkillFrontmatter(content: string): SkillFrontmatterParseResult {
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  const hasOpeningBoundary = lines[0]?.trim() === FRONTMATTER_BOUNDARY;

  if (!hasOpeningBoundary) {
    return { hasOpeningBoundary, hasClosingBoundary: false, fields: {} };
  }

  const closingBoundaryIndex = lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_BOUNDARY);
  const hasClosingBoundary = closingBoundaryIndex > 0;

  if (!hasClosingBoundary) {
    return { hasOpeningBoundary, hasClosingBoundary, fields: {} };
  }

  const fields: Record<string, string> = {};

  for (const line of lines.slice(1, closingBoundaryIndex)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    const key = match?.[1];

    if (key) {
      fields[key] = stripYamlScalarQuotes(match[2] ?? "");
    }
  }

  return { hasOpeningBoundary, hasClosingBoundary, fields };
}

export function validateSkillFile(input: SkillFileValidationInput): SkillValidationResult {
  const parseResult = parseSkillFrontmatter(input.content);
  const findings: ValidationFinding[] = [];

  if (!parseResult.hasOpeningBoundary) {
    findings.push(createFinding(input, SKILL_VALIDATION_CODE.MISSING_OPENING_BOUNDARY, "SKILL.md is missing opening frontmatter delimiter.", COMPATIBILITY_LEVEL.INCOMPATIBLE));
    return { compatibility: [COMPATIBILITY_LEVEL.INCOMPATIBLE], findings, fields: parseResult.fields };
  }

  if (!parseResult.hasClosingBoundary) {
    findings.push(createFinding(input, SKILL_VALIDATION_CODE.MISSING_CLOSING_BOUNDARY, "SKILL.md is missing closing frontmatter delimiter.", COMPATIBILITY_LEVEL.INCOMPATIBLE));
    return { compatibility: [COMPATIBILITY_LEVEL.INCOMPATIBLE], findings, fields: parseResult.fields };
  }

  if (!parseResult.fields.name) {
    findings.push(createFinding(input, SKILL_VALIDATION_CODE.MISSING_RUNTIME_FIELD, "SKILL.md frontmatter is missing required runtime field: name.", COMPATIBILITY_LEVEL.INCOMPATIBLE));
    return { compatibility: [COMPATIBILITY_LEVEL.INCOMPATIBLE], findings, fields: parseResult.fields };
  }

  if (!parseResult.fields.description) {
    findings.push(createFinding(input, SKILL_VALIDATION_CODE.MISSING_DOCS_FIELD, `${input.client} runtime compatibility is satisfied, but documented schema guidance expects description.`, COMPATIBILITY_LEVEL.DOCS));
    return { compatibility: [COMPATIBILITY_LEVEL.RUNTIME], findings, fields: parseResult.fields };
  }

  return { compatibility: compatibilityForDocumentedSkill(input.client), findings, fields: parseResult.fields };
}

function compatibilityForDocumentedSkill(client: ClientId): CompatibilityLevel[] {
  if (client === CLIENT_ID.OPENCODE || client === CLIENT_ID.CODEX) {
    return [COMPATIBILITY_LEVEL.RUNTIME, COMPATIBILITY_LEVEL.DOCS, COMPATIBILITY_LEVEL.PORTABLE];
  }

  return [COMPATIBILITY_LEVEL.PORTABLE];
}

function createFinding(
  input: SkillFileValidationInput,
  code: SkillValidationCode,
  message: string,
  level: CompatibilityLevel,
): ValidationFinding {
  return {
    code,
    message,
    level,
    severity: level === COMPATIBILITY_LEVEL.INCOMPATIBLE ? VALIDATION_SEVERITY.ERROR : VALIDATION_SEVERITY.WARNING,
    targetClient: input.client,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
  };
}

function stripYamlScalarQuotes(value: string): string {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
