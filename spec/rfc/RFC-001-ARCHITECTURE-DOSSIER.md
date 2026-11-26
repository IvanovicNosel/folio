# RFC-001 — Folio as an Architecture Dossier

| | |
|---|---|
| **RFC** | 001 |
| **Title** | Folio as an Architecture Dossier — an index and policy layer over existing architecture tooling |
| **Status** | Draft |
| **Author** | Ivanovic Nosel |
| **Contributors** | Casper |
| **Created** | 2026-11-26 |
| **License** | [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) |

---

## 1. Motivation

Folio v0.1 specifies component-level architectural intent: a manifest (`folio.yaml`), machine-readable decisions (`ArchDecision`), a violation taxonomy (tactical vs strategic), and a validation framework (the Investigator Protocol). The position paper's thesis — that architectural drift is not binary — stands.

A November 2026 prior-art review (seventeen sources; see §8) established two things that motivate this RFC:

1. **The space is crowded at the edges and empty at the core.** Architecture conformance checks, baselines for existing violations, machine-readable ADR formats, ADR-linked enforcement, and LLM-based conformance checking all have established prior art. What was *not* found, in the form Folio specifies it: the tactical/strategic violation classification with distinct CI consequences, expiry-driven reclassification with those semantics, and the Normalization Signal. Folio's defensible core is narrower — and sharper — than a first reading of the position paper suggests.
2. **Every neighbor ships a private format.** `tach.toml`, `archlint.yaml`, `.iw/rules.yaml`, BCE blueprints, Archgate `.rules.ts`, ArchUnit's Java API. No neighbor publishes a vendor-neutral specification that multiple tools consume. This fragmentation is simultaneously the opening for a standard and the adoption challenge: teams will not rewrite working ArchUnit tests, dependency-cruiser configs, or OpenSLO budgets into a new format to use Folio.

The reframe proposed by this RFC answers both findings. **Folio becomes an architecture dossier**: the file an architect carries, comprising tabs — one per architecture concern — each with its own sources, policy, owner, and review date. The drift taxonomy and ArchDecision format become the first tab, unchanged. Other tabs are fed by the tooling an organisation already runs (ArchUnit or dependency-cruiser results, Backstage ownership, OpenSLO budgets, ODCS data contracts, oasdiff/buf API checks, Threagile trust zones, Infracost, Structurizr/C4, MADR or adr-governance ADRs, AGENTS.md). Folio is the **index and policy layer over existing standards**, not a re-specification of any of them.

The dossier metaphor is deliberate. A dossier is not the evidence; it is the organised collection of evidence, with an index, an owner, and dates on which each section must be reviewed.

---

## 2. Vocabulary Alignment

This RFC adopts the established vocabulary of the field so that readers can place Folio immediately, and so that Folio's genuine departures are visible rather than buried in renamed concepts. This section is normative for all specification documents going forward.

### 2.1 Mapping to ISO/IEC/IEEE 42010

