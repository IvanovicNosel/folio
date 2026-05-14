---
description: Work with Folio — the architectural intent validation tool. Covers writing folio.yaml constraints, ArchDecision records, running checks, and interpreting findings. Use when adding Folio to a project, investigating violations, documenting an exception, or auditing a monorepo.
---

# Folio — Agent Reference

Folio validates source code against architectural constraints you define in YAML.
It classifies every finding as **BLOCKING** (no coverage), **TACTICAL** (documented,
time-bounded exception backed by an ADR), **STRATEGIC_APPROVED** (board-approved),
**WARNING** (ADR expiring soon), or **NORMALIZATION SIGNAL** (same constraint
BLOCKING in 2+ components — drift is spreading). CI exits non-zero only on BLOCKING.

---

## 1  Locate the CLI

```bash
# Built from source (this repo)
node packages/cli/dist/bin/folio.js --help

# If installed globally
folio --help
```

Build from source when needed:
```bash
pnpm --filter @folio/core build && pnpm --filter @folio/cli build
```

---

## 2  Three commands

```bash
folio validate <path>              # schema-only check, fast, no source scanning
folio check   <path>              # full analysis: scan source + classify violations
folio check   <path> --format json # machine-readable output (preferred for agents)
folio check   <path> --format sarif # GitHub Code Scanning upload format
folio init    <path>              # generate a starter folio.yaml
```

Exit codes for `folio check`:
- `0` — no blocking violations
- `1` — one or more blocking violations
- `2` — schema validation error or no folio.yaml found

---

## 3  folio.yaml — full reference

Place `folio.yaml` at the root of the component (next to `package.json` or equivalent).
`spec.path` points to the source directory to scan.

```yaml
kind: Component
apiVersion: folio/v1alpha1

metadata:
  name: payment-service        # unique identifier used in findings and ADRs
  owner: payments-team
  tags: [payments, pci-scope]
  description: "Handles payment processing and refunds"

spec:
  type: service                # service | library | gateway | frontend | worker | database | infrastructure
  language: typescript         # typescript | javascript | python | go | java | rust | csharp | ruby | other
  path: ./src                  # directory scanned for violations (relative to folio.yaml)

  constraints:

    # ── dependency rule ───────────────────────────────────────────────────────
    # Checks bare package names in import/require statements
    - id: no-direct-db
      description: "MUST NOT import database drivers directly"
      rule:
        type: dependency
        deny: [pg, mysql2, sequelize, typeorm]   # forbidden packages
        # allow_only: [express, zod]             # whitelist alternative
      severity: strategic     # strategic = blocking by default | tactical = advisory by default
      rationale: "All DB access must flow through @company/db-client"

    # ── pattern rule ──────────────────────────────────────────────────────────
    # Applies regex to every source file line-by-line
    - id: no-console-log
      description: "MUST NOT contain console.log statements"
      rule:
        type: pattern
        must_not_match:
          - pattern: "console\\.log"
            message: "Use the structured logger from @company/logger"
        # must_match:                            # assert pattern EXISTS somewhere
        #   - pattern: "createLogger"
        #     message: "Logger must be initialised"
      severity: tactical

    # ── module rule ───────────────────────────────────────────────────────────
    # Checks relative import paths as they appear in source (not resolved)
    - id: domain-no-infra
      description: "Domain layer MUST NOT import from infrastructure"
      rule:
        type: module
        deny_imports_from:
          - "../infra"        # matches: import x from '../infra/db.js'
          - "../../infra"     # matches files one directory deeper
        # allow_imports_from: ["../shared"]      # whitelist alternative
      severity: strategic

  # ── violation tolerances ───────────────────────────────────────────────────
  violations:

    # tactical: documented, time-bounded, ADR-backed
    tactical:
      - id: v-001
        constraint: no-direct-db
        adr: ADR-001           # must match metadata.name of an ArchDecision file
        expires: "2026-10-01"  # ISO date — after this date the tolerance is void
        owner: dev@team.com
        reason: "Migrating to @company/db-client — legacy files only"
        max_age_days: 240      # optional: auto-expire after N days regardless

    # strategic: board-approved permanent exception
    strategic:
      - id: s-001
        constraint: domain-no-infra
        rfc: RFC-2024-003
        approval: architecture-board   # architecture-board | security-board | cto
        approver: cto@company.com
        reason: "Legacy coupling approved for maintenance window only"
```

