import { CLIENT_ID, type InventoryReport } from "../../domain/inventory";
import { inventorySkills, type SkillInventoryRoot } from "../../services/inventory-service";

export interface CodexInventoryInput {
  roots: string[];
}

export async function inventoryCodexSkills(input: CodexInventoryInput): Promise<InventoryReport> {
  const roots = input.roots.map((rootPath): SkillInventoryRoot => ({ client: CLIENT_ID.CODEX, rootPath }));
  const [report] = await inventorySkills(roots);

  return report ?? createEmptyCodexInventoryReport();
}

function createEmptyCodexInventoryReport(): InventoryReport {
  return {
    client: CLIENT_ID.CODEX,
    skills: [],
    agents: [],
    modes: [],
    commands: [],
    plugins: [],
    mcpEntries: [],
    unavailableSources: [],
  };
}
