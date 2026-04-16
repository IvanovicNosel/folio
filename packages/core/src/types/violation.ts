/**
 * Folio Investigator Protocol — finding and report types
 * Mirrors the normative schema defined in spec/INVESTIGATOR-PROTOCOL.md
 */

export type AgentId =
  | 'schema-validator'
  | 'dependency-analyzer'
  | 'pattern-detector'
  | 'decision-log-analyzer'
  | 'intent-resolver';

export type ViolationType =
  | 'constraint-violation'
  | 'tolerance-reference-error'
  | 'adr-expired'
  | 'adr-revoked'
  | 'adr-superseded'
  | 'normalization-signal'
  | 'expiry-warning'
  | 'schema-error';

export type ViolationClassification =
  | 'BLOCKING'
  | 'TACTICAL'
  | 'STRATEGIC_APPROVED'
  | 'ADVISORY'
  | 'WARNING';

export interface Finding {
  agent: AgentId;
  component: string;
  constraint: string;
  file?: string;
  line?: number;
  column?: number;
  violation_type: ViolationType;
  message: string;
  evidence: string;
  confidence: number;
  raw_data?: unknown;
}

export interface ClassifiedFinding extends Finding {
  classification: ViolationClassification;
  adr?: string;
  tolerance_id?: string;
}

export interface NormalizationSignalData {
  occurrences: number;
  affected_components: string[];
}

export interface ReportSummary {
  blocking: number;
  tactical: number;
  strategic_approved: number;
  advisory: number;
  warnings: number;
}

export interface FolioReport {
  version: 'folio/v1alpha1';
  generated_at: string;
  summary: ReportSummary;
  findings: ClassifiedFinding[];
}

export interface FolioConfig {
  confidence_threshold: number;
  normalization_threshold: number;
  expiry_warn_days: number;
  exclude: string[];
  decisions_path: string;
  output_format: 'table' | 'json' | 'sarif';
}

export const DEFAULT_CONFIG: FolioConfig = {
  confidence_threshold: 0.7,
  normalization_threshold: 2,
  expiry_warn_days: 30,
  exclude: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'vendor/**',
    '__pycache__/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.js',
    '**/*.spec.js',
  ],
  decisions_path: './decisions',
  output_format: 'table',
};
