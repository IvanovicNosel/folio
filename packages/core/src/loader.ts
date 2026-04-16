import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { ComponentManifest } from './types/component.js';
import type { ArchDecision } from './types/archdecision.js';

export class LoadError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = 'LoadError';
  }
}

/** Directories always excluded from recursive file search */
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'vendor',
  '__pycache__',
  '.pnpm-store',
]);

/**
 * Finds and loads all folio.yaml component manifests under a root directory.
 */
export function loadComponents(rootDir: string): ComponentManifest[] {
  const files = findFiles(resolve(rootDir), 'folio.yaml', false);

  return files.map((filePath) => {
    const raw = parseYaml(filePath);
    if (raw['kind'] !== 'Component') {
      throw new LoadError(
        filePath,
        `Expected kind: Component, got: ${String(raw['kind'])}`,
      );
    }
    const manifest = raw as unknown as ComponentManifest;
    manifest._filePath = filePath;
    return manifest;
  });
}

/**
 * Finds and loads all ArchDecision YAML files from a decisions directory.
 */
export function loadArchDecisions(decisionsDir: string): ArchDecision[] {
  const absDir = resolve(decisionsDir);
  if (!existsSync(absDir)) {
    return [];
  }

  const files = findFiles(absDir, '.yaml', true);

  const adrs: ArchDecision[] = [];
  for (const filePath of files) {
    let raw: Record<string, unknown>;
    try {
      raw = parseYaml(filePath);
    } catch {
      continue; // skip unparseable files in decisions dir
    }
    if (raw['kind'] !== 'ArchDecision') {
      continue; // skip non-ArchDecision YAML files silently
    }
    const adr = raw as unknown as ArchDecision;
    adr._filePath = filePath;
    adrs.push(adr);
  }
  return adrs;
}

function parseYaml(filePath: string): Record<string, unknown> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new LoadError(filePath, 'YAML file must contain an object');
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof LoadError) throw err;
    throw new LoadError(filePath, String(err));
  }
}

/**
 * Recursively walks `dir` and collects files matching the given suffix.
 *
 * @param suffix  When `suffixOnly` is true, matches files ending in suffix.
 *                When false, matches files whose name equals suffix exactly.
 */
function findFiles(dir: string, suffix: string, suffixOnly: boolean): string[] {
  const results: string[] = [];

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
        const matches = suffixOnly
          ? entry.name.endsWith(suffix)
          : entry.name === suffix;
        if (matches) {
          results.push(join(current, entry.name));
        }
      }
    }
  }

  walk(dir);
  return results;
}