---

## 4  ArchDecision — full reference

Place in a `decisions/` directory **sibling to `folio.yaml`**.
Folio discovers them automatically — no `--decisions` flag needed.

```
my-service/
  folio.yaml
  decisions/
    ADR-001.yaml    ← discovered automatically
  src/
```

```yaml
kind: ArchDecision
apiVersion: folio/v1alpha1

metadata:
  name: ADR-001          # MUST match the `adr:` field in the tactical tolerance
  created: "2026-01-15"
  updated: "2026-03-20"

spec:
  title: "Temporary direct pg access during repository pattern migration"
  status: active         # draft | active | expired | superseded | revoked

  component: payment-service   # must match metadata.name in folio.yaml
  constraints:
    - no-direct-db             # constraint ids this ADR covers

  decision: >
    The service is granted a temporary exception to the no-direct-db constraint.
    Direct pg usage is permitted only in the legacy-processor module.

  rationale: >
    The codebase predates @company/db-client. Migrating 23 files in one sprint
    introduces unacceptable regression risk to a PCI-scoped service.

  consequences: >
    All new code MUST use @company/db-client. Migration must complete by expiry date.
    After expiry, Folio will reclassify the violation as BLOCKING automatically.

  expires: "2026-10-01"        # MUST match expires: in the tactical tolerance
  owner: dev@team.com
  approver: tech-lead@team.com

  # optional lifecycle fields
  # superseded_by: ADR-002     # when status: superseded
  # revoked_reason: "..."      # when status: revoked

  tags: [migration, database]
  links:
    - https://github.com/example/repo/pull/341
```

**ADR status lifecycle:**
- `active` → tolerance is valid
- `expired` (auto-set when today > `expires`) → tolerance immediately BLOCKING
- `superseded` → tolerance BLOCKING, must reference new ADR
- `revoked` → tolerance BLOCKING, must state reason

---

## 5  Reading check output

### JSON (recommended for agents)

```bash
folio check ./my-service --format json
```

```json
{
  "version": "folio/v1alpha1",
  "generated_at": "2026-04-16T11:00:00.000Z",
  "summary": { "blocking": 2, "tactical": 1, "strategic_approved": 0, "advisory": 0, "warnings": 1 },
  "findings": [
    {
      "agent": "dependency-analyzer",
      "component": "payment-service",
      "constraint": "no-direct-db",
      "file": "/abs/path/src/domain/order.ts",
      "line": 3,
      "violation_type": "constraint-violation",
      "message": "Forbidden dependency 'pg' imported (rule: no-direct-db)",
      "evidence": "import 'pg' in src/domain/order.ts",
      "confidence": 1.0,
      "classification": "BLOCKING"
    },
    {
      "classification": "TACTICAL",
      "adr": "ADR-001",
      "tolerance_id": "v-001",
      ...
    }
  ]
}
```

**Key fields:**
- `classification` — `BLOCKING` | `TACTICAL` | `STRATEGIC_APPROVED` | `WARNING` | `ADVISORY`
- `agent` — which sub-agent found it: `dependency-analyzer` | `pattern-detector` | `decision-log-analyzer` | `intent-resolver` | `schema-validator`
- `violation_type` — `constraint-violation` | `adr-expired` | `adr-revoked` | `adr-superseded` | `expiry-warning` | `tolerance-reference-error` | `normalization-signal`
- `file` + `line` — exact location when available
- `adr` / `tolerance_id` — present on TACTICAL findings

### Decision logic

| `severity` in folio.yaml | No valid ADR | Valid ADR covers it |
|---|---|---|
| `strategic` | BLOCKING | TACTICAL |
| `tactical` | BLOCKING | TACTICAL |

Any `constraint-violation` finding becomes TACTICAL when:
1. A tolerance (`violations.tactical[]`) references it by `constraint` id
2. That tolerance references an ADR by `metadata.name`
3. That ADR exists, is `active`, and has not passed its `expires` date

---

## 6  Workflows

### A — Add Folio to an existing service

1. Read the source tree to understand the service's structure, dependencies, and layers
2. Write `folio.yaml` at the service root — start with 2-3 high-value constraints
3. Run `folio validate ./service` to confirm the schema is correct
4. Run `folio check ./service --format json` to see what violations exist
5. For each BLOCKING finding: decide if it's a real violation or a deliberate exception
   - Real violation → note it, do not suppress
   - Deliberate exception → write `decisions/ADR-NNN.yaml` + add tolerance to folio.yaml
