import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { COMPATIBILITY_LEVEL } from "../domain/compatibility";
import {
  LOAD_STATUS,
  SOURCE_KIND,
  type ClientId,
  type InventoryReport,
  type SkillRecord,
  type SourceProvenance,
  type UnavailableSource,
  skillIdentityKey,
} from "../domain/inventory";
import { validateSkillFile } from "./validation-service";

export interface SkillInventoryRoot {
  client: ClientId;
  rootPath: string;
}

interface SkillCandidate {
  client: ClientId;
  rootPath: string;
  sourcePath: string;
  content: string;
}

export async function inventorySkills(roots: SkillInventoryRoot[]): Promise<InventoryReport[]> {
  const reports = new Map<ClientId, InventoryReport>();

  await Promise.all(
    roots.map(async (root, index) => {
      const report = getOrCreateReport(reports, root.client);
      const candidates = await readSkillCandidates(root, index, report.unavailableSources);

      for (const candidate of candidates) {
        upsertSkill(report, candidate);
      }
    }),
  );

  return [...reports.values()].map(markDuplicateSkills);
}

function getOrCreateReport(reports: Map<ClientId, InventoryReport>, client: ClientId): InventoryReport {
  const existing = reports.get(client);

  if (existing) {
    return existing;
  }

  const created: InventoryReport = {
    client,
    skills: [],
    agents: [],
    modes: [],
    commands: [],
    plugins: [],
    mcpEntries: [],
    unavailableSources: [],
  };
  reports.set(client, created);

  return created;
}

async function readSkillCandidates(root: SkillInventoryRoot, rootIndex: number, unavailableSources: UnavailableSource[]): Promise<SkillCandidate[]> {
  try {
    const entries = await readdir(root.rootPath, { withFileTypes: true });
    const candidatePaths = entries.filter((entry) => entry.isDirectory()).map((entry) => join(root.rootPath, entry.name, "SKILL.md"));
    const candidates = await Promise.all(candidatePaths.map((sourcePath) => readCandidate(root, sourcePath)));

    return candidates.filter((candidate): candidate is SkillCandidate => candidate !== undefined);
  } catch (error) {
    unavailableSources.push({
      provenance: {
        id: `${root.client}:root:${rootIndex}`,
        client: root.client,
        kind: SOURCE_KIND.SKILL,
        rootPath: root.rootPath,
      },
      reason: `Skill root is not readable: ${errorMessage(error)}`,
    });

    return [];
  }
}

async function readCandidate(root: SkillInventoryRoot, sourcePath: string): Promise<SkillCandidate | undefined> {
  try {
    return { client: root.client, rootPath: root.rootPath, sourcePath, content: await readFile(sourcePath, "utf8") };
  } catch {
    return undefined;
  }
}

function upsertSkill(report: InventoryReport, candidate: SkillCandidate): void {
  const sourceId = `${candidate.client}:${candidate.sourcePath}`;
  const validation = validateSkillFile({
    client: candidate.client,
    sourceId,
    sourcePath: candidate.sourcePath,
    content: candidate.content,
  });
  const name = validation.fields.name || basename(dirname(candidate.sourcePath));
  const record: SkillRecord = {
    identity: { client: candidate.client, name },
    ...(validation.fields.description ? { description: validation.fields.description } : {}),
    status: validation.compatibility.includes(COMPATIBILITY_LEVEL.INCOMPATIBLE) ? LOAD_STATUS.INVALID : LOAD_STATUS.AVAILABLE,
    compatibility: validation.compatibility,
    sources: [createSkillProvenance(candidate, sourceId)],
  };
  const existing = report.skills.find((skill) => skillIdentityKey(skill.identity) === skillIdentityKey(record.identity));

  if (existing) {
    existing.sources.push(...record.sources);
    return;
  }

  report.skills.push(record);
}

function markDuplicateSkills(report: InventoryReport): InventoryReport {
  for (const skill of report.skills) {
    if (skill.sources.length > 1) {
      skill.status = LOAD_STATUS.DUPLICATE;
    }
  }

  return report;
}

function createSkillProvenance(candidate: SkillCandidate, sourceId: string): SourceProvenance {
  return {
    id: sourceId,
    client: candidate.client,
    kind: SOURCE_KIND.SKILL,
    rootPath: candidate.rootPath,
    sourcePath: candidate.sourcePath,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
