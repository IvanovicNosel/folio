# Folio ArchDecision Schema
## Decision Log Format — Specification v0.1

| | |
|---|---|
| **Author** | Ivanovic Nosel |
| **Status** | Draft — v0.1 |
| **Part of** | Folio Architectural Intent Specification |

---

## 1. Overview

The Folio ArchDecision document kind is a machine-readable Architectural Decision Record (ADR) format that links architectural decisions to the specific constraint exceptions they authorise. Unlike conventional ADR formats (e.g., MADR, Nygard), Folio ArchDecisions carry expiry semantics and are directly integrated into the violation taxonomy: an expired ArchDecision automatically causes any tactical tolerance that references it to be reclassified as a strategic violation.

ArchDecision files MUST be named using the pattern `<id>.yaml` (e.g., `ADR-042.yaml`) and SHOULD be stored in a `decisions/` directory at the component or repository root.

Conforming implementations MUST validate ArchDecision files against the normative JSON Schema (`archdecision.schema.json`).

---

## 2. Document Structure

Every ArchDecision document MUST conform to the following structure:

```yaml
kind: ArchDecision
apiVersion: folio/v1alpha1
metadata:
  name: <string>
  created: <date>
spec:
  title: <string>
  status: <status>
  component: <string>
  constraints: [<string>, ...]
  decision: <string>
  rationale: <string>
  expires: <date>
  owner: <string>
  approver: <string>
```

### 2.1 Top-Level Fields

| Field | Requirement | Description |
|---|---|---|
| `kind` | MUST | Fixed value: `ArchDecision` |
| `apiVersion` | MUST | Fixed value: `folio/v1alpha1` |
| `metadata` | MUST | Document metadata block |
| `spec` | MUST | Decision specification block |

### 2.2 Metadata Fields

| Field | Requirement | Description |
|---|---|---|
| `metadata.name` | MUST | Unique identifier. MUST match pattern `ADR-[0-9]+` or `[A-Z]+-[0-9]+`. This value is used as the `adr` reference key in component `folio.yaml` files. |
| `metadata.created` | MUST | ISO 8601 date the decision was first recorded. |
| `metadata.updated` | SHOULD | ISO 8601 date of last status change. |

---

## 3. Status Lifecycle

`spec.status` governs the lifecycle of an ArchDecision. It MUST be one of the following values:

| Status | Meaning |
|---|---|
| `draft` | Decision is under review. MAY NOT be used as an `adr` reference in violation tolerances. |
| `active` | Decision is approved and in effect. Tactical tolerances referencing this ADR are valid (subject to expiry). |
| `expired` | Expiry date has passed. Implementations MUST set this status automatically when the current date exceeds `spec.expires`. Any tactical tolerance referencing an expired ADR MUST be reclassified as strategic. |
| `superseded` | This decision has been replaced by another. `spec.superseded_by` MUST be set. Tactical tolerances referencing a superseded ADR MUST be reclassified as strategic. |
| `revoked` | Approval was withdrawn before expiry. `spec.revoked_reason` MUST be set. Tactical tolerances referencing a revoked ADR MUST be reclassified as strategic. |

### 3.1 Status Transition Rules

```
draft ──► active ──► expired
              │
              ├──► superseded (requires superseded_by)
              │
              └──► revoked   (requires revoked_reason)
```

Implementations MUST NOT allow a transition from `expired`, `superseded`, or `revoked` back to `active` without creating a new ArchDecision document.

Implementations MUST automatically apply the `expired` status when processing a document whose `spec.expires` date is in the past and whose current status is `active`. This transition MUST be reflected in the validation output even if the file on disk still reads `active`.

---

## 4. Spec Fields

| Field | Requirement | Description |
|---|---|---|
| `spec.title` | MUST | Short human-readable title for the decision. |
| `spec.status` | MUST | Lifecycle status (see §3). |
| `spec.component` | MUST | The `metadata.name` of the component this decision applies to. An ArchDecision scoped to a specific component MUST NOT be used as an `adr` reference in a different component's `folio.yaml`. |
| `spec.constraints` | MUST | Array of constraint `id` values from the referenced component's `folio.yaml`. MUST contain at least one entry. |
| `spec.decision` | MUST | A concise statement of what was decided. Use present tense (e.g., "The payment-service is granted..."). |
| `spec.rationale` | MUST | Explanation of why this decision was made. MUST include the circumstances that necessitated the exception. |
| `spec.consequences` | SHOULD | Description of the consequences and obligations this decision creates. |
| `spec.expires` | MUST (for `active` decisions) | ISO 8601 date after which this decision is no longer valid. |
| `spec.owner` | MUST | Email or username of the person responsible for resolving the underlying violation before expiry. |
| `spec.approver` | MUST | Email or username of the person who approved this exception. |
| `spec.superseded_by` | MUST (if status is `superseded`) | The `metadata.name` of the ArchDecision that replaces this one. |
| `spec.revoked_reason` | MUST (if status is `revoked`) | Human-readable reason for revocation. |
| `spec.tags` | MAY | Array of classification tags. |
| `spec.links` | MAY | Array of related URLs (pull requests, tickets, docs). |