6. Run `folio check` again — confirm expected BLOCKING/TACTICAL split

### B — Investigate a violation in CI

1. Run `folio check ./service --format json` and parse findings
2. Filter `findings` where `classification === "BLOCKING"`
3. For each BLOCKING finding, read `file` + `line` to understand the code
4. Determine if violation is intentional (talk to the user) or accidental
5. If intentional: create the ADR + tolerance, re-run to confirm TACTICAL
6. If accidental: fix the code, re-run to confirm clean

### C — Document an exception

1. Check the violation's `constraint` id in the BLOCKING finding
2. Create `decisions/ADR-NNN.yaml` with `status: active`, appropriate `expires` date
3. Add to `folio.yaml` under `violations.tactical`:
   ```yaml
   - id: v-NNN
     constraint: <constraint-id>
     adr: ADR-NNN
     expires: "<same date as ADR>"
     owner: <owner>
     reason: "<why this is intentional>"
   ```
4. Run `folio validate` first, then `folio check` to confirm TACTICAL

### D — Audit a monorepo

```bash
folio check ./services --format json
```

Folio discovers all `folio.yaml` files recursively. Each service's ADRs are
loaded from its own `decisions/` directory automatically. A `--decisions` flag
provides a global fallback (wins on name collision).

Watch for `violation_type: "normalization-signal"` findings — these mean the
same constraint is BLOCKING in 2+ services without documentation. That's
architectural drift spreading across the org.

### E — Generate folio.yaml from scratch (agent-driven derivation)

1. Walk the source tree and identify:
   - External packages imported (candidates for `dependency` rules)
   - Directory structure (candidates for `module` rules)
   - Patterns to prohibit (`console.log`, `TODO:`, `any`, etc.)
2. Draft constraints in `folio.yaml` using the schema above
3. Run `folio check --format json` against the codebase
4. Review findings: remove false-positive constraints, tighten real ones
5. For every BLOCKING finding that represents intentional existing code, write an ADR

---

## 7  Monorepo layout

```
services/
  order-service/
    folio.yaml
    decisions/
      ADR-001.yaml       ← auto-discovered for this service
    src/

  inventory-service/
    folio.yaml           ← no decisions/ → all violations are BLOCKING
    src/
```

```bash
folio check services/          # checks all services in one pass
folio check services/order-service   # check one service only
```

---

## 8  CI integration

```yaml
- name: Build Folio
  run: pnpm --filter @folio/core build && pnpm --filter @folio/cli build

- name: Run architectural analysis
  id: folio_check
  run: |
    node packages/cli/dist/bin/folio.js check ./my-service \
      --format sarif > folio-results.sarif
  continue-on-error: true

- name: Upload to GitHub Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: folio-results.sarif

- name: Fail on blocking violations
  if: steps.folio_check.outcome == 'failure'
  run: exit 1
```

---

## Quick reference card

| Task | Command |
|---|---|
| Validate schemas only | `folio validate <path>` |
| Full analysis (human) | `folio check <path>` |
| Full analysis (agent/CI) | `folio check <path> --format json` |
| Check one service in monorepo | `folio check <path/to/service>` |
| Generate starter manifest | `folio init <path>` |
| Warn before ADR expiry (default 30d) | `folio check <path> --expiry-warn-days 14` |
| Lower normalization threshold | `folio check <path> --normalization-threshold 2` |

| Rule type | What it checks | Key fields |
|---|---|---|
| `dependency` | Bare package names in imports | `deny`, `allow_only` |
| `pattern` | Regex applied line-by-line | `must_not_match`, `must_match` |
| `module` | Relative import paths as written | `deny_imports_from`, `allow_imports_from` |

| Classification | Meaning | Blocks CI? |
|---|---|---|
| `BLOCKING` | Violated, no valid ADR | Yes |
| `TACTICAL` | Violated but covered by active ADR | No |
| `STRATEGIC_APPROVED` | Board-approved exception | No |
| `WARNING` | ADR expiring within warn window | No |
| `NORMALIZATION SIGNAL` | Same constraint BLOCKING in N+ components | Yes |