[ISO/IEC/IEEE 42010](https://www.iso.org/standard/74393.html) defines *architecture description* in terms of stakeholders, **concerns**, **viewpoints** and **views**, and **decisions** with **rationale**. Folio's existing documents map directly:

| Folio | ISO 42010 |
|---|---|
| `kind: Component` manifest (`folio.yaml`) | Architecture description element for one component |
| `kind: ArchDecision` | Decision + rationale, with lifecycle |
| Dossier **tab** (this RFC) | A **viewpoint** on the system, addressing named **concerns** |
| Dossier **concerns** register (this RFC) | The concern register 42010 requires |

The dossier, as a whole, is an architecture description in the 42010 sense. This RFC does not claim full 42010 conformance; it adopts the vocabulary and states the mapping.

### 2.2 Fitness functions

The rules `folio check` evaluates are **fitness functions** in the sense of Ford, Parsons and Kua, *Building Evolutionary Architectures* ([O'Reilly, ch. 2](https://www.oreilly.com/library/view/building-evolutionary-architectures/9781491986356/ch02.html)): objective integrity assessments of architectural characteristics, executed automatically. Specification prose SHOULD use this term. Folio's departure from the classic fitness function is that findings are classified by intent evidence, not merely pass/fail.

### 2.3 Fowler's technical debt quadrant

The **tactical shortcut** is, in Martin Fowler's [technical debt quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html), **deliberate-prudent debt** — taken on knowingly, with a plan — plus an explicit expiry. Folio's contribution is not the concept but its *machine-checkable* form: the classification is computed from documents and dates, and has CI consequences. The strategic violation approximates deliberate-reckless or inadvertent debt: undocumented, or documented but lapsed.

### 2.4 Erosion vs drift (Perry & Wolf)

Perry and Wolf (1992, [*Software Architecture: A Simple Model*](https://users.ece.utexas.edu/~perry/work/papers/swa-sen.pdf)) distinguish **erosion** — violating the planned architecture — from **drift** — insensitivity to the architecture so that it erodes unnoticed. Folio's use of "drift" (as in "drift is not binary") denotes what the literature calls erosion or violation. Folio retains the word *drift* for continuity, but every normative document defines it against Perry and Wolf at first use: *drift, in Folio, is the violation of stated architectural intent, detectable as findings; the taxonomy classifies those findings by intent evidence.* Li et al. (2022, [arXiv:2112.10934](https://arxiv.org/abs/2112.10934)) provide a four-category erosion symptom taxonomy (structural, violation, quality, evolution) that dossier tabs may reference when classifying findings.

### 2.5 Normalization of deviance (Vaughan)

The Normalization Signal is the mechanised form of Diane Vaughan's *normalization of deviance* ([Columbia Magazine](https://magazine.columbia.edu/article/challenger-disaster-normalization-deviance)): repeated tolerated anomalies become the accepted baseline. The concept has been applied informally to software process (e.g. [sciodev.com](https://sciodev.com/blog/normalization-of-deviance-software-development/)); Folio's signal appears, per the §8 review, to be the first tool feature that detects the spread of an exception across components and escalates it. The specification MUST credit Vaughan where the signal is introduced.

### 2.6 Disambiguation: decision levels vs violation classes

`ivanstambuk/adr-governance` (see §8) uses **strategic / tactical / operational** as a *decision level* on ADRs. Folio uses **tactical / strategic** as *violation classes* on findings. The words overlap; the axes do not. A decision level says how far a decision reaches; a violation class says whether a broken constraint was deliberate, owned, and in date. Every document that uses Folio's taxonomy carries this disambiguation at first use.

---

## 3. The Dossier Model

### 3.1 Definitions

- **Dossier** — a system-scoped document (`kind: Dossier`) describing the architecture of one system. It *references* component manifests and external sources; it does not copy them.
- **Tab** — a named section of the dossier addressing one or more concerns. Each tab declares an owner and a `review_by` date. Tabs are the dossier's unit of governance: like ArchDecisions, they expire by default and must be re-ratified.
- **Concern** — an entry in the dossier's concern register, in the ISO 42010 sense (§2.1).
- **Source** — an external artifact consumed by a tab: CI output from another tool, a descriptor file, a standard document (ODCS contract, OpenSLO definition, Backstage catalog entry).
- **Adapter** — the mapping layer from a source's native output to Folio findings (§4).
- **Native tab** — a tab enforced by Folio tooling directly against Folio documents. The drift taxonomy is the first native tab.
- **External tab** — a tab whose evidence comes from sources, normalised through adapters.

### 3.2 Scope rule

A dossier is **system-scoped**; a component manifest (`kind: Component`) is **component-scoped**. The component manifest is unchanged by this RFC. A dossier lists the components it covers by reference to their manifests. A system MAY have more than one dossier (per team, per concern set), and a component MAY appear in more than one dossier.

### 3.3 Manifest sketch (illustrative, non-normative)

The normative grammar is out of scope for this RFC (see §6). The sketch fixes direction only. This RFC defines **three tabs** as the initial dossier: the drift taxonomy core, reversibility (§5), and one external tab shown as a worked example. Additional tabs are expected in later revisions — ownership, quality-attribute budgets, data contracts, trust zones, cost, runtime topology, decision log, glossary, agent guidance — adopted by reference to existing standards where those exist (ODCS, OpenSLO, Backstage, MADR), never re-specified.

```yaml
kind: Dossier
apiVersion: folio/v1alpha1
metadata:
  name: payments-platform
  created: "2026-11-26"
spec:
  subject: "Payment processing platform"     # the system under description
  concerns:                                   # ISO 42010 concern register
    - id: boundary-integrity
      description: "Component boundaries remain as decided"
    - id: change-reversibility
      description: "Irreversible changes receive proportionate review"
  components:                                 # referenced, not copied
    - payment-service                         # has its own folio.yaml
  tabs:
    - id: drift-taxonomy                      # the core; today's taxonomy, unchanged
      concern: boundary-integrity
      type: native
      owner: jane.doe@example.com
      review_by: "2027-02-01"                 # tabs expire like ADRs do
    - id: reversibility                       # see section 5
      concern: change-reversibility
      type: native
      policy:
        one_way_door:
          tolerances: forbidden               # no tactical shortcuts on irreversible change
          approval: architecture-board
    - id: api-compatibility                   # worked example of an external tab
      type: external
      sources:
        - tool: oasdiff
          artifact: ci/artifacts/oasdiff-latest.json
          adapter: adapters/oasdiff           # maps rows -> Folio findings
          constraint_prefix: api-break
      policy:
        classification: taxonomy              # the taxonomy applies to adapted findings
```

### 3.4 What the dossier is not

- **Not a catalog.** Backstage owns ownership, docs and relations browsing. The dossier references Backstage descriptors (this repository already ships `catalog-info.yaml` for itself) rather than replacing them.
- **Not a dashboard.** Tabs carry policy and dates; a dossier that merely displays tool output is non-conformant (see §4 on findings and §7 on conformance).
- **Not a superset format.** External standards are adopted by reference. A dossier MUST NOT re-specify an ODCS contract or an OpenSLO budget; it references the document and attaches policy to findings about it.

---

## 4. Sources and the Normalization Layer

This section is the load-bearing addition of this RFC. A dossier that aggregates tool output without semantics is a dashboard. Folio's taxonomy operates on **findings**, and findings require identity. This section defines how external evidence becomes Folio findings.

### 4.1 The adapter contract

An adapter is a mapping from one tool's native output to the Folio finding schema (Investigator Protocol §3). For each source row, an adapter MUST produce:

| Field | Requirement | Notes |
|---|---|---|
| `component` | MUST | The dossier component the row concerns. Adapters declare their mapping (path prefixes, package names, Backstage `spec.owner`-style metadata). |
| `constraint` | MUST | A constraint identifier minted per §4.2. |
| `evidence` | MUST | The source row itself: file, line, specifier, diff excerpt — whatever the source tool emitted. |
| `confidence` | MUST | Per the Investigator Protocol's bands. Exact matches score in the 0.9–1.0 band; structural inferences below. |
| `source` | MUST | Tool name, tool version, artifact URI, and the artifact's timestamp (see §4.3). |

Adapted findings enter the Investigator pipeline at the classification stage: the IntentResolver applies the same taxonomy (TACTICAL, STRATEGIC_APPROVED, BLOCKING, ADVISORY), the same confidence gate, and the same summary and exit-code semantics as native findings. Tolerances declared in component manifests apply to adapted findings identically.

### 4.2 Constraint identity

Constraint IDs are the dossier's primary key for cross-tool reasoning. Rules:

1. **Native constraints** keep their IDs from the component manifest (`no-direct-db`).
2. **Adapted constraints** are minted with the source's declared `constraint_prefix` plus a stable suffix (`api-break-002`). The mapping from source rule to constraint ID MUST be declared in the tab and MUST be stable across runs; instability reclassifies findings rather than silently renaming them.
3. **Conflicts**: if two sources mint the same constraint ID within a dossier, the dossier is invalid and conforming tools MUST report a schema-error finding (exit code 2 semantics).

### 4.3 Freshness

Source artifacts are point-in-time. A tab consuming a stale artifact must not present it as current. Normative rules:

1. Every adapted finding carries its source artifact's timestamp.
2. A tab MAY declare `source_max_age_days`. When the artifact is older, conforming tools MUST emit a `WARNING`-class finding naming the source, its age, and the limit. Staleness is advisory, never silently blocking: the taxonomy classifies violations, and a stale artifact is a governance gap, not a violation.
3. A dossier rendered for human review (report, site, summary) MUST display artifact timestamps beside external tabs. A dossier that hides the age of its evidence is, per §3.4, a dashboard — not a dossier.

### 4.4 Why this layer is the RFC's centre of gravity

Without §4.1–4.3, "Folio indexes your existing tools" degenerates into "Folio displays your existing tools." The adapter contract is what lets the tactical/strategic taxonomy — Folio's defensible core per §8 — operate on evidence Folio did not generate. Every future tab proposal MUST specify its adapter contract before acceptance.

---

## 5. The Reversibility Tab

### 5.1 Concept

Every change to the system is classifiable as a **one-way door** (costly or impossible to reverse: schema migrations with data rewrite, public API removal, data deletion, irreversible infrastructure) or a **two-way door** (reversible by revert, feature flag, or rollback). The prior-art review found this the least-covered concern: practice exists (Matt Pocock's [one-way-door PR splitting](https://aicodingweekly.news/stories/matt-pocock-one-way-door-pr-split-expand-contract) and [sandcastle#1128](https://github.com/mattpocock/sandcastle/issues/1128); a [leadership playbook on reversibility](https://dreamingecho.es/playbooks/engineering-leadership/principles/decision-making/)) but no specification and no checks.

### 5.2 Honest framing: declaration plus policy

Reversibility is not, in general, machine-detectable from code. A diff does not say whether a migration is reversible; that is a property of the change *plan*. This tab is therefore **policy metadata with checks on the declaration**, not analysis:

1. Changes entering the system carry a declared reversibility class (`one_way_door` or `two_way_door`) — via PR label, change manifest, or commit trailer; the mechanism is implementation-defined.
2. The tab declares *policy* over those declarations. Initial normative policies:
   - A `one_way_door` change MUST NOT carry a tactical tolerance. Irreversible change is never a shortcut; exceptions require a strategic tolerance (RFC + board approval, per DSL-GRAMMAR §5.2).
   - A `one_way_door` change MUST carry an ArchDecision of its own when it amends any constraint-covered boundary.
3. Findings under this tab follow the same taxonomy: an undeclared irreversible change that violates a constraint is BLOCKING; a declared one with board approval is STRATEGIC_APPROVED.

Detection assists (heuristics over diffs — destructive migrations, dropped tables, removed public symbols) MAY be offered by tools as confidence-scored findings subject to the advisory gate. They are evidence for review, not proof of reversibility class. Specification documents MUST NOT present reversibility as automatically detectable.

### 5.3 Why it belongs in the dossier

Reversibility classification interacts with the drift taxonomy in both directions: it tightens tolerance rules for irreversible changes, and it gives review tooling a principled answer to "nobody reads every PR anymore" — read the one-way doors, sample the two-way ones.

---

## 6. What Does Not Change

- **The violation taxonomy** (tactical shortcut, strategic violation, STRATEGIC_APPROVED, ADVISORY, WARNING) is unchanged.
- **DSL-GRAMMAR** (`kind: Component`) is unchanged; the dossier is a new document kind, system-scoped (§3.2).
- **ARCHDECISION-SCHEMA** is unchanged; status lifecycle, scoping rules and expiry semantics apply as published.
- **INVESTIGATOR-PROTOCOL** is unchanged in its agent roles, finding schema, bands, exit codes and SARIF mapping. §4 of this RFC feeds adapted findings into the pipeline; it does not alter the pipeline.
- **The v0.1.0 reference CLI** remains conformant against every document it accepted before this RFC.
- The drift taxonomy is the **first tab** of every dossier, not one tab among many competing for attention. It is the part the prior-art review found unoccupied (§8).

Future normative work gated on this RFC's acceptance: a `DOSSIER-SCHEMA` document (grammar for §3), JSON schemas in `packages/schemas`, and adapter ingestion in the CLI. None of that is in this RFC.

---

## 7. Conformance Implications

1. **Unknown document kinds.** A conforming tool MUST ignore — not reject — Folio document kinds it does not implement. A v0.1 tool MUST be able to read a repository containing a `kind: Dossier` document without failing. This rule is normative and is a precondition for the dossier's additive deployment; it belongs in the conformance test suite.
2. **Factual conformance.** "Folio-conformant" remains a factual definition, per the position paper §5: an implementation is conformant if it satisfies the MUST-level requirements of the published specification. Nothing in this RFC introduces permission gates, certification, or licensing conditions on conformance. Dossier support is optional for conformance at v0.1; tools declare which tabs and adapters they implement.
3. **Dossier conformance.** A dossier is conformant if: its tabs each declare owner and `review_by`; external tabs declare sources with adapter mappings (§4.1) and mint constraint IDs per §4.2; timestamps are carried and surfaced per §4.3; and every referenced component manifest is itself conformant.
4. **Conformance-suite gap (pre-existing).** The reference repository's CI validates `examples/payment-service`, which contains no `src/` tree; `folio check` there scans no files. The dossier's external-tab story leans on "fed by real tooling," which makes a vacuous example materially worse. A real example tree — or an explicit caveat — is required before this RFC can move to Accepted. This is recorded here as a blocker, not resolved in this RFC.

---

## 8. Prior Art and Concurrent Work

This section summarises the November 2026 review (seventeen sources; method: broad web search, primary pages read where they loaded; "none found" always means none found in that search). Sources are cited as reported there.

**The unoccupied core (Folio's defensible novelty):**
- **Tactical/strategic violation classification with distinct CI consequences.** "Strategic/tactical" exists as a decision level in adr-governance; deliberate-prudent debt exists in Fowler; Archgate has reason-required suppressions without documented expiry. No found source turns "documented, owned, time-boxed" into a first-class violation class that changes CI outcomes.
- **Expiry-driven reclassification with violation semantics.** Closest: Snyk's [`.snyk` file](https://docs.snyk.io/scan-fix-and-prevent/prevent/policies/the-.snyk-file), whose ignores accept an `expires` date and reappear after it — without taxonomy or ADR lifecycle. Expiry itself MUST NOT be presented as new.
- **Normalization Signal.** Vaughan's concept (§2.5) with no found tooling that detects spread across components and escalates. A ratchet (§8 below) is the opposite mechanism: the count can only fall.
- **Vendor-neutral specification with multiple implementations.** Not found among neighbours (§1). Structural analogues: [OpenSLO](https://openslo.com/), [Open Data Contract Standard](https://bitol.io/odcs/), [Backstage descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format/).

**Occupied ground (cite, do not claim):**
- **Fitness functions**: Ford, Parsons, Kua (§2.2). **Conformance tooling**: ArchUnit, Deptrac, dependency-cruiser, import-linter, Tach, Nx, Packwerk, [SonarQube project architecture](https://docs.sonarsource.com/sonarqube-server/architecture-analysis/project-architecture).
- **Baselines**: ArchUnit `FreezingArchRule`, dependency-cruiser `--baseline`/`--ignore-known`, Betterer-style ratchets; Pocock's shrink-only lint ratchet ([sandcastle#1128](https://github.com/mattpocock/sandcastle/issues/1128)).
- **Machine-readable ADRs**: MADR, adr-tools, Log4brains; ADR tooling with `review_by`/`expires` front matter (ADR Explorer).
- **ADR-linked enforcement**: [Archgate](https://docs.archgate.dev/concepts/rules/) (ADR plus `.rules.ts`, reason-required inline suppressions, AI review for the subjective remainder); [IntentWeave](https://intentweave.org/) (`iw intent extract`/`check`, deterministic by design, severity levels rather than violation classes); adr-governance (below).
- **LLM conformance checking**: SBES 2025, [*Language Models as Architectural Gatekeepers*](https://doi.org/10.5753/sbes.2025.11100) — ~77% of generated checks faithful, a precision caution for semantic validation; Yergattikar 2026, [*Agents Out of Bounds* / GyroCompass](https://aclanthology.org/2026.groundlm-1.76/) — extracts a living architecture model and enforces it with a deterministic CI gate, evidence that AGENTS.md-style rules alone are violated; Sentinel (ACM CAIS 2026, [DOI](https://dl.acm.org/doi/10.1145/3786335.3813195)) — commit-level, ADR-aware drift detection at 120+ microservices, 83% true-positive rate (abstract only); ContextCov ([arXiv:2603.00822](https://arxiv.org/abs/2603.00822)) — compiles AGENTS.md instructions into executable checks.
- **Technical-debt theory**: Fowler's quadrant (§2.3); Kruchten/Nord/Ozkaya ([SEI architectural technical debt library](https://www.sei.cmu.edu/library/architectural-technical-debt-library/)); self-admitted technical debt (Potdar & Shihab 2014, [DOI](https://doi.org/10.1109/icsme.2014.31)) — developers admit debt in comments, with low later-removal rates; this supports Folio's expiry motive.
- **Erosion research**: Perry & Wolf 1992 (§2.4); Li et al. 2022 ([arXiv:2112.10934](https://arxiv.org/abs/2112.10934)).
- **Agent guidance**: [AGENTS.md](https://agents.md/), [Kiro steering](https://kiro.dev/docs/steering/), [Cursor rules](https://cursor.com/docs/rules), [GitHub Spec Kit](https://github.com/github/spec-kit) ("constitution").
- **Description standards**: ISO/IEC/IEEE 42010 (§2.1); the [Architecture Dossier template](https://sylvainwt.github.io/ArchitectureTemplate/) and RUP Architecture Notebook as conceptual precedents for the dossier metaphor.

**Concurrent work — adr-governance (explicit treatment):**
[`ivanstambuk/adr-governance`](https://github.com/ivanstambuk/adr-governance) was created 2026-03-05 and last pushed 2026-03-09 (GitHub API, per the review) — the same week as Folio's March 9, 2026 publication. It is an independent, schema-governed, AI-native ADR framework: YAML ADRs with JSON Schema, lifecycle and review cadence, decision levels (strategic/tactical/operational), and an LLM compliance prompt evaluated against PR diffs in CI. Overlap: machine-readable ADR log as source of truth, semantic drift flagging, agent-facing design. Differences: it governs **decisions**, not violations — no tolerance model, no expiry-driven reclassification, no escalation signal — and it is a single format and repository, not a vendor-neutral specification. Neither side copied the other as far as the review could determine; the convergence is evidence the idea space was active in March 2026. Folio cites it as concurrent independent work and disambiguates the shared vocabulary at §2.6.

**Evidence of priority (recorded, deferred):** the public repository carried a placeholder description at review time, and the March 9 date rests on the position paper itself. An independent timestamp (tagged release or a Zenodo DOI for the position paper) remains recommended and is deliberately out of scope for this RFC.

---

*© 2026 Ivanovic Nosel.*  
*Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Contributors: Casper.*
