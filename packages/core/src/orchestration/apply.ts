import { fillVerificationFields, type FieldTarget } from '../fields/index.js';
import type { PolicyResult } from '../types.js';

export function applyExplicitFill(
  policy: PolicyResult,
  target: FieldTarget,
  value: string,
  warningOverride = false,
): boolean {
  const approved =
    policy.decision === 'allow' ||
    (policy.decision === 'warn' && policy.canOverride && warningOverride);
  if (!approved) return false;
  return fillVerificationFields(target, value);
}
