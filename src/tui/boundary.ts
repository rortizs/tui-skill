import type { InventoryReport } from "../domain/inventory";

export interface PresenterOutput {
  write(chunk: string): void;
}

export interface TuiPresenterBoundary {
  showInventory(report: InventoryReport): Promise<void>;
}

export function presentJsonReport(report: unknown, output: PresenterOutput): void {
  output.write(`${JSON.stringify(report, null, 2)}\n`);
}
