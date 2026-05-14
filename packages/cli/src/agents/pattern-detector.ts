import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import type { ComponentManifest, PatternRule } from '@folio/core';
import type { Finding } from '@folio/core';
import { makeFinding } from '../finding-builder.js';
import { walkSourceFiles } from './source-walker.js';

/**
 * Scans the component's source files for pattern-rule violations
 * (must_not_match / must_match) and returns raw findings.
 */
export function detectPatterns(component: ComponentManifest): Finding[] {
  if (!component._filePath) return [];

  const componentDir = component._rootDir ?? dirname(resolve(component._filePath));
  const sourcePath = resolve(componentDir, component.spec.path ?? '.');
  const sourceFiles = walkSourceFiles(sourcePath);
  const findings: Finding[] = [];

  for (const constraint of component.spec.constraints ?? []) {
    if (constraint.rule.type !== 'pattern') continue;
    const rule = constraint.rule as PatternRule;

    // ── must_not_match ────────────────────────────────────────────────────────
    for (const entry of rule.must_not_match ?? []) {
      let regex: RegExp;
      try {
        regex = new RegExp(entry.pattern);
      } catch {
        // Invalid regex — skip, schema validation will catch this separately
        continue;
      }

      for (const filePath of sourceFiles) {
        const lines = readFileSync(filePath, 'utf-8').split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (regex.test(line)) {
            findings.push(
              makeFinding({
                agent: 'pattern-detector',
                component: component.metadata.name,
                constraint: constraint.id,
                file: filePath,
                line: i + 1,
                violation_type: 'constraint-violation',
                message:
                  entry.message ??
                  `Forbidden pattern '${entry.pattern}' found (rule: ${constraint.id})`,
                evidence: line.trim().slice(0, 200),
                confidence: 1.0,
              }),
            );
          }
        }
      }
    }

    // ── must_match ────────────────────────────────────────────────────────────
    for (const entry of rule.must_match ?? []) {
      let regex: RegExp;
      try {
        regex = new RegExp(entry.pattern);
      } catch {
        continue;
      }

      let found = false;
      for (const filePath of sourceFiles) {
        const content = readFileSync(filePath, 'utf-8');
        if (regex.test(content)) {
          found = true;
          break;
        }
      }

      if (!found) {
        findings.push(
          makeFinding({
            agent: 'pattern-detector',
            component: component.metadata.name,
            constraint: constraint.id,
            violation_type: 'constraint-violation',
            message:
              entry.message ??
              `Required pattern '${entry.pattern}' not found in any source file`,
            evidence: `Pattern '${entry.pattern}' absent from ${relative(process.cwd(), sourcePath)}`,
            confidence: 1.0,
          }),
        );
      }
    }
  }

  return findings;
}
