import type { ClientId } from "../domain/inventory.js";

export const REPAIR_PLAN_STATUS = {
  SAFE: "safe",
  MANUAL_REVIEW: "manual-review",
} as const;

export type RepairPlanStatus = (typeof REPAIR_PLAN_STATUS)[keyof typeof REPAIR_PLAN_STATUS];

export const REPAIR_DIFF_KIND = {
  INSERT_OPENING_DELIMITER: "insert-opening-delimiter",
  WRAP_LEADING_FRONTMATTER: "wrap-leading-frontmatter",
} as const;

export type RepairDiffKind = (typeof REPAIR_DIFF_KIND)[keyof typeof REPAIR_DIFF_KIND];

export interface SkillRepairPlanningInput {
  client: ClientId;
  sourceId: string;
  sourcePath: string;
  content: string;
}

export interface SkillRepairDiff {
  kind: RepairDiffKind;
  before: string;
  after: string;
}

interface SkillRepairPlanBase {
  id: string;
  sourceId: string;
  sourcePath: string;
  status: RepairPlanStatus;
  requiresManualReview: boolean;
  summary: string;
}

export interface SafeSkillRepairPlan extends SkillRepairPlanBase {
  status: typeof REPAIR_PLAN_STATUS.SAFE;
  requiresManualReview: false;
  proposedContent: string;
  diff: SkillRepairDiff;
}

export interface ManualReviewSkillRepairPlan extends SkillRepairPlanBase {
  status: typeof REPAIR_PLAN_STATUS.MANUAL_REVIEW;
  requiresManualReview: true;
  reason: string;
}

export type SkillRepairPlan = SafeSkillRepairPlan | ManualReviewSkillRepairPlan;

const FRONTMATTER_BOUNDARY = "---";

export function planSkillRepair(input: SkillRepairPlanningInput): SkillRepairPlan {
  const lines = normalizeLineEndings(input.content).split("\n");
  const firstLine = lines[0]?.trim() ?? "";

  if (firstLine === FRONTMATTER_BOUNDARY) {
    return manualReviewPlan(input, "Existing frontmatter starts with a delimiter; unsafe or missing closing delimiters need manual review.");
  }

  const firstDelimiterIndex = lines.findIndex((line) => line.trim() === FRONTMATTER_BOUNDARY);

  if (firstDelimiterIndex > 0 && leadingLinesContainRequiredFields(lines.slice(0, firstDelimiterIndex))) {
    const proposedContent = `${FRONTMATTER_BOUNDARY}\n${input.content}`;
    return safePlan(input, REPAIR_DIFF_KIND.INSERT_OPENING_DELIMITER, proposedContent);
  }

  const leadingFrontmatter = inferLeadingFrontmatter(lines);
  if (leadingFrontmatter && leadingLinesContainRequiredFields(leadingFrontmatter.frontmatterLines)) {
    const proposedContent = [
      FRONTMATTER_BOUNDARY,
      ...leadingFrontmatter.frontmatterLines,
      FRONTMATTER_BOUNDARY,
      ...leadingFrontmatter.bodyLines,
    ].join("\n");
    return safePlan(input, REPAIR_DIFF_KIND.WRAP_LEADING_FRONTMATTER, proposedContent);
  }

  return manualReviewPlan(
    input,
    "The repair needs manual review because required frontmatter fields or delimiter boundaries cannot be inferred safely.",
  );
}

function safePlan(input: SkillRepairPlanningInput, kind: RepairDiffKind, proposedContent: string): SafeSkillRepairPlan {
  return {
    id: repairPlanId(input),
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    status: REPAIR_PLAN_STATUS.SAFE,
    requiresManualReview: false,
    summary: "Add YAML frontmatter delimiters around existing author-provided fields.",
    proposedContent,
    diff: { kind, before: input.content, after: proposedContent },
  };
}

function manualReviewPlan(input: SkillRepairPlanningInput, reason: string): ManualReviewSkillRepairPlan {
  return {
    id: repairPlanId(input),
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    status: REPAIR_PLAN_STATUS.MANUAL_REVIEW,
    requiresManualReview: true,
    summary: "No automatic repair is proposed.",
    reason,
  };
}

function repairPlanId(input: SkillRepairPlanningInput): string {
  return `${input.client}:repair:${input.sourceId}`;
}

function normalizeLineEndings(content: string): string {
  return content.replaceAll("\r\n", "\n");
}

function leadingLinesContainRequiredFields(lines: string[]): boolean {
  const fields = new Set<string>();

  for (const line of lines) {
    const key = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*.+$/)?.[1];
    if (key) fields.add(key);
  }

  return fields.has("name") && fields.has("description");
}

function inferLeadingFrontmatter(lines: string[]): { frontmatterLines: string[]; bodyLines: string[] } | undefined {
  const blankIndex = lines.findIndex((line) => line.trim() === "");
  if (blankIndex <= 0) return undefined;

  const frontmatterLines = lines.slice(0, blankIndex);
  if (!frontmatterLines.every((line) => /^([A-Za-z][A-Za-z0-9_-]*):\s*.+$/.test(line))) return undefined;

  return { frontmatterLines, bodyLines: lines.slice(blankIndex) };
}
