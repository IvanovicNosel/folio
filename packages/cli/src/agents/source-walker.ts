import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
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
 * Recursively collects all source files under `dir`, excluding known
 * non-source directories.
 */
export function walkSourceFiles(dir: string): string[] {
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
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walk(join(current, entry.name));
        }
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf('.');
        const ext = dot >= 0 ? entry.name.slice(dot) : '';
        if (SOURCE_EXTENSIONS.has(ext)) {
          results.push(join(current, entry.name));
        }
      }
    }
  }

  walk(dir);
  return results;
}
