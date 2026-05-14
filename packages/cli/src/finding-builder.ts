import type { Finding, AgentId, ViolationType } from '@folio/core';

interface FindingParams {
  agent: AgentId;
  component: string;
  constraint: string;
  violation_type: ViolationType;
  message: string;
  evidence: string;
  confidence: number;
  // Explicitly allow undefined so callers can pass potentially-undefined values.
  // The builder omits the field when undefined, satisfying exactOptionalPropertyTypes
  // on the Finding output type.
  file?: string | undefined;
  line?: number | undefined;
  column?: number | undefined;
  raw_data?: unknown;
}

/**
 * Builds a Finding object, omitting optional fields when undefined.
 * Satisfies exactOptionalPropertyTypes on the Finding type: optional fields
 * must be absent (not undefined) on the output object.
 */
export function makeFinding(params: FindingParams): Finding {
  const base: Finding = {
    agent: params.agent,
    component: params.component,
    constraint: params.constraint,
    violation_type: params.violation_type,
    message: params.message,
    evidence: params.evidence,
    confidence: params.confidence,
  };

  if (params.file !== undefined) base.file = params.file;
  if (params.line !== undefined) base.line = params.line;
  if (params.column !== undefined) base.column = params.column;
  if (params.raw_data !== undefined) base.raw_data = params.raw_data;

  return base;
}
