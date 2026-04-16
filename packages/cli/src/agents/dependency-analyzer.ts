import { readFileSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import type { ComponentManifest, DependencyRule, ModuleRule } from '@folio/core';
import type { Finding } from '@folio/core';
import { makeFinding } from '../finding-builder.js';
import { walkSourceFiles } from './source-walker.js';

/**
 * Regexes that extract the module specifier from import/require statements.
 * Each has a single capture group containing the specifier string.
 */
const IMPORT_PATTERNS = [
  // import ... from 'pkg'  /  import 'pkg'
  /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // require('pkg')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // await import('pkg')  /  import('pkg')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * Extracts all module specifiers from source file content.
 */
function extractSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      specifiers.push(m[1]!);
    }
  }
  return specifiers;
}

/**
 * Returns the top-level package name from a bare (non-relative) specifier.
 * e.g. 'pg/native' → 'pg', '@scope/pkg/sub' → '@scope/pkg'
 */
function packageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  return specifier.split('/')[0]!;
}

/**
 * Returns the 1-based line number of the first line containing `needle`.
 */
function findLine(lines: string[], needle: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(needle)) return i + 1;
  }
  return 1;
}

/**
 * Scans the component's source files for dependency-rule and module-rule
 * violations and returns raw (unclassified) findings.
 */
export function analyzeDependencies(component: ComponentManifest): Finding[] {
  if (!component._filePath) return [];

  const componentDir = dirname(resolve(component._filePath));
  const sourcePath = resolve(componentDir, component.spec.path ?? '.');
  const sourceFiles = walkSourceFiles(sourcePath);
  const findings: Finding[] = [];

  for (const constraint of component.spec.constraints ?? []) {
    // ── dependency rules ──────────────────────────────────────────────────────
    if (constraint.rule.type === 'dependency') {
      const rule = constraint.rule as DependencyRule;

      for (const filePath of sourceFiles) {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const specifiers = extractSpecifiers(content);
        const packages = specifiers
          .filter((s) => !s.startsWith('.') && !s.startsWith('/'))
          .map(packageName);

        if (rule.deny) {
          for (const pkg of packages) {
            if (rule.deny.includes(pkg)) {
              findings.push(
                makeFinding({
                  agent: 'dependency-analyzer',
                  component: component.metadata.name,
                  constraint: constraint.id,
                  file: filePath,
                  line: findLine(lines, pkg),
                  violation_type: 'constraint-violation',
                  message: `Forbidden dependency '${pkg}' imported (rule: ${constraint.id})`,
                  evidence: `import '${pkg}' in ${relative(componentDir, filePath)}`,
                  confidence: 1.0,
                }),
              );
            }
          }
        }

        if (rule.allow_only) {
          for (const pkg of packages) {
            if (!rule.allow_only.includes(pkg)) {
              findings.push(
                makeFinding({
                  agent: 'dependency-analyzer',
                  component: component.metadata.name,
                  constraint: constraint.id,
                  file: filePath,
                  line: findLine(lines, pkg),
                  violation_type: 'constraint-violation',
                  message: `Dependency '${pkg}' is not in the allow_only list`,
                  evidence: `import '${pkg}' in ${relative(componentDir, filePath)}`,
                  confidence: 0.9,
                }),
              );
            }
          }
        }
      }
    }

    // ── module rules ──────────────────────────────────────────────────────────
    if (constraint.rule.type === 'module') {
      const rule = constraint.rule as ModuleRule;

      for (const filePath of sourceFiles) {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const specifiers = extractSpecifiers(content);
        const relativeSpecifiers = specifiers.filter(
          (s) => s.startsWith('.') || s.startsWith('/'),
        );

        if (rule.deny_imports_from) {
          for (const specifier of relativeSpecifiers) {
            for (const denied of rule.deny_imports_from) {
              const normalised = denied.endsWith('/') ? denied : denied;
              if (
                specifier === normalised ||
                specifier.startsWith(normalised + '/') ||
                // also match without trailing .js extension differences
                specifier.replace(/\.js$/, '') === normalised.replace(/\.js$/, '') ||
                specifier.replace(/\.js$/, '').startsWith(normalised.replace(/\.js$/, '') + '/')
              ) {
                findings.push(
                  makeFinding({
                    agent: 'dependency-analyzer',
                    component: component.metadata.name,
                    constraint: constraint.id,
                    file: filePath,
                    line: findLine(lines, specifier),
                    violation_type: 'constraint-violation',
                    message: `Forbidden module import '${specifier}' matches denied path '${denied}'`,
                    evidence: `import '${specifier}' in ${relative(componentDir, filePath)}`,
                    confidence: 1.0,
                  }),
                );
                break; // avoid duplicate findings for same specifier
              }
            }
          }
        }

        if (rule.allow_imports_from) {
          for (const specifier of relativeSpecifiers) {
            const allowed = rule.allow_imports_from.some(
              (a) =>
                specifier === a ||
                specifier.startsWith(a + '/') ||
                specifier.replace(/\.js$/, '') === a.replace(/\.js$/, '') ||
                specifier.replace(/\.js$/, '').startsWith(a.replace(/\.js$/, '') + '/'),
            );
            if (!allowed) {
              findings.push(
                makeFinding({
                  agent: 'dependency-analyzer',
                  component: component.metadata.name,
                  constraint: constraint.id,
                  file: filePath,
                  line: findLine(lines, specifier),
                  violation_type: 'constraint-violation',
                  message: `Module import '${specifier}' is not in the allow_imports_from list`,
                  evidence: `import '${specifier}' in ${relative(componentDir, filePath)}`,
                  confidence: 0.9,
                }),
              );
            }
          }
        }
      }
    }
  }

  return findings;
}

/**
 * Resolves the absolute path of a component's source directory.
 */
export function componentSourcePath(component: ComponentManifest): string {
  const componentDir = dirname(resolve(component._filePath ?? 'folio.yaml'));
  return join(componentDir, component.spec.path ?? '.');
}
