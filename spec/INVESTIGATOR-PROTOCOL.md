# Folio Investigator Protocol
## Validation Framework — Specification v0.1

| | |
|---|---|
| **Author** | Ivanovic Nosel |
| **Status** | Draft — v0.1 |
| **Part of** | Folio Architectural Intent Specification |

---

## 1. Overview

The Folio Investigator Protocol defines the validation framework through which the Folio tooling analyses a codebase against its declared component descriptions. The framework is structured as a coordinated multi-agent system in which specialised agents handle distinct analytical concerns, coordinated by a master agent — the **Investigator** — that synthesises findings, resolves conflicts, and produces the final violation report.

The protocol specifies:
- The interface contract between the Investigator and each sub-agent
- The schema of findings produced by each agent
- The confidence scoring model
- The conflict resolution rules
- The output format for CI and CLI consumers

This specification uses RFC 2119 conformance language throughout.

---

## 2. Architecture

### 2.1 Agent Roles

```
                        ┌─────────────────────┐
                        │     Investigator     │  (master agent)
                        │   (orchestrator)     │
                        └──────────┬──────────┘
                                   │
           ┌───────────┬───────────┼───────────┬───────────┐
           │           │           │           │           │
    ┌──────▼──┐  ┌─────▼────┐ ┌───▼───────┐ ┌─▼────────┐ ┌▼──────────────┐
    │  Schema  │  │  Depend. │ │  Pattern  │ │ Decision │ │    Intent     │
    │Validator │  │ Analyzer │ │ Detector  │ │  Log     │ │   Resolver    │
    └──────────┘  └──────────┘ └───────────┘ │ Analyzer │ └───────────────┘
                                              └──────────┘
```

| Agent | Responsibility |
|---|---|
| **Investigator** | Orchestrates sub-agents, merges findings, resolves conflicts, produces final report |
| **SchemaValidator** | Validates `folio.yaml` and ArchDecision files against JSON schemas |
| **DependencyAnalyzer** | Evaluates `dependency` and `module` constraints against actual imports |
| **PatternDetector** | Evaluates `pattern` and `structural` constraints against source files |
| **DecisionLogAnalyzer** | Loads and validates ArchDecision files; applies expiry, scoping, and supersession rules |
| **IntentResolver** | Applies probabilistic classification to ambiguous findings; produces confidence scores |

### 2.2 Execution Model

Sub-agents MAY execute in parallel. The Investigator MUST wait for all sub-agent findings before beginning the merge and classification phase. Sub-agents MUST be stateless; all state is held by the Investigator.

Implementations MAY execute sub-agents as in-process functions, separate processes, or remote services, provided the interface contract defined in §3 is honoured.

---

## 3. Finding Schema

Every finding produced by a sub-agent MUST conform to the following schema:

```typescript
interface Finding {
  agent: AgentId;
  component: string;         // metadata.name from folio.yaml
  constraint: string;        // constraint id from spec.constraints
  file?: string;             // absolute or repo-relative file path
  line?: number;             // 1-indexed line number
  column?: number;           // 1-indexed column number
  violation_type: ViolationType;
  message: string;
  evidence: string;          // the actual code or config fragment that triggered the finding
  confidence: number;        // [0.0, 1.0]
  raw_data?: unknown;        // agent-specific supplementary data
}

type AgentId =
  | 'schema-validator'
  | 'dependency-analyzer'
  | 'pattern-detector'
  | 'decision-log-analyzer'
  | 'intent-resolver';

type ViolationType =
  | 'constraint-violation'        // code violates a declared constraint
  | 'tolerance-reference-error'   // violation tolerance references a missing/invalid ADR
  | 'adr-expired'                 // referenced ADR has expired
  | 'adr-revoked'                 // referenced ADR has been revoked
  | 'adr-superseded'              // referenced ADR has been superseded
  | 'normalization-signal'        // same constraint violated across multiple components
  | 'expiry-warning'              // ADR expires within EXPIRY_WARN_DAYS
  | 'schema-error';               // folio.yaml or ADR file fails schema validation
```

### 3.1 Confidence Scoring

Each finding MUST include a `confidence` score in the range `[0.0, 1.0]`:

| Range | Interpretation |
|---|---|
| `0.9 – 1.0` | Certain. The finding is definitively a violation (e.g., schema error, exact import match). |
| `0.7 – 0.9` | High confidence. Pattern match with low ambiguity. |
| `0.5 – 0.7` | Moderate confidence. Pattern match with contextual ambiguity (e.g., dynamic import, generated code). |
| `0.0 – 0.5` | Low confidence. Ambiguous finding; requires human review. |

