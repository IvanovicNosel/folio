# Folio DSL Grammar
## Component Description Language — Specification v0.1

| | |
|---|---|
| **Author** | Ivanovic Nosel |
| **Status** | Draft — v0.1 |
| **Part of** | Folio Architectural Intent Specification |

---

## 1. Overview

The Folio Component Description Language (CDL) is a YAML-based grammar for declaring a software component's architectural identity, the constraints it is subject to, and the violations it is permitted to tolerate. It is the primary input to the Folio validation framework.

A Folio component description file is named `folio.yaml` and is placed at the root of the component's source tree. A repository MAY contain multiple `folio.yaml` files, one per logical component.

Conforming implementations MUST validate component description files against the normative JSON Schema published alongside this specification (`component.schema.json`).

---

## 2. Document Structure

Every Folio component description document MUST conform to the following top-level structure:

```yaml
kind: Component
apiVersion: folio/v1alpha1
metadata:
  name: <string>
  owner: <string>
spec:
  type: <component-type>
  language: <language>
  path: <string>
  constraints: [...]
  violations:
    tactical: [...]
    strategic: [...]
```

### 2.1 Top-Level Fields

| Field | Requirement | Description |
|---|---|---|
| `kind` | MUST | Fixed value: `Component` |
| `apiVersion` | MUST | Fixed value: `folio/v1alpha1` |
| `metadata` | MUST | Document metadata block |
| `spec` | MUST | Component specification block |

### 2.2 Metadata Fields

| Field | Requirement | Description |
|---|---|---|
| `metadata.name` | MUST | Unique identifier for the component within the repository. MUST match pattern `[a-z][a-z0-9-]*`. |
| `metadata.owner` | MUST | Team or individual responsible for this component. |
| `metadata.tags` | MAY | Array of strings for classification. |
| `metadata.description` | SHOULD | Human-readable description of the component's purpose. |

---

## 3. Spec Fields

### 3.1 Component Type

`spec.type` MUST be one of the following enumerated values:

| Value | Meaning |
|---|---|
| `service` | A deployed runtime service |
| `library` | A shared code library |
| `gateway` | An API gateway or reverse proxy |
| `frontend` | A user-facing web or native application |
| `worker` | A background processing worker |
| `database` | A data store or schema-owning component |
| `infrastructure` | Infrastructure-as-code or platform component |

### 3.2 Language

`spec.language` MUST be one of: `typescript`, `javascript`, `python`, `go`, `java`, `rust`, `csharp`, `ruby`, `other`.

### 3.3 Path

`spec.path` SHOULD specify the relative path to the component's source root. Defaults to `.` (document directory).

---

## 4. Constraints

`spec.constraints` is an array of constraint definitions. Each constraint declares a rule that the component MUST satisfy for the architecture to be considered sound.

### 4.1 Constraint Fields

| Field | Requirement | Description |
|---|---|---|
| `id` | MUST | Unique identifier within this component. MUST match `[a-z][a-z0-9-]*`. |
| `description` | MUST | Human-readable description of the rule. |
| `rule` | MUST | The rule definition block (see §4.2). |
| `severity` | MUST | Default severity if violated: `tactical` or `strategic`. |
| `rationale` | SHOULD | Explanation of why this constraint exists. |
| `references` | MAY | Array of URLs or document references. |

### 4.2 Rule Types

The `rule` block MUST include a `type` field. The following rule types are defined in this version:

#### 4.2.1 `dependency` — Dependency Restrictions

Controls which packages or modules a component may import.

```yaml
rule:
  type: dependency
  deny:
    - pg
    - mysql2
    - sequelize
```

```yaml
rule:
  type: dependency
  allow_only:
    - "@company/db-client"
```

| Field | Requirement | Description |
|---|---|---|
| `deny` | MAY | Array of package names or glob patterns that MUST NOT be imported. |
| `allow_only` | MAY | If present, ONLY these packages may be imported (allowlist). |

Implementations MUST check `deny` and `allow_only` against the component's declared dependencies (package.json, requirements.txt, go.mod, etc.) and against import statements within source files under `spec.path`.

#### 4.2.2 `module` — Module Boundary Rules

Enforces layer or module boundary constraints.

```yaml
rule:
  type: module
  deny_imports_from:
    - "../infrastructure"
    - "../data-access"
```

```yaml
rule:
  type: module
  allow_imports_from:
    - "../shared"
    - "../domain"
```

| Field | Requirement | Description |
|---|---|---|
| `deny_imports_from` | MAY | Relative path patterns that MUST NOT be imported from. |
| `allow_imports_from` | MAY | If present, ONLY these relative paths may be imported. |

#### 4.2.3 `pattern` — Code Pattern Requirements

Asserts that certain code patterns must or must not appear.

```yaml
rule:
  type: pattern
  must_not_match:
    - pattern: "console\\.log"
      message: "Use structured logging instead of console.log"
    - pattern: "process\\.env\\.[A-Z_]+"
      message: "Access environment variables through config module only"
```

```yaml
rule:
  type: pattern
  must_match:
    - pattern: "@Injectable"
      message: "All services must use dependency injection"
```

| Field | Requirement | Description |
|---|---|---|
| `must_not_match` | MAY | Array of regex patterns that MUST NOT appear in source files. |
| `must_match` | MAY | Array of regex patterns that MUST appear at least once. |

Each entry in `must_not_match` and `must_match` MUST include a `pattern` (ECMAScript regex) and SHOULD include a `message`.

#### 4.2.4 `structural` — Structural/Layering Rules

Enforces architectural layering conventions.

