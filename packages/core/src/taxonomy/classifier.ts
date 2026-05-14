import type {
  ComponentManifest,
  TacticalTolerance,
  StrategicTolerance,
} from '../types/component.js';
import type { ArchDecision } from '../types/archdecision.js';
import type { Finding, ViolationClassification } from '../types/violation.js';
import { checkExpiry, isMaxAgeExceeded } from './expiry.js';

export interface ClassificationResult {
  classification: ViolationClassification;
  adr?: string;
  tolerance_id?: string;
  reasons: string[];
}

export interface ClassifierContext {
  component: ComponentManifest;
  adrs: Map<string, ArchDecision>;
  now?: Date;
}

/**
 * Core violation classifier implementing the Folio violation taxonomy.
 *
 * Per spec INVESTIGATOR-PROTOCOL §4.5 and DSL-GRAMMAR §5.1, a finding is
 * classified as TACTICAL if a valid tactical tolerance exists, STRATEGIC_APPROVED
 * if a strategic tolerance covers it, and BLOCKING otherwise.
 */
export function classifyFinding(
  finding: Finding,
  ctx: ClassifierContext,
): ClassificationResult {
  const now = ctx.now ?? new Date();
  const { component, adrs } = ctx;
  const tolerances = component.spec.violations ?? {};
  const tactical = tolerances.tactical ?? [];
  const strategic = tolerances.strategic ?? [];

  // ── 1. Look for a matching tactical tolerance ─────────────────────────────
  const matchingTactical = tactical.filter(
    (t) => t.constraint === finding.constraint,
  );

  for (const tolerance of matchingTactical) {
    const result = evaluateTacticalTolerance(tolerance, adrs, now);
    if (result.valid) {
      return {
        classification: 'TACTICAL',
        adr: tolerance.adr,
        tolerance_id: tolerance.id,
        reasons: result.reasons,
      };
    }
  }

  // If a tactical tolerance exists but failed validation, return BLOCKING with
  // the reason for reclassification (expired ADR, etc.)
  if (matchingTactical.length > 0) {
    const firstResult = evaluateTacticalTolerance(
      matchingTactical[0]!,
      adrs,
      now,
    );
    return {
      classification: 'BLOCKING',
      adr: matchingTactical[0]!.adr,
      tolerance_id: matchingTactical[0]!.id,
      reasons: firstResult.reasons,
    };
  }

  // ── 2. Look for a matching strategic tolerance ────────────────────────────
  const matchingStrategic = strategic.find(
    (s) => s.constraint === finding.constraint,
  );

  if (matchingStrategic) {
    return {
      classification: 'STRATEGIC_APPROVED',
      tolerance_id: matchingStrategic.id,
      reasons: [
        `Strategic exception approved by ${matchingStrategic.approval} (${matchingStrategic.approver})`,
        `RFC: ${matchingStrategic.rfc}`,
      ],
    };
  }

  // ── 3. No tolerance — this is a blocking strategic violation ─────────────
  return {
    classification: 'BLOCKING',
    reasons: ['No violation tolerance declared for this constraint'],
  };
}

interface TacticalEvaluationResult {
  valid: boolean;
  reasons: string[];
}

function evaluateTacticalTolerance(
  tolerance: TacticalTolerance,
  adrs: Map<string, ArchDecision>,
  now: Date,
): TacticalEvaluationResult {
  const reasons: string[] = [];

  const adr = adrs.get(tolerance.adr);

  if (!adr) {
    reasons.push(`ADR '${tolerance.adr}' not found`);
    return { valid: false, reasons };
  }

  const expiryResult = checkExpiry(adr, now);
  const effectiveStatus = expiryResult.effectiveStatus;

  if (effectiveStatus === 'expired') {
    reasons.push(
      `ADR '${tolerance.adr}' expired on ${adr.spec.expires} (${expiryResult.daysSinceExpiry} days ago)`,
    );
    return { valid: false, reasons };
  }

  if (effectiveStatus === 'revoked') {
    reasons.push(
      `ADR '${tolerance.adr}' was revoked: ${adr.spec.revoked_reason ?? 'no reason given'}`,
    );
    return { valid: false, reasons };
  }

  if (effectiveStatus === 'superseded') {
    reasons.push(
      `ADR '${tolerance.adr}' was superseded by '${adr.spec.superseded_by}'`,
    );
    return { valid: false, reasons };
  }

  if (effectiveStatus === 'draft') {
    reasons.push(`ADR '${tolerance.adr}' is still in draft status`);
    return { valid: false, reasons };
  }

  // Check tolerance-level expiry
  const toleranceExpiry = new Date(tolerance.expires);
  const toleranceExpiryDay = new Date(
    toleranceExpiry.getFullYear(),
    toleranceExpiry.getMonth(),
    toleranceExpiry.getDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (toleranceExpiryDay < today) {
    reasons.push(
      `Violation tolerance '${tolerance.id}' expired on ${tolerance.expires}`,
    );
    return { valid: false, reasons };
  }

  // Check max_age_days
  if (tolerance.max_age_days !== undefined) {
    if (isMaxAgeExceeded(adr.metadata.created, tolerance.max_age_days, now)) {
      reasons.push(
        `ADR '${tolerance.adr}' created ${adr.metadata.created} — max_age_days (${tolerance.max_age_days}) exceeded`,
      );
      return { valid: false, reasons };
    }
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  reasons.push(
    `Valid tactical tolerance: ADR '${tolerance.adr}' active until ${tolerance.expires}`,
  );
  if (expiryResult.isExpiringSoon) {
    reasons.push(
      `Warning: ADR expires in ${expiryResult.daysUntilExpiry} days`,
    );
  }

  return { valid: true, reasons };
}

/**
 * Resolves all findings for a component, applying the full classification
 * pipeline. Returns classified findings with their tolerance context.
 */
export function classifyFindings(
  findings: Finding[],
  ctx: ClassifierContext,
): Array<Finding & ClassificationResult> {
  return findings.map((f) => ({
    ...f,
    ...classifyFinding(f, ctx),
  }));
}