---

## 5. Expiry Semantics

The expiry mechanism is central to the Folio violation taxonomy. The following rules govern expiry behaviour:

1. When `spec.expires` is in the past and `spec.status` is `active`, the ArchDecision MUST be treated as `expired` by all conforming tools, regardless of the value written in the file.

2. An expired ArchDecision MUST cause all tactical tolerances referencing it to be reclassified as strategic violations in any Folio analysis run.

3. Implementations SHOULD warn owners when an ArchDecision is within 30 days of expiry (`EXPIRY_WARN_DAYS = 30`). This warning MUST appear in the tool output and SHOULD be surfaced in CI annotations.

4. Implementations MUST NOT silently ignore expired ADRs. The expired status MUST be reported in the analysis output with the original expiry date.

5. An ArchDecision MAY be extended before expiry by updating `spec.expires` to a future date. The update MUST be committed and reviewed; implementations SHOULD flag unreviewed expiry extensions (where the git commit touching only `spec.expires` lacks a linked PR).

---

## 6. Cross-Component Scoping

An ArchDecision is scoped to a single component (via `spec.component`). Implementations MUST enforce the following:

1. An ArchDecision MUST only authorise tolerances in the component named in `spec.component`.
2. If a `folio.yaml` references an `adr` that names a different component in its `spec.component` field, the reference MUST be treated as invalid and the tolerance MUST be reclassified as strategic.
3. A component that wishes to share an exception across boundaries MUST have its own ArchDecision, even if the rationale is identical.

---

## 7. Normalization Signal Integration

When the Folio Normalization Signal (see Investigator Protocol §4) detects that the same constraint violation appears across multiple components without ADR coverage, it MUST:

1. Flag each uncovered occurrence as a strategic violation.
2. Include in the analysis output the count of occurrences and a `normalization_signal` field indicating that the pattern is normalising.

When a constraint violation is covered by a tactical tolerance in one component but appears uncovered in another, the second occurrence MUST be treated as a strategic violation, and the Normalization Signal MUST flag the cross-component pattern.

---

## 8. Complete Example

```yaml
kind: ArchDecision
apiVersion: folio/v1alpha1
metadata:
  name: ADR-042
  created: "2026-03-01"
  updated: "2026-03-15"

spec:
  title: "Temporary Direct Database Access During Repository Pattern Migration"
  status: active

  component: payment-service
  constraints:
    - no-direct-db

  decision: >
    The payment-service is granted a temporary exception to the no-direct-db
    constraint for the duration of the repository pattern migration.

  rationale: >
    The payment-service legacy codebase accesses the database directly via the
    'pg' driver. Migrating to the shared db-client package requires incremental
    refactoring across 23 files. A full migration in a single sprint is not
    feasible without introducing regression risk. The team has committed to
    completing the migration by 2026-06-01.

  consequences: >
    The team MUST complete the migration to @company/db-client before
    2026-06-01. All new payment-service code written during this period MUST
    use @company/db-client. Direct 'pg' usage MUST NOT be extended to new
    modules. Failure to complete by the deadline will cause the violation to
    be automatically reclassified as strategic in all subsequent CI runs.

  expires: "2026-06-01"
  owner: jane.doe@example.com
  approver: tech-lead@example.com

  tags:
    - migration
    - database

  links:
    - https://github.com/example/payment-service/pull/341
    - https://jira.example.com/browse/PAY-1092
```

---

## 9. Validation Requirements

Conforming implementations MUST:

1. Validate every ArchDecision file against `archdecision.schema.json` before use.
2. Apply automatic expiry transition at analysis time (§5, rule 1).
3. Verify cross-component scoping (§6).
4. Report expired ADRs with the original expiry date in the analysis output.
5. Report soon-to-expire ADRs (within 30 days) as warnings.
6. Verify that `superseded_by` references resolve to an existing ArchDecision when status is `superseded`.
7. Verify that `revoked_reason` is present when status is `revoked`.

---

*© 2026 Ivanovic Nosel. Licensed under CC BY 4.0.*
