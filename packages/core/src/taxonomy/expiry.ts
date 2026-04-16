import type { ArchDecision, ADRStatus } from '../types/index.js';

export interface ExpiryCheckResult {
  adr: ArchDecision;
  effectiveStatus: ADRStatus;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry?: number;
  daysSinceExpiry?: number;
}

/**
 * Applies automatic expiry transitions and computes effective status.
 * Per spec ARCHDECISION-SCHEMA §5: an active ADR whose expires date is in the
 * past MUST be treated as expired regardless of the written status.
 */
export function checkExpiry(
  adr: ArchDecision,
  now: Date = new Date(),
  warnDays: number = 30,
): ExpiryCheckResult {
  const expiryDate = new Date(adr.spec.expires);
  // Zero out time component for date-only comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate(),
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / msPerDay);

  const isExpired = adr.spec.status === 'active' && diffDays < 0;
  const isExpiringSoon =
    adr.spec.status === 'active' && diffDays >= 0 && diffDays <= warnDays;

  let effectiveStatus: ADRStatus = adr.spec.status;
  if (isExpired) {
    effectiveStatus = 'expired';
  }

  return {
    adr,
    effectiveStatus,
    isExpired,
    isExpiringSoon,
    ...(diffDays >= 0 ? { daysUntilExpiry: diffDays } : {}),
    ...(diffDays < 0 ? { daysSinceExpiry: Math.abs(diffDays) } : {}),
  };
}

/**
 * Checks whether max_age_days has been exceeded relative to the ADR's created
 * date. Returns true if the tactical tolerance should be considered expired.
 */
export function isMaxAgeExceeded(
  adrCreatedDate: string,
  maxAgeDays: number,
  now: Date = new Date(),
): boolean {
  const created = new Date(adrCreatedDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const ageMs = today.getTime() - created.getTime();
  const ageDays = Math.floor(ageMs / msPerDay);
  return ageDays > maxAgeDays;
}

/**
 * Processes all ADRs and returns each with its computed effective status.
 * Mutates `_effectiveStatus` on each ADR for downstream use.
 */
export function applyExpiryTransitions(
  adrs: ArchDecision[],
  now: Date = new Date(),
  warnDays: number = 30,
): ExpiryCheckResult[] {
  return adrs.map((adr) => {
    const result = checkExpiry(adr, now, warnDays);
    adr._effectiveStatus = result.effectiveStatus;
    return result;
  });
}
