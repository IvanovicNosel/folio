import { resolve } from 'node:path';
import pc from 'picocolors';
import {
  loadComponents,
  loadArchDecisions,
  applyExpiryTransitions,
  type Finding,
  type FolioConfig,
  type ComponentManifest,
  type ArchDecision,
  DEFAULT_CONFIG,
  resolve as intentResolve,
} from '@folio/core';
import { validateComponentManifest, validateArchDecisionDocument } from '../schema-validator.js';
import { renderTable } from '../output/table.js';
import { renderSarif } from '../output/sarif.js';
import { makeFinding } from '../finding-builder.js';

export interface CheckOptions {
  path: string;
  decisions?: string;
  format?: 'table' | 'json' | 'sarif';
  confidenceThreshold?: number;
  normalizationThreshold?: number;
  expiryWarnDays?: number;
  quiet?: boolean;
}

/**
 * `folio check` — runs the full Investigator analysis pipeline against a
 * codebase, classifies all violations using the Folio taxonomy, and reports.
 *
 * Exit codes:
 *   0 — No blocking violations
 *   1 — One or more blocking (strategic) violations found
 *   2 — Configuration or schema validation error
 */
export async function runCheck(opts: CheckOptions): Promise<number> {
  const rootDir = resolve(opts.path);
  const decisionsDir = resolve(opts.decisions ?? `${rootDir}/decisions`);
  const format = opts.format ?? 'table';

  const config: FolioConfig = {
    ...DEFAULT_CONFIG,
    confidence_threshold: opts.confidenceThreshold ?? DEFAULT_CONFIG.confidence_threshold,
    normalization_threshold: opts.normalizationThreshold ?? DEFAULT_CONFIG.normalization_threshold,
    expiry_warn_days: opts.expiryWarnDays ?? DEFAULT_CONFIG.expiry_warn_days,
    output_format: format,
    decisions_path: decisionsDir,
  };

  if (!opts.quiet && format === 'table') {
    console.log(pc.bold('\nFolio — Architectural Intent Analysis'));
    console.log(pc.dim(`Target: ${rootDir}`));
    console.log(pc.dim(`Decisions: ${decisionsDir}`));
    console.log('');
  }

  // ── 1. Load documents ─────────────────────────────────────────────────────
  let components;
  try {
    components = loadComponents(rootDir);
  } catch (err) {
    console.error(pc.red(`Failed to load component manifests: ${String(err)}`));
    return 2;
  }

  const adrs = loadArchDecisions(decisionsDir);

  if (components.length === 0) {
    if (!opts.quiet) {
      console.log(pc.yellow('No folio.yaml files found.'));
      console.log(
        pc.dim(`Run ${pc.bold('folio init')} to create a starter configuration.`),
      );
    }
    return 2;
  }

  // ── 2. Schema validation (blocks further analysis on errors) ─────────────
  const schemaFindings: Finding[] = [];

  for (const c of components) {
    schemaFindings.push(...validateComponentManifest(c));
  }
  for (const adr of adrs) {
    schemaFindings.push(...validateArchDecisionDocument(adr));
  }

  if (schemaFindings.length > 0) {
    console.error(
      pc.red(
        `Schema validation failed with ${schemaFindings.length} error(s). Fix schema errors before running analysis.`,
      ),
    );
    for (const e of schemaFindings) {
      console.error(pc.red(`  ${e.file ?? ''}: ${e.message}`));
    }
    return 2;
  }

  // ── 3. Constraint analysis (dependency, pattern rules) ───────────────────
  // The constraint analysis agents are called here. For this implementation,
  // findings are sourced from the violation tolerances declared in the manifests
  // to demonstrate classification. A full implementation would also scan source
  // files for actual constraint violations.
  const constraintFindings: Finding[] = generateConstraintFindings(components);

  // ── 4. Decision log analysis ──────────────────────────────────────────────
  const decisionFindings: Finding[] = generateDecisionLogFindings(
    components,
    adrs,
    config.expiry_warn_days,
  );

  const allFindings: Finding[] = [
    ...schemaFindings,
    ...constraintFindings,
    ...decisionFindings,
  ];

  // ── 5. Intent resolution and classification ───────────────────────────────
  const report = intentResolve({
    findings: allFindings,
    components,
    adrs,
    config,
  });

  // ── 6. Output ─────────────────────────────────────────────────────────────
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (format === 'sarif') {
    console.log(renderSarif(report));
  } else {
    console.log(renderTable(report));
  }

  return report.summary.blocking > 0 ? 1 : 0;
}

/**
 * Generates findings for all violation tolerances declared in component
 * manifests. Each tactical/strategic tolerance implies the underlying
 * constraint is being violated.
 *
 * A full implementation would scan source files to detect actual violations
 * and only emit findings where code evidence exists.
 */
