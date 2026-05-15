import { Ajv2020 as Ajv, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ComponentManifest, ArchDecision, Finding } from '@folio/core';
import { componentSchema, archdecisionSchema } from '@folio/core';
import { makeFinding } from './finding-builder.js';

const ajv = new Ajv({ allErrors: true });
// ajv-formats is a Plugin<Ajv>; the function signature is compatible but the
// module-level type is a namespace — force through unknown to satisfy TS.
(addFormats as unknown as (a: Ajv) => void)(ajv);

const validateComponent: ValidateFunction = ajv.compile(componentSchema as object);
const validateArchDecision: ValidateFunction = ajv.compile(archdecisionSchema as object);

/**
 * Builds a human-readable error message from an AJV error, listing allowed
 * values for enum failures so users (and AI agents) don't have to read source.
 */
function buildErrorMessage(err: { instancePath: string; message?: string; keyword?: string; params?: unknown }): string {
  const path = err.instancePath || '/';
  if (err.keyword === 'enum' && err.params && typeof err.params === 'object') {
    const params = err.params as { allowedValues?: unknown[] };
    if (Array.isArray(params.allowedValues)) {
      const allowed = params.allowedValues.map((v) => `'${v}'`).join(', ');
      return `Schema error at ${path}: must be one of ${allowed}`;
    }
  }
  return `Schema error at ${path}: ${err.message ?? 'unknown error'}`;
}

/**
 * Strips loader-injected internal fields (prefixed with _) before schema validation.
 */
function stripInternals(obj: object): object {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !k.startsWith('_')),
  );
}

/**
 * Validates a loaded ComponentManifest object against the normative JSON Schema.
 * Returns schema-error findings for any validation failures.
 */
export function validateComponentManifest(
  manifest: ComponentManifest,
): Finding[] {
  const valid = validateComponent(stripInternals(manifest as object));
  if (valid) return [];

  return (validateComponent.errors ?? []).map((err) =>
    makeFinding({
      agent: 'schema-validator',
      component: manifest.metadata?.name ?? '<unknown>',
      constraint: 'schema',
      file: manifest._filePath,
      violation_type: 'schema-error',
      message: buildErrorMessage(err),
      evidence: JSON.stringify(err.params),
      confidence: 1.0,
    }),
  );
}

/**
 * Validates a loaded ArchDecision object against the normative JSON Schema.
 * Returns schema-error findings for any validation failures.
 */
export function validateArchDecisionDocument(adr: ArchDecision): Finding[] {
  const valid = validateArchDecision(stripInternals(adr as object));
  if (valid) return [];

  return (validateArchDecision.errors ?? []).map((err) =>
    makeFinding({
      agent: 'schema-validator',
      component: adr.spec?.component ?? '<unknown>',
      constraint: 'schema',
      file: adr._filePath,
      violation_type: 'schema-error',
      message: buildErrorMessage(err),
      evidence: JSON.stringify(err.params),
      confidence: 1.0,
    }),
  );
}
