import pc from 'picocolors';
import { loadComponents, loadArchDecisions } from '@folio/core';
import { validateComponentManifest, validateArchDecisionDocument } from '../schema-validator.js';
import { resolve } from 'node:path';

export interface ValidateOptions {
  path: string;
  decisions?: string;
}

/**
 * `folio validate` — validates all folio.yaml and ArchDecision files against
 * their normative JSON schemas. Does not perform constraint analysis.
 *
 * Exit code 0 = all documents valid
 * Exit code 2 = one or more schema errors
 */
export async function runValidate(opts: ValidateOptions): Promise<number> {
  const rootDir = resolve(opts.path);
  const decisionsDir = resolve(opts.decisions ?? `${rootDir}/decisions`);

  console.log(pc.bold('\nFolio — Schema Validation'));
  console.log(pc.dim(`Target: ${rootDir}`));
  console.log('');

  let errorCount = 0;
  let fileCount = 0;

  // ── Validate component manifests ──────────────────────────────────────────
  let components;
  try {
    components = loadComponents(rootDir);
  } catch (err) {
    console.error(pc.red(`Failed to load component manifests: ${String(err)}`));
    return 2;
  }

  for (const component of components) {
    fileCount++;
    const errors = validateComponentManifest(component);
    if (errors.length === 0) {
      console.log(
        pc.green('✓') +
          pc.dim(` ${component._filePath ?? component.metadata.name}`),
      );
    } else {
      for (const e of errors) {
        console.log(pc.red('✗') + ` ${component._filePath ?? component.metadata.name}`);
        console.log(pc.red(`  ${e.message}`));
        errorCount++;
      }
    }
  }

  // ── Validate ArchDecision documents ───────────────────────────────────────
  const adrs = loadArchDecisions(decisionsDir);

  for (const adr of adrs) {
    fileCount++;
    const errors = validateArchDecisionDocument(adr);
    if (errors.length === 0) {
      console.log(
        pc.green('✓') + pc.dim(` ${adr._filePath ?? adr.metadata.name}`),
      );
    } else {
      for (const e of errors) {
        console.log(pc.red('✗') + ` ${adr._filePath ?? adr.metadata.name}`);
        console.log(pc.red(`  ${e.message}`));
        errorCount++;
      }
    }
  }

  console.log('');

  if (fileCount === 0) {
    console.log(pc.yellow('No folio.yaml or ArchDecision files found.'));
    console.log(pc.dim(`Run ${pc.bold('folio init')} to create a starter configuration.`));
    return 2;
  }

  if (errorCount === 0) {
    console.log(pc.green(pc.bold(`✓ ${fileCount} file(s) valid`)));
    return 0;
  } else {
    console.log(
      pc.red(pc.bold(`✗ ${errorCount} schema error(s) in ${fileCount} file(s)`)),
    );
    return 2;
  }
}
