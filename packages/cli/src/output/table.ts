import pc from 'picocolors';
import type { FolioReport, ClassifiedFinding } from '@folio/core';

const CLASSIFICATION_LABELS: Record<string, string> = {
  BLOCKING: pc.red('BLOCKING'),
  TACTICAL: pc.yellow('TACTICAL'),
  STRATEGIC_APPROVED: pc.blue('APPROVED'),
  ADVISORY: pc.cyan('ADVISORY'),
  WARNING: pc.magenta('WARNING'),
};

const CLASSIFICATION_ICONS: Record<string, string> = {
  BLOCKING: '✗',
  TACTICAL: '◎',
  STRATEGIC_APPROVED: '●',
  ADVISORY: '?',
  WARNING: '⚠',
};

export function renderTable(report: FolioReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold('Folio — Architectural Intent Analysis'));
  lines.push(pc.dim(`Generated: ${report.generated_at}`));
  lines.push('');

  // Summary
  const { summary } = report;
  const summaryParts: string[] = [];

  if (summary.blocking > 0) {
    summaryParts.push(pc.red(`${summary.blocking} blocking`));
  }
  if (summary.tactical > 0) {
    summaryParts.push(pc.yellow(`${summary.tactical} tactical`));
  }
  if (summary.strategic_approved > 0) {
    summaryParts.push(pc.blue(`${summary.strategic_approved} approved`));
  }
  if (summary.advisory > 0) {
    summaryParts.push(pc.cyan(`${summary.advisory} advisory`));
  }
  if (summary.warnings > 0) {
    summaryParts.push(pc.magenta(`${summary.warnings} warnings`));
  }

  if (summaryParts.length === 0) {
    lines.push(pc.green('✓ No violations found'));
  } else {
    lines.push(pc.bold('Summary: ') + summaryParts.join(' · '));
  }

  lines.push('');

  // Group findings by component
  const byComponent = new Map<string, ClassifiedFinding[]>();
  for (const f of report.findings) {
    const existing = byComponent.get(f.component) ?? [];
    existing.push(f);
    byComponent.set(f.component, existing);
  }

  // Render blocking findings first, then others
  const sortOrder: ClassifiedFinding['classification'][] = [
    'BLOCKING',
    'WARNING',
    'TACTICAL',
    'STRATEGIC_APPROVED',
    'ADVISORY',
  ];

  for (const [component, findings] of byComponent) {
    const sorted = [...findings].sort(
      (a, b) =>
        sortOrder.indexOf(a.classification) -
        sortOrder.indexOf(b.classification),
    );

    lines.push(pc.bold(`Component: ${component}`));
    lines.push(pc.dim('─'.repeat(60)));

    for (const f of sorted) {
      const icon = CLASSIFICATION_ICONS[f.classification] ?? '·';
      const label = CLASSIFICATION_LABELS[f.classification] ?? f.classification;
      const location = f.file
        ? pc.dim(` ${f.file}${f.line ? `:${f.line}` : ''}`)
        : '';

      lines.push(
        `  ${icon} ${label} ${pc.bold(f.constraint)}${location}`,
      );
      lines.push(`    ${f.message}`);

      if (f.adr) {
        lines.push(pc.dim(`    ADR: ${f.adr}`));
      }
      if (f.tolerance_id) {
        lines.push(pc.dim(`    Tolerance: ${f.tolerance_id}`));
      }
      if (
        f.violation_type === 'normalization-signal' &&
        typeof f.raw_data === 'object' &&
        f.raw_data !== null
      ) {
        const data = f.raw_data as { affected_components: string[] };
        lines.push(
          pc.dim(`    Normalizing across: ${data.affected_components.join(', ')}`),
        );
      }
      lines.push('');
    }
  }

  // Final status line
  if (summary.blocking > 0) {
    lines.push(
      pc.red(
        pc.bold(`✗ Analysis failed — ${summary.blocking} blocking violation(s) found`),
      ),
    );
  } else {
    lines.push(pc.green(pc.bold('✓ Analysis passed')));
  }
  lines.push('');

  return lines.join('\n');
}
