import { readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  'vendor',
  '__pycache__',
  '.pnpm-store',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
]);

/**
 * Returns true if `relPath` (relative to the walk root) matches any of the
 * caller-supplied exclude patterns. Patterns are treated as path prefixes;
 * trailing slashes and glob wildcards are stripped before comparison.
 */
function isExcludedByPattern(relPath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const prefix = pattern.replace(/[/\\]?\*+.*$/, '').replace(/[/\\]$/, '');
    if (!prefix) return false;
    const normalized = prefix.split('/').join(sep);
    return relPath === normalized || relPath.startsWith(normalized + sep);
  });
}

/**
 * Recursively collects all source files under `dir`, excluding known
 * non-source directories and any paths matching `excludePatterns`.
 * Patterns in `excludePatterns` are relative to `dir` and support simple
 * prefix matching (e.g. `"generated"`, `"src/test"`, `"src/test/**"`).
 */
export function walkSourceFiles(dir: string, excludePatterns: string[] = []): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(current: string): void {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const relPath = relative(dir, fullPath);
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name) && !isExcludedByPattern(relPath, excludePatterns)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf('.');
        const ext = dot >= 0 ? entry.name.slice(dot) : '';
        if (SOURCE_EXTENSIONS.has(ext) && !isExcludedByPattern(relPath, excludePatterns)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}
