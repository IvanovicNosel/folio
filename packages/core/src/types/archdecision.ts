/**
 * Folio ArchDecision Schema — TypeScript types
 * Mirrors the normative schema defined in spec/ARCHDECISION-SCHEMA.md
 */

export type ADRStatus =
  | 'draft'
  | 'active'
  | 'expired'
  | 'superseded'
  | 'revoked';

export interface ADRLink {
  url: string;
  title?: string;
}

export interface ArchDecisionMetadata {
  name: string;
  created: string;   // ISO 8601 date
  updated?: string;
}

export interface ArchDecisionSpec {
  title: string;
  status: ADRStatus;
  component: string;
  constraints: string[];
  decision: string;
  rationale: string;
  consequences?: string;
  expires: string;   // ISO 8601 date (required for active decisions)
  owner: string;
  approver: string;
  superseded_by?: string;
  revoked_reason?: string;
  tags?: string[];
  links?: string[];
}

export interface ArchDecision {
  kind: 'ArchDecision';
  apiVersion: 'folio/v1alpha1';
  metadata: ArchDecisionMetadata;
  spec: ArchDecisionSpec;
  /** Resolved file path — set by the loader */
  _filePath?: string;
  /** Effective status — may differ from spec.status if auto-expired */
  _effectiveStatus?: ADRStatus;
}
