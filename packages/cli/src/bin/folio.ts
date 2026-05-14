#!/usr/bin/env node
import { program } from 'commander';
import { runValidate } from '../commands/validate.js';
import { runCheck } from '../commands/check.js';
import { runInit } from '../commands/init.js';
import { runAdrList, runAdrStatus } from '../commands/adr.js';

const VERSION = '0.1.0';

program
  .name('folio')
  .description('Architectural intent validation — make architectural drift visible and governable')
  .version(VERSION);

// ── folio validate ────────────────────────────────────────────────────────────
program
  .command('validate [path]')
  .description('Validate folio.yaml and ArchDecision files against their schemas')
  .option('-d, --decisions <path>', 'Path to decisions directory', './decisions')
  .action(async (path: string | undefined, options: { decisions: string }) => {
    const code = await runValidate({
      path: path ?? '.',
      decisions: options.decisions,
    });
    process.exit(code);
  });

// ── folio check ───────────────────────────────────────────────────────────────
program
  .command('check [path]')
  .description('Run the full Investigator analysis and classify all violations')
  .option('-d, --decisions <path>', 'Path to decisions directory', './decisions')
  .option(
    '-f, --format <format>',
    'Output format: table | json | sarif',
    'table',
  )
  .option(
    '--confidence-threshold <number>',
    'Minimum confidence to treat a finding as blocking (default: 0.7)',
    parseFloat,
  )
  .option(
    '--normalization-threshold <number>',
    'Component count to trigger normalization signal (default: 2)',
    parseInt,
  )
  .option(
    '--expiry-warn-days <number>',
    'Days before ADR expiry to emit a warning (default: 30)',
    parseInt,
  )
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(
    async (
      path: string | undefined,
      options: {
        decisions: string;
        format: string;
        confidenceThreshold?: number;
        normalizationThreshold?: number;
        expiryWarnDays?: number;
        quiet?: boolean;
      },
    ) => {
      const format = options.format as 'table' | 'json' | 'sarif';
      const code = await runCheck({
        path: path ?? '.',
        decisions: options.decisions,
        format,
        ...(options.confidenceThreshold !== undefined ? { confidenceThreshold: options.confidenceThreshold } : {}),
        ...(options.normalizationThreshold !== undefined ? { normalizationThreshold: options.normalizationThreshold } : {}),
        ...(options.expiryWarnDays !== undefined ? { expiryWarnDays: options.expiryWarnDays } : {}),
        ...(options.quiet !== undefined ? { quiet: options.quiet } : {}),
      });
      process.exit(code);
    },
  );

// ── folio init ────────────────────────────────────────────────────────────────
program
  .command('init [path]')
  .description('Generate a starter folio.yaml and ADR template')
  .option('-n, --name <name>', 'Component name')
  .option('-o, --owner <owner>', 'Component owner (team or email)')
  .option('-t, --type <type>', 'Component type (service|library|gateway|frontend|worker|database|infrastructure)', 'service')
  .option('-l, --language <language>', 'Primary language (typescript|python|go|...)', 'typescript')
  .action(
    async (
      path: string | undefined,
      options: {
        name?: string;
        owner?: string;
        type?: string;
        language?: string;
      },
    ) => {
      const code = await runInit({
        path: path ?? '.',
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.owner !== undefined ? { owner: options.owner } : {}),
        ...(options.type !== undefined ? { type: options.type } : {}),
        ...(options.language !== undefined ? { language: options.language } : {}),
      });
      process.exit(code);
    },
  );

// ── folio adr ─────────────────────────────────────────────────────────────────
const adr = program
  .command('adr')
  .description('Manage and inspect ArchDecision records');

adr
  .command('list')
  .description('List all ArchDecision records and their status')
  .option('-d, --decisions <path>', 'Path to decisions directory', './decisions')
  .action(async (options: { decisions: string }) => {
    const code = await runAdrList({ decisions: options.decisions });
    process.exit(code);
  });

adr
  .command('status <name>')
  .description('Show the full status and detail of a specific ArchDecision')
  .option('-d, --decisions <path>', 'Path to decisions directory', './decisions')
  .action(async (name: string, options: { decisions: string }) => {
    const code = await runAdrStatus({ decisions: options.decisions, name });
    process.exit(code);
  });

program.parse();
