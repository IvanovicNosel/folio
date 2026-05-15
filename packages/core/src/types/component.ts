/**
 * Folio Component Description Language — TypeScript types
 * Mirrors the normative schema defined in spec/DSL-GRAMMAR.md
 */

export type ComponentType =
  | 'service'
  | 'library'
  | 'gateway'
  | 'frontend'
  | 'worker'
  | 'database'
  | 'infrastructure'
  | 'system'
  | 'module'
  | 'other';

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'java'
  | 'rust'
  | 'csharp'
  | 'ruby'
  | 'other';

export type ConstraintSeverity = 'tactical' | 'strategic';

// ─── Rule types ─────────────────────────────────────────────────────────────

export interface DependencyRule {
  type: 'dependency';
  deny?: string[];
  allow_only?: string[];
}

export interface ModuleRule {
  type: 'module';
  deny_imports_from?: string[];
  allow_imports_from?: string[];
}

export interface PatternEntry {
  pattern: string;
  message?: string;
}

export interface PatternRule {
  type: 'pattern';
  must_not_match?: PatternEntry[];
  must_match?: PatternEntry[];
}

export interface StructuralLayer {
  name: string;
  path: string;
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface StructuralRule {
  type: 'structural';
  layers: StructuralLayer[];
  allow_flow: FlowEdge[];
}

export type Rule = DependencyRule | ModuleRule | PatternRule | StructuralRule;

// ─── Constraint ──────────────────────────────────────────────────────────────

export interface Constraint {
  id: string;
  description: string;
  rule: Rule;
  severity: ConstraintSeverity;
  rationale?: string;
  references?: string[];
}

// ─── Violation Tolerances ────────────────────────────────────────────────────

export interface TacticalTolerance {
  id: string;
  constraint: string;
  adr: string;
  expires: string;   // ISO 8601 date
  owner: string;
  reason: string;
  max_age_days?: number;
}

export type ApprovalBody = 'architecture-board' | 'security-board' | 'cto';

export interface StrategicTolerance {
  id: string;
  constraint: string;
  rfc: string;
  approval: ApprovalBody;
  approver: string;
  reason: string;
}

export interface ViolationTolerances {
  tactical?: TacticalTolerance[];
  strategic?: StrategicTolerance[];
}

// ─── Component manifest ──────────────────────────────────────────────────────

export interface ComponentMetadata {
  name: string;
  owner: string;
  tags?: string[];
  description?: string;
}

export interface ComponentSpec {
  type: ComponentType;
  language: Language;
  path?: string;
  exclude?: string[];
  constraints?: Constraint[];
  violations?: ViolationTolerances;
}

export interface ComponentManifest {
  kind: 'Component';
  apiVersion: 'folio/v1alpha1';
  metadata: ComponentMetadata;
  spec: ComponentSpec;
  /** Resolved file path - set by the loader, not part of the YAML */
  _filePath?: string;
  /** Resolved component root - set by the loader, not part of the YAML */
  _rootDir?: string;
}