```yaml
rule:
  type: structural
  layers:
    - name: api
      path: "./src/api"
    - name: domain
      path: "./src/domain"
    - name: infrastructure
      path: "./src/infrastructure"
  allow_flow:
    - from: api
      to: domain
    - from: domain
      to: infrastructure
```

Implementations MUST verify that import relationships between files respect the declared `allow_flow` edges. Any import in the reverse direction constitutes a violation.

---

## 5. Violation Tolerances

`spec.violations` contains two blocks — `tactical` and `strategic` — declaring which constraint violations are permitted, under what conditions, and for how long.

The presence of a violation tolerance does not suppress a constraint check. It classifies the result. Implementations MUST still detect and report the violation; the tolerance governs how it is categorised in the output.

### 5.1 Tactical Shortcut Tolerances

A **tactical shortcut** is a permitted, time-bounded exception to a constraint. It MUST be accompanied by a decision record (ArchDecision) that documents the rationale, establishes an expiry date, and names an owner.

```yaml
violations:
  tactical:
    - id: v-001
      constraint: no-direct-db
      adr: ADR-042
      expires: "2026-06-01"
      owner: jane.doe@example.com
      reason: "Migrating to repository pattern; direct DB access temporary"
      max_age_days: 90
```

| Field | Requirement | Description |
|---|---|---|
| `id` | MUST | Unique identifier for this tolerance within the document. |
| `constraint` | MUST | The `id` of the constraint being tolerated. MUST reference a constraint defined in `spec.constraints`. |
| `adr` | MUST | The `metadata.name` of the ArchDecision that authorises this tolerance. |
| `expires` | MUST | ISO 8601 date after which this tolerance is no longer valid. |
| `owner` | MUST | Email or username of the person responsible for resolving this violation. |
| `reason` | MUST | Human-readable rationale for why this exception was granted. |
| `max_age_days` | SHOULD | Maximum permitted age of this tolerance in days. Implementations MUST treat the tolerance as expired if `max_age_days` days have elapsed since the date the ADR was created. |

**Classification rules for tactical tolerances:**

A tactical tolerance is valid if ALL of the following are true:
1. The referenced ADR exists and has status `active`.
2. The current date is before `expires`.
3. `max_age_days` (if set) has not been exceeded relative to the ADR's `created` date.
4. The referenced constraint is defined in `spec.constraints`.

If any condition is false, the violation MUST be reclassified as strategic by the implementing tool.

### 5.2 Strategic Exception Tolerances

A **strategic exception** is a long-term, board-approved deviation from a constraint. It MUST be documented with an RFC-level document and carry explicit architecture board approval.

```yaml
violations:
  strategic:
    - id: v-002
      constraint: api-versioning
      rfc: RFC-2025-11
      approval: architecture-board
      approver: john.smith@example.com
      reason: "Legacy /health endpoint retained for backward compatibility"
```

| Field | Requirement | Description |
|---|---|---|
| `id` | MUST | Unique identifier for this tolerance. |
| `constraint` | MUST | The `id` of the constraint being tolerated. |
| `rfc` | MUST | Identifier of the RFC document authorising this exception. |
| `approval` | MUST | The approval body. MUST be one of: `architecture-board`, `security-board`, `cto`. |
| `approver` | MUST | Email or username of the individual who granted approval. |
| `reason` | MUST | Human-readable rationale. |

Strategic exceptions do not expire automatically. They are reviewed as part of the architecture board's governance cycle.

---

## 6. Complete Example

```yaml
kind: Component
apiVersion: folio/v1alpha1
metadata:
  name: payment-service
  owner: payments-team
  tags:
    - payments
    - pci-scope
  description: "Handles payment processing, authorisation, and refund workflows"

spec:
  type: service
  language: typescript
  path: ./src

  constraints:
    - id: no-direct-db
      description: "This service MUST NOT import database drivers directly"
      rule:
        type: dependency
        deny:
          - pg
          - mysql2
          - sequelize
          - typeorm
      severity: strategic
      rationale: "All data access must flow through the shared db-client package to ensure connection pooling and audit logging"

    - id: no-console-logging
      description: "Source files MUST NOT contain console.log statements"
      rule:
        type: pattern
        must_not_match:
          - pattern: "console\\.log"
            message: "Use the structured logger from @company/logger"
      severity: tactical

    - id: domain-boundary
      description: "Domain layer MUST NOT import from infrastructure layer"
      rule:
        type: module
        deny_imports_from:
          - "../infrastructure"
          - "../../infrastructure"
      severity: strategic

  violations:
    tactical:
      - id: v-001
        constraint: no-direct-db
        adr: ADR-042
        expires: "2026-06-01"
        owner: jane.doe@example.com
        reason: "Repository pattern migration in progress; direct DB access is temporary and scoped to the legacy payment processor"
        max_age_days: 90

    strategic:
      - id: v-002
        constraint: domain-boundary
        rfc: RFC-2025-08
        approval: architecture-board
        approver: arch-lead@example.com
        reason: "Payment encryption service requires direct infrastructure access due to HSM integration constraints"
```

---

## 7. Validation Requirements

Conforming implementations MUST:

1. Validate every `folio.yaml` against `component.schema.json` before processing.
2. Report schema validation errors with file path and line number.
3. Verify that every `constraint` reference in `spec.violations` resolves to a defined constraint in `spec.constraints`.
4. Verify that every `adr` reference in `spec.violations.tactical` resolves to a loaded ArchDecision document.
5. Apply tactical tolerance classification rules (§5.1) at analysis time, not at document load time, using the current date.
6. Exit with code `2` on schema or reference validation errors.
7. Exit with code `1` if any unresolved strategic violations are found after classification.
8. Exit with code `0` if all violations are within valid tactical or strategic tolerances.

---

*© 2026 Ivanovic Nosel. Licensed under CC BY 4.0.*
