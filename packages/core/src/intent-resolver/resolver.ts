import type { ComponentManifest } from '../types/component.js';
import type { ArchDecision } from '../types/archdecision.js';
import type {
  Finding,
  ClassifiedFinding,
  FolioReport,
  FolioConfig,
} from '../types/violation.js';
import { classifyFinding } from '../taxonomy/classifier.js';
import {
  detectNormalizationSignals,
  generateNormalizationFindings,
} from '../taxonomy/normalization.js';
import { applyExpiryTransitions } from '../taxonomy/expiry.js';

export interface ResolverInput {
  findings: Finding[];
  components: ComponentManifest[];
  adrs: ArchDecision[];
  config: Pick<
    FolioConfig,
    'confidence_threshold' | 'normalization_threshold' | 'expiry_warn_days'
  >;
  now?: Date;
}

/**
 * The IntentResolver is the final stage of the Investigator pipeline.
 *
 * Per spec INVESTIGATOR-PROTOCOL §4.5, it:
 * 1. Applies expiry transitions to all ADRs
 * 2. Cross-references each finding against declared violation tolerances
 * 3. Classifies each finding using the violation taxonomy
 * 4. Detects normalization signals
 * 5. Marks low-confidence findings as ADVISORY
 */
export function resolve(input: ResolverInput): FolioReport {
  const now = input.now ?? new Date();

  // ── 1. Apply expiry transitions ───────────────────────────────────────────
  applyExpiryTransitions(input.adrs, now, input.config.expiry_warn_days);

  const adrMap = new Map(input.adrs.map((a) => [a.metadata.name, a]));
  const componentMap = new Map(
    input.components.map((c) => [c.metadata.name, c]),
  );

  // ── 2. Deduplicate findings (highest confidence wins) ─────────────────────
  const deduped = deduplicateFindings(input.findings);

  // ── 3. Classify each finding ──────────────────────────────────────────────
  const classified: ClassifiedFinding[] = deduped.map((finding) => {
    // Low-confidence findings become ADVISORY
    if (finding.confidence < input.config.confidence_threshold) {
      return { ...finding, classification: 'ADVISORY' as const };
    }

    // Non-violation findings (expiry warnings, schema errors, etc.)
    if (
      finding.violation_type === 'expiry-warning' ||
      finding.violation_type === 'schema-error'
    ) {
      return {
        ...finding,
        classification:
          finding.violation_type === 'schema-error'
            ? ('BLOCKING' as const)
            : ('WARNING' as const),
      };
    }

    if (
      finding.violation_type === 'adr-expired' ||
      finding.violation_type === 'adr-revoked' ||
      finding.violation_type === 'adr-superseded' ||
      finding.violation_type === 'tolerance-reference-error'
    ) {
      return { ...finding, classification: 'BLOCKING' as const };
    }

    // For constraint violations, use the taxonomy classifier
    if (finding.violation_type === 'constraint-violation') {
      const component = componentMap.get(finding.component);

      if (!component) {
        return {
          ...finding,
          classification: 'BLOCKING' as const,
          reasons: [`Component '${finding.component}' not found in manifest`],
        } as ClassifiedFinding;
      }

      const result = classifyFinding(finding, { component, adrs: adrMap, now });
      return { ...finding, ...result };
    }

    return { ...finding, classification: 'BLOCKING' as const };
  });

  // ── 4. Detect normalization signals ───────────────────────────────────────
  const signals = detectNormalizationSignals(
    classified,
    input.config.normalization_threshold,
  );
  const signalFindings = generateNormalizationFindings(signals);
  const classifiedSignals: ClassifiedFinding[] = signalFindings.map((f) => ({
    ...f,
    classification: 'BLOCKING' as const,
  }));

  const allFindings = [...classified, ...classifiedSignals];

  // ── 5. Build summary ──────────────────────────────────────────────────────
  const summary = {
    blocking: allFindings.filter((f) => f.classification === 'BLOCKING').length,
    tactical: allFindings.filter((f) => f.classification === 'TACTICAL').length,
    strategic_approved: allFindings.filter(
      (f) => f.classification === 'STRATEGIC_APPROVED',
    ).length,
    advisory: allFindings.filter((f) => f.classification === 'ADVISORY').length,
    warnings: allFindings.filter((f) => f.classification === 'WARNING').length,
  };

  return {
    version: 'folio/v1alpha1',
    generated_at: now.toISOString(),
    summary,
    findings: allFindings,
  };
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const f of findings) {
    const key = `${f.component}:${f.constraint}:${f.file ?? ''}:${f.line ?? ''}`;
    const existing = seen.get(key);
    if (!existing || f.confidence > existing.confidence) {
      seen.set(key, f);
    }
  }

  return Array.from(seen.values());
}
