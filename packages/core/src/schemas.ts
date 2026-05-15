/**
 * JSON Schema objects for Component and ArchDecision documents.
 * Exported as TypeScript constants to avoid JSON import complications
 * across ESM/CJS boundaries.
 */

export const componentSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'folio/v1alpha1/component',
  title: 'Folio Component Manifest',
  type: 'object',
  required: ['kind', 'apiVersion', 'metadata', 'spec'],
  additionalProperties: false,
  properties: {
    kind: { const: 'Component' },
    apiVersion: { const: 'folio/v1alpha1' },
    metadata: {
      type: 'object',
      required: ['name', 'owner'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
        owner: { type: 'string', minLength: 1 },
        tags: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
      },
    },
    spec: {
      type: 'object',
      required: ['type', 'language'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: [
            'service', 'library', 'gateway', 'frontend',
            'worker', 'database', 'infrastructure',
            'system', 'module', 'other',
          ],
        },
        language: {
          type: 'string',
          enum: [
            'typescript', 'javascript', 'python', 'go',
            'java', 'rust', 'csharp', 'ruby', 'other',
          ],
        },
        path: { type: 'string', default: '.' },
        exclude: { type: 'array', items: { type: 'string' }, default: [] },
        constraints: { type: 'array', items: { $ref: '#/$defs/constraint' } },
        violations: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tactical: { type: 'array', items: { $ref: '#/$defs/tacticalTolerance' } },
            strategic: { type: 'array', items: { $ref: '#/$defs/strategicTolerance' } },
          },
        },
      },
    },
  },
  $defs: {
    constraint: {
      type: 'object',
      required: ['id', 'description', 'rule', 'severity'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
        description: { type: 'string', minLength: 1 },
        rule: {
          oneOf: [
            { $ref: '#/$defs/dependencyRule' },
            { $ref: '#/$defs/moduleRule' },
            { $ref: '#/$defs/patternRule' },
            { $ref: '#/$defs/structuralRule' },
          ],
        },
        severity: { type: 'string', enum: ['tactical', 'strategic'] },
        rationale: { type: 'string' },
        references: { type: 'array', items: { type: 'string' } },
      },
    },
    dependencyRule: {
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: { const: 'dependency' },
        deny: { type: 'array', items: { type: 'string' }, minItems: 1 },
        allow_only: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
    },
    moduleRule: {
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: { const: 'module' },
        deny_imports_from: { type: 'array', items: { type: 'string' } },
        allow_imports_from: { type: 'array', items: { type: 'string' } },
      },
    },
    patternEntry: {
      type: 'object',
      required: ['pattern'],
      additionalProperties: false,
      properties: {
        pattern: { type: 'string' },
        message: { type: 'string' },
      },
    },
    patternRule: {
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: { const: 'pattern' },
        must_not_match: { type: 'array', items: { $ref: '#/$defs/patternEntry' } },
        must_match: { type: 'array', items: { $ref: '#/$defs/patternEntry' } },
      },
    },
    structuralLayer: {
      type: 'object',
      required: ['name', 'path'],
      additionalProperties: false,
      properties: { name: { type: 'string' }, path: { type: 'string' } },
    },
    flowEdge: {
      type: 'object',
      required: ['from', 'to'],
      additionalProperties: false,
      properties: { from: { type: 'string' }, to: { type: 'string' } },
    },
    structuralRule: {
      type: 'object',
      required: ['type', 'layers', 'allow_flow'],
      additionalProperties: false,
      properties: {
        type: { const: 'structural' },
        layers: { type: 'array', items: { $ref: '#/$defs/structuralLayer' }, minItems: 2 },
        allow_flow: { type: 'array', items: { $ref: '#/$defs/flowEdge' } },
      },
    },
    tacticalTolerance: {
      type: 'object',
      required: ['id', 'constraint', 'adr', 'expires', 'owner', 'reason'],
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        constraint: { type: 'string' },
        adr: { type: 'string' },
        expires: { type: 'string', format: 'date' },
        owner: { type: 'string', minLength: 1 },
        reason: { type: 'string', minLength: 1 },
        max_age_days: { type: 'integer', minimum: 1 },
      },
    },
    strategicTolerance: {
      type: 'object',
      required: ['id', 'constraint', 'rfc', 'approval', 'approver', 'reason'],
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        constraint: { type: 'string' },
        rfc: { type: 'string' },
        approval: {
          type: 'string',
          enum: ['architecture-board', 'security-board', 'cto'],
        },
        approver: { type: 'string', minLength: 1 },
        reason: { type: 'string', minLength: 1 },
      },
    },
  },
} as const;

export const archdecisionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'folio/v1alpha1/archdecision',
  title: 'Folio ArchDecision',
  type: 'object',
  required: ['kind', 'apiVersion', 'metadata', 'spec'],
  additionalProperties: false,
  properties: {
    kind: { const: 'ArchDecision' },
    apiVersion: { const: 'folio/v1alpha1' },
    metadata: {
      type: 'object',
      required: ['name', 'created'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', pattern: '^[A-Z]+-[0-9]+$' },
        created: { type: 'string', format: 'date' },
        updated: { type: 'string', format: 'date' },
      },
    },
    spec: {
      type: 'object',
      required: [
        'title', 'status', 'component', 'constraints',
        'decision', 'rationale', 'expires', 'owner', 'approver',
      ],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1 },
        status: { type: 'string', enum: ['draft', 'active', 'expired', 'superseded', 'revoked'] },
        component: { type: 'string', minLength: 1 },
        constraints: { type: 'array', items: { type: 'string' }, minItems: 1 },
        decision: { type: 'string', minLength: 1 },
        rationale: { type: 'string', minLength: 1 },
        consequences: { type: 'string' },
        expires: { type: 'string', format: 'date' },
        owner: { type: 'string', minLength: 1 },
        approver: { type: 'string', minLength: 1 },
        superseded_by: { type: 'string' },
        revoked_reason: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        links: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;
