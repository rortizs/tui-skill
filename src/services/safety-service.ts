import { APPROVAL_DECISION, type ApprovalDecision, type ApprovalGate, type ApprovalRequest } from "../domain/approval";

export interface SafetyExecutionResult<T> {
  decision: ApprovalDecision;
  request: ApprovalRequest;
  value?: T;
}

export async function requireApprovedSideEffect<T>(
  request: ApprovalRequest,
  gate: ApprovalGate,
  action: () => Promise<T>,
): Promise<SafetyExecutionResult<T>> {
  const decision = await gate.require(request);

  if (decision !== APPROVAL_DECISION.APPROVED) {
    return { decision, request };
  }

  return { decision, request, value: await action() };
}