Findings with confidence below the configurable `CONFIDENCE_THRESHOLD` (default: `0.7`) MUST NOT be treated as blocking violations. They MUST be surfaced in the output as **advisory findings** requiring human review.

---

## 4. Sub-Agent Specifications

### 4.1 SchemaValidator

**Input:** File paths to all `folio.yaml` and `*.yaml` files matching ArchDecision pattern.

**Responsibility:** Validate documents against their respective JSON schemas.

**Output:** One finding per schema error, with `violation_type: 'schema-error'` and `confidence: 1.0`.

Schema errors MUST block subsequent analysis. The Investigator MUST abort and report schema errors before executing other sub-agents.

### 4.2 DependencyAnalyzer

**Input:** One or more component descriptions with `dependency` or `module` rules.

**Responsibility:**
1. Read the component's dependency manifest (package.json, requirements.txt, go.mod, pyproject.toml, etc.) and collect all declared dependencies.
2. Scan source files under `spec.path` for import/require statements.
3. Evaluate each `dependency` rule: report `constraint-violation` for every package that matches a `deny` pattern or is absent from `allow_only`.
4. Evaluate each `module` rule: report `constraint-violation` for every import that crosses a boundary.

**Output:** Findings with `violation_type: 'constraint-violation'`, `confidence: 1.0` for exact package matches, lower for glob/pattern matches.

The DependencyAnalyzer MUST report the specific import statement as `evidence` and include file path and line number.

### 4.3 PatternDetector

**Input:** Component descriptions with `pattern` or `structural` rules.

**Responsibility:**
1. Scan source files under `spec.path` for patterns declared in `must_not_match`.
2. Assert that patterns declared in `must_match` appear at least once in the source tree.
3. For `structural` rules: build an import graph and verify all edges conform to `allow_flow`.

**Output:** Findings with `violation_type: 'constraint-violation'`. Confidence for `must_not_match` violations: `1.0` for literal matches, lower for generated or vendored code. Confidence for `must_match` violations: `1.0`.

The PatternDetector SHOULD exclude common non-source paths (`.git`, `node_modules`, `vendor`, `dist`, `build`, `__pycache__`) unless explicitly configured otherwise.

### 4.4 DecisionLogAnalyzer

**Input:** All loaded ArchDecision documents and all component descriptions.

**Responsibility:**
1. Apply automatic expiry transition (ARCHDECISION-SCHEMA §5, rule 1) to all active ADRs whose `expires` date has passed.
2. Verify cross-component scoping (ARCHDECISION-SCHEMA §6).
3. For each tactical tolerance in each component: verify that the referenced ADR exists, is `active`, and covers the referenced constraint.
4. Report `adr-expired` findings for any tolerance whose ADR is expired.
5. Report `adr-revoked` findings for any tolerance whose ADR is revoked.
6. Report `adr-superseded` findings for any tolerance whose ADR is superseded.
7. Report `tolerance-reference-error` for ADR references that cannot be resolved.
8. Report `expiry-warning` findings for ADRs expiring within `EXPIRY_WARN_DAYS`.

**Output:** Findings with `confidence: 1.0` for all status-based findings (expired, revoked, etc.); `confidence: 1.0` for missing reference errors.

### 4.5 IntentResolver

The IntentResolver is the final sub-agent to execute. It MUST receive the merged findings from all other sub-agents and produce a classified, confidence-adjusted output.

**Input:** All findings from SchemaValidator, DependencyAnalyzer, PatternDetector, and DecisionLogAnalyzer.

**Responsibility:**
1. For each `constraint-violation` finding, cross-reference the component's violation tolerances.
2. If a valid tactical tolerance exists for the constraint: reclassify the finding as `TACTICAL` with the ADR reference.
3. If an expired/revoked/superseded tactical tolerance exists: mark the finding as `STRATEGIC_RECLASSIFIED` with the reason.
4. If a strategic tolerance exists: mark the finding as `STRATEGIC_APPROVED`.
5. If no tolerance exists: mark the finding as `STRATEGIC_UNDOCUMENTED`.
6. Apply the Normalization Signal (§5) across all `STRATEGIC_UNDOCUMENTED` findings.
7. For findings with confidence below `CONFIDENCE_THRESHOLD`: mark as `ADVISORY`.

The IntentResolver MUST NOT modify `confidence` scores set by other agents. It MAY add a `classification_confidence` field reflecting its own classification certainty.

