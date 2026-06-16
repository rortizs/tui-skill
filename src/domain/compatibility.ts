export const COMPATIBILITY_LEVEL = {
  RUNTIME: "runtime-compatible",
  DOCS: "docs-compatible",
  PORTABLE: "portable-compatible",
  INCOMPATIBLE: "incompatible",
} as const;

export type CompatibilityLevel = (typeof COMPATIBILITY_LEVEL)[keyof typeof COMPATIBILITY_LEVEL];

export const VALIDATION_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type ValidationSeverity = (typeof VALIDATION_SEVERITY)[keyof typeof VALIDATION_SEVERITY];

export interface ValidationFinding {
  code: string;
  message: string;
  level: CompatibilityLevel;
  severity: ValidationSeverity;
  targetClient: string;
  sourceId?: string;
  uncertainty?: string;
}

export function isCompatibilityLevel(value: unknown): value is CompatibilityLevel {
  return typeof value === "string" && Object.values(COMPATIBILITY_LEVEL).includes(value as CompatibilityLevel);
}
