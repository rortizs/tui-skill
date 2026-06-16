export const SIDE_EFFECT = {
  FILE_WRITE: "file-write",
  CONFIG_WRITE: "config-write",
  PLUGIN_EXECUTE: "plugin-execute",
  MCP_CONNECT: "mcp-connect",
  MCP_AUTH: "mcp-auth",
} as const;

export type SideEffect = (typeof SIDE_EFFECT)[keyof typeof SIDE_EFFECT];

export const APPROVAL_DECISION = {
  APPROVED: "approved",
  DENIED: "denied",
} as const;

export type ApprovalDecision = (typeof APPROVAL_DECISION)[keyof typeof APPROVAL_DECISION];

export interface ApprovalRequest {
  effect: SideEffect;
  planId: string;
  reason: string;
}

export interface ApprovalGate {
  require(request: ApprovalRequest): Promise<ApprovalDecision>;
}

export function isSideEffect(value: unknown): value is SideEffect {
  return typeof value === "string" && Object.values(SIDE_EFFECT).includes(value as SideEffect);
}

export function requiresExplicitApproval(value: unknown): value is SideEffect {
  return isSideEffect(value);
}