---

## 5. The Normalization Signal

The Normalization Signal is triggered when the same constraint violation pattern recurs across multiple components or pull requests without ADR coverage.

### 5.1 Detection Algorithm

Given the set of all `STRATEGIC_UNDOCUMENTED` findings from the current run:

1. Group findings by `constraint` id.
2. For each constraint with more than one component reporting an undocumented violation (`occurrences >= NORMALIZATION_THRESHOLD`, default: `2`):
   a. Add a `normalization-signal` finding to each affected component.
   b. Set `confidence: 1.0` on the signal finding.
   c. Include the count of affected components in `raw_data.occurrences`.

### 5.2 Normalization Signal Finding

```typescript
{
  agent: 'intent-resolver',
  component: '<affected-component>',
  constraint: '<constraint-id>',
  violation_type: 'normalization-signal',
  message: "Constraint '<id>' is violated in <N> components without ADR coverage. This pattern is normalising.",
  evidence: "Components affected: [<list>]",
  confidence: 1.0,
  raw_data: {
    occurrences: N,
    affected_components: ['<name>', ...]
  }
}
```

Normalization signal findings MUST be treated as strategic violations and MUST block CI with exit code `1`.

---

## 6. Investigator Merge and Classification

After all sub-agents complete, the Investigator MUST:

1. Fail immediately on any `schema-error` findings (exit code `2`).
2. Deduplicate findings: if multiple agents report the same (component, constraint, file, line) tuple, keep the finding with the highest confidence.
3. Pass merged findings to the IntentResolver.
4. Classify the final output into:
   - `BLOCKING` — strategic violations (unresolved, reclassified, normalization signals)
   - `TACTICAL` — valid tactical tolerances
   - `STRATEGIC_APPROVED` — strategic tolerances in place
   - `ADVISORY` — low-confidence findings for human review
   - `WARNING` — expiry warnings and non-blocking informational findings

5. Exit with code `1` if any `BLOCKING` findings exist.
6. Exit with code `0` otherwise.

---

## 7. Output Formats

Conforming implementations MUST support the following output formats, selectable via `--format`:

### 7.1 `table` (default for CLI)

Human-readable tabular output. MUST include:
- Summary line: `N strategic violations, M tactical tolerances, P advisory findings`
- Per-finding rows: component, constraint, file:line, classification, message
- Expiry warnings section (if any)

### 7.2 `json`

Machine-readable JSON report. MUST conform to:

```typescript
interface FolioReport {
  version: "folio/v1alpha1";
  generated_at: string;      // ISO 8601
  summary: {
    blocking: number;
    tactical: number;
    strategic_approved: number;
    advisory: number;
    warnings: number;
  };
  findings: ClassifiedFinding[];
}

interface ClassifiedFinding extends Finding {
  classification: 'BLOCKING' | 'TACTICAL' | 'STRATEGIC_APPROVED' | 'ADVISORY' | 'WARNING';
  adr?: string;              // ADR name if applicable
  tolerance_id?: string;     // violation tolerance id if applicable
}
```

### 7.3 `sarif`

SARIF 2.1.0 output for GitHub Code Scanning and other SARIF consumers. MUST:
- Set `tool.driver.name` to `folio`
- Set `tool.driver.version` to the tool version
- Map `BLOCKING` findings to `error` level
- Map `ADVISORY` and `WARNING` findings to `warning` level
- Map `TACTICAL` and `STRATEGIC_APPROVED` findings to `note` level
- Include `physicalLocation` with file URI and region for all findings with file/line data

---

## 8. Configuration

The Investigator reads configuration from a `folio.config.yaml` file in the working directory, or from CLI flags. CLI flags take precedence.

```yaml
# folio.config.yaml
confidence_threshold: 0.7         # Findings below this are advisory
normalization_threshold: 2        # Min component count to trigger normalization signal
expiry_warn_days: 30              # Days before expiry to warn
exclude:
  - "node_modules/**"
  - "dist/**"
  - "vendor/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
decisions_path: "./decisions"     # Default path to scan for ArchDecision files
output_format: table              # Default output format
```

---

## 9. CI Exit Codes

| Code | Meaning |
|---|---|
| `0` | Analysis complete. No blocking violations. |
| `1` | One or more blocking (strategic) violations found. |
| `2` | Configuration or schema validation error. Analysis could not complete. |

---

*© 2026 Ivanovic Nosel. Licensed under CC BY 4.0.*
