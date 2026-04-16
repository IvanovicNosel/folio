import type { Finding, ClassifiedFinding } from '../types/violation.js';

export interface NormalizationSignalResult {
  constraint: string;
  affectedComponents: string[];
  occurrences: number;
  isNormalizing: boolean;
}

/**
 * Detects normalization patterns across components.
 *
 * Per spec INVESTIGATOR-PROTOCOL §5: when the same constraint is violated in
 * >= normalizationThreshold components without any tolerance coverage, the
 * Normalization Signal fires and each occurrence is flagged as normalizing.
 */
export function detectNormalizationSignals(
  findings: ClassifiedFinding[],
  normalizationThreshold: number = 2,
): NormalizationSignalResult[] {
  // Only look at BLOCKING findings (undocumented strategic violations)
  const undocumented = findings.filter(
    (f) =>
      f.classification === 'BLOCKING' &&
      f.violation_type === 'constraint-violation',
  );

  // Group by constraint
  const byConstraint = new Map<string, Set<string>>();
  for (const f of undocumented) {
    const existing = byConstraint.get(f.constraint) ?? new Set<string>();
    existing.add(f.component);
    byConstraint.set(f.constraint, existing);
  }

  const results: NormalizationSignalResult[] = [];

  for (const [constraint, components] of byConstraint) {
    const componentList = Array.from(components);
    const isNormalizing = componentList.length >= normalizationThreshold;

    results.push({
      constraint,
      affectedComponents: componentList,
      occurrences: componentList.length,
      isNormalizing,
    });
  }

  return results.filter((r) => r.isNormalizing);
}

/**
 * Generates normalization signal findings that the IntentResolver injects
 * into the final report.
 */
export function generateNormalizationFindings(
  signals: NormalizationSignalResult[],
): Finding[] {
  const findings: Finding[] = [];

  for (const signal of signals) {
    for (const component of signal.affectedComponents) {
      findings.push({
        agent: 'intent-resolver',
        component,
        constraint: signal.constraint,
        violation_type: 'normalization-signal',
        message: `Constraint '${signal.constraint}' is violated in ${signal.occurrences} component(s) without ADR coverage. This pattern is normalising.`,
        evidence: `Components affected: [${signal.affectedComponents.join(', ')}]`,
        confidence: 1.0,
        raw_data: {
          occurrences: signal.occurrences,
          affected_components: signal.affectedComponents,
        },
      });
    }
  }

  return findings;
}
