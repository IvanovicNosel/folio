import pc from 'picocolors';
import { componentSchema, archdecisionSchema } from '@folio/core';

export interface DescribeSchemaOptions {
  json: boolean;
  schema: 'component' | 'archdecision' | 'all';
}

const SCHEMAS = {
  component: componentSchema,
  archdecision: archdecisionSchema,
} as const;

// ── JSON output ───────────────────────────────────────────────────────────────

function emitJson(opts: DescribeSchemaOptions): void {
  if (opts.schema === 'all') {
    console.log(JSON.stringify(SCHEMAS, null, 2));
  } else {
    console.log(JSON.stringify(SCHEMAS[opts.schema], null, 2));
  }
}

// ── Human-readable output helpers ─────────────────────────────────────────────

function row(name: string, required: boolean, type: string, notes: string): void {
  const req = required ? pc.red('*') : ' ';
  const col1 = pc.bold(name.padEnd(28));
  const col2 = pc.cyan(type.padEnd(22));
  console.log(`  ${req} ${col1} ${col2} ${pc.dim(notes)}`);
}

function section(title: string): void {
  console.log('');
  console.log(pc.bold(pc.underline(title)));
}

function enumList(values: readonly string[]): string {
  return values.map((v) => `"${v}"`).join(' | ');
}

// ── Component schema description ──────────────────────────────────────────────

function describeComponent(): void {
  section('Component Manifest  (kind: Component, apiVersion: folio/v1alpha1)');
  console.log('');
  console.log('  ' + pc.dim('* = required field'));
  console.log('');

  console.log(pc.bold('  metadata'));
  row('metadata.name',    true,  'string (^[a-z][a-z0-9-]*$)', 'slug-style identifier');
  row('metadata.owner',   true,  'string',                      'team name or email');
  row('metadata.tags',    false, 'string[]',                    'free-form labels');
  row('metadata.description', false, 'string',                  'human description');

  console.log('');
  console.log(pc.bold('  spec'));

  const componentTypes = (componentSchema.properties.spec.properties.type as unknown as { enum: readonly string[] }).enum;
  const languages = (componentSchema.properties.spec.properties.language as unknown as { enum: readonly string[] }).enum;

  row('spec.type',        true,  'enum',    enumList(componentTypes));
  row('spec.language',    true,  'enum',    enumList(languages));
  row('spec.path',        false, 'string',  'root dir for source scanning (default: ".")');
  row('spec.exclude',     false, 'string[]','path prefixes to skip during scanning (e.g. "generated", "src/test/**")');
  row('spec.constraints', false, 'Constraint[]', 'see Constraint shape below');
  row('spec.violations',  false, 'ViolationTolerances', 'tactical / strategic tolerances');

  section('Constraint');
  row('id',          true,  'string (^[a-z][a-z0-9-]*$)', 'unique constraint identifier');
  row('description', true,  'string',                      'human description');
  row('severity',    true,  'enum',                        '"tactical" | "strategic"');
  row('rule',        true,  'Rule',                        'see Rule types below');
  row('rationale',   false, 'string',                      '');
  row('references',  false, 'string[]',                    '');

  section('Rule types  (rule.type determines shape)');
  console.log('');
  console.log(`  ${pc.bold('"dependency"')}   deny?: string[]   allow_only?: string[]`);
  console.log(`  ${pc.bold('"module"')}       deny_imports_from?: string[]   allow_imports_from?: string[]`);
  console.log(`  ${pc.bold('"pattern"')}      must_not_match?: PatternEntry[]   must_match?: PatternEntry[]`);
  console.log(`  ${pc.bold('"structural"')}   layers: {name,path}[]   allow_flow: {from,to}[]`);
  console.log('');
  console.log('  PatternEntry: { pattern: string (regex), message?: string }');
}

// ── ArchDecision schema description ───────────────────────────────────────────

function describeArchDecision(): void {
  section('ArchDecision  (kind: ArchDecision, apiVersion: folio/v1alpha1)');
  console.log('');
  console.log('  ' + pc.dim('* = required field'));
  console.log('');

  console.log(pc.bold('  metadata'));
  row('metadata.name',    true,  'string (^[A-Z]+-[0-9]+$)', 'e.g. "ADR-001"');
  row('metadata.created', true,  'date',                      'ISO 8601, e.g. "2025-01-15"');
  row('metadata.updated', false, 'date',                      '');

  console.log('');
  console.log(pc.bold('  spec'));

  const statuses = (archdecisionSchema.properties.spec.properties.status as unknown as { enum: readonly string[] }).enum;
  row('spec.title',        true,  'string',   '');
  row('spec.status',       true,  'enum',     enumList(statuses));
  row('spec.component',    true,  'string',   'must match a component metadata.name');
  row('spec.constraints',  true,  'string[]', 'constraint ids this ADR covers');
  row('spec.decision',     true,  'string',   'what was decided');
  row('spec.rationale',    true,  'string',   'why');
  row('spec.expires',      true,  'date',     'ISO 8601');
  row('spec.owner',        true,  'string',   '');
  row('spec.approver',     true,  'string',   '');
  row('spec.consequences', false, 'string',   '');
  row('spec.superseded_by',false, 'string',   '');
  row('spec.revoked_reason',false,'string',   '');
  row('spec.tags',         false, 'string[]', '');
  row('spec.links',        false, 'string[]', '');
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runDescribeSchema(opts: DescribeSchemaOptions): Promise<number> {
  if (opts.json) {
    emitJson(opts);
    return 0;
  }

  console.log(pc.bold('\nFolio — Schema Reference'));
  console.log(pc.dim('Use --json to get machine-readable JSON Schema output'));

  if (opts.schema === 'all' || opts.schema === 'component') {
    describeComponent();
  }
  if (opts.schema === 'all' || opts.schema === 'archdecision') {
    describeArchDecision();
  }

  console.log('');
  return 0;
}
