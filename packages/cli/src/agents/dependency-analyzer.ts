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
  // Java import: import static com.example.Type.member; / import com.example.Type;
  /\bimport\s+(?:static\s+)?([\w.*]+)\s*;/g,
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
 * For JS/TS: '@scope/pkg/sub' → '@scope/pkg', 'pkg/sub' → 'pkg'
 * Java imports are intentionally returned whole so policy entries can match
 * package prefixes such as 'com.company.module'.
 */
function packageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  if (!specifier.includes('/')) {
    return specifier;
  }
  return specifier.split('/')[0]!;
}

function matchesSpecifier(specifier: string, pattern: string): boolean {
  return (
    specifier === pattern ||
    specifier.startsWith(`${pattern}/`) ||
    specifier.startsWith(`${pattern}.`)
  );
}

function isModuleSpecifier(specifier: string, rule: ModuleRule): boolean {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return true;
  const configured = [
    ...(rule.deny_imports_from ?? []),
    ...(rule.allow_imports_from ?? []),
  ];
  return configured.some((entry) => matchesModuleSpecifier(specifier, entry));
}

function matchesModuleSpecifier(specifier: string, pattern: string): boolean {
  const normalizedSpecifier = normalizeModuleSpecifier(specifier);
  const normalizedPattern = normalizeModuleSpecifier(pattern);
  return (
    normalizedSpecifier === normalizedPattern ||
    normalizedSpecifier.startsWith(`${normalizedPattern}/`)
  );
}

function normalizeModuleSpecifier(value: string): string {
  return value.replace(/\.js$/, '').replace(/\./g, '/').replace(/\/+/g, '/');
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

  const componentDir = component._rootDir ?? dirname(resolve(component._filePath));
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

        if (rule.deny) {
          for (const specifier of specifiers) {
            const pkg = packageName(specifier);
            if (
              rule.deny.some(
                (d) => matchesSpecifier(specifier, d) || matchesSpecifier(pkg, d),
              )
            ) {
              findings.push(
                makeFinding({
                  agent: 'dependency-analyzer',
                  component: component.metadata.name,
                  constraint: constraint.id,
                  file: filePath,
                  line: findLine(lines, specifier),
                  violation_type: 'constraint-violation',
                  message: `Forbidden dependency '${specifier}' imported (rule: ${constraint.id})`,
                  evidence: `import '${specifier}' in ${relative(componentDir, filePath)}`,
                  confidence: 1.0,
                }),
              );
            }
          }
        }

        if (rule.allow_only) {
          const packages = specifiers
            .filter((s) => !s.startsWith('.') && !s.startsWith('/'))
            .map(packageName);

          for (const pkg of packages) {
            if (!rule.allow_only.some((allowed) => matchesSpecifier(pkg, allowed))) {
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

        const internalSpecifiers = specifiers.filter((s) => isModuleSpecifier(s, rule));

        if (rule.deny_imports_from) {
          for (const specifier of internalSpecifiers) {
            for (const denied of rule.deny_imports_from) {
              if (matchesModuleSpecifier(specifier, denied)) {
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
                break;
              }
            }
          }
        }

        if (rule.allow_imports_from) {
          for (const specifier of internalSpecifiers) {
            const allowed = rule.allow_imports_from.some((a) =>
              matchesModuleSpecifier(specifier, a),
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
  const componentDir =
    component._rootDir ?? dirname(resolve(component._filePath ?? 'folio.yaml'));
  return join(componentDir, component.spec.path ?? '.');
}