function generateConstraintFindings(
  components: ComponentManifest[],
): Finding[] {
  const findings: Finding[] = [];

  for (const component of components) {
    const tolerances = component.spec.violations ?? {};

    for (const t of tolerances.tactical ?? []) {
      findings.push(makeFinding({
        agent: 'dependency-analyzer',
        component: component.metadata.name,
        constraint: t.constraint,
        file: component._filePath,
        violation_type: 'constraint-violation',
        message: `Constraint '${t.constraint}' violated — covered by tactical tolerance '${t.id}'`,
        evidence: `Tolerance declared in ${component._filePath ?? 'folio.yaml'}`,
        confidence: 1.0,
      }));
    }

    for (const s of tolerances.strategic ?? []) {
      findings.push(makeFinding({
        agent: 'dependency-analyzer',
        component: component.metadata.name,
        constraint: s.constraint,
        file: component._filePath,
        violation_type: 'constraint-violation',
        message: `Constraint '${s.constraint}' violated — covered by strategic tolerance '${s.id}'`,
        evidence: `Tolerance declared in ${component._filePath ?? 'folio.yaml'}`,
        confidence: 1.0,
      }));
    }
  }

  return findings;
}

/**
 * Generates findings from the DecisionLogAnalyzer:
 * - Expired ADRs referenced by tolerances
 * - Revoked/superseded ADRs
 * - Expiry warnings
 * - Missing ADR references
 */
function generateDecisionLogFindings(
  components: ComponentManifest[],
  adrs: ArchDecision[],
  expiryWarnDays: number,
): Finding[] {
  const findings: Finding[] = [];
  const adrMap = new Map(adrs.map((a) => [a.metadata.name, a]));
  const now = new Date();

  applyExpiryTransitions(adrs, now, expiryWarnDays);

  for (const component of components) {
    const tolerances = component.spec.violations?.tactical ?? [];

    for (const t of tolerances) {
      const adr = adrMap.get(t.adr);

      if (!adr) {
        findings.push(makeFinding({
          agent: 'decision-log-analyzer',
          component: component.metadata.name,
          constraint: t.constraint,
          file: component._filePath,
          violation_type: 'tolerance-reference-error',
          message: `Tactical tolerance '${t.id}' references ADR '${t.adr}' which does not exist`,
          evidence: `adr: ${t.adr}`,
          confidence: 1.0,
        }));
        continue;
      }

      const effectiveStatus = adr._effectiveStatus ?? adr.spec.status;

      if (effectiveStatus === 'expired') {
        findings.push(makeFinding({
          agent: 'decision-log-analyzer',
          component: component.metadata.name,
          constraint: t.constraint,
          file: adr._filePath,
          violation_type: 'adr-expired',
          message: `ADR '${t.adr}' expired on ${adr.spec.expires}. Tactical tolerance '${t.id}' is no longer valid.`,
          evidence: `expires: ${adr.spec.expires}`,
          confidence: 1.0,
          raw_data: { expires: adr.spec.expires },
        }));
      } else if (effectiveStatus === 'revoked') {
        findings.push(makeFinding({
          agent: 'decision-log-analyzer',
          component: component.metadata.name,
          constraint: t.constraint,
          file: adr._filePath,
          violation_type: 'adr-revoked',
          message: `ADR '${t.adr}' was revoked: ${adr.spec.revoked_reason ?? 'no reason given'}`,
          evidence: `status: revoked`,
          confidence: 1.0,
        }));
      } else if (effectiveStatus === 'superseded') {
        findings.push(makeFinding({
          agent: 'decision-log-analyzer',
          component: component.metadata.name,
          constraint: t.constraint,
          file: adr._filePath,
          violation_type: 'adr-superseded',
          message: `ADR '${t.adr}' was superseded by '${adr.spec.superseded_by}'`,
          evidence: `superseded_by: ${adr.spec.superseded_by}`,
          confidence: 1.0,
        }));
      } else if (effectiveStatus === 'active') {
        // Check for upcoming expiry
        const expiryDate = new Date(adr.spec.expires);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysLeft = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / msPerDay,
        );
        if (daysLeft >= 0 && daysLeft <= expiryWarnDays) {
          findings.push(makeFinding({
            agent: 'decision-log-analyzer',
            component: component.metadata.name,
            constraint: t.constraint,
            file: adr._filePath,
            violation_type: 'expiry-warning',
            message: `ADR '${t.adr}' expires in ${daysLeft} day(s) on ${adr.spec.expires}. Owner: ${adr.spec.owner}`,
            evidence: `expires: ${adr.spec.expires}`,
            confidence: 1.0,
            raw_data: { days_until_expiry: daysLeft, expires: adr.spec.expires },
          }));
        }
      }
    }
  }

  return findings;
}
