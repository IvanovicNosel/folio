# Folio
## Architectural Intent Specification — Position Paper v0.1

| | |
|---|---|
| **Author** | Ivanovic Nosel |
| **Date** | March 9, 2026 |
| **Status** | Draft — Establishing Prior Art |
| **License** | Creative Commons Attribution 4.0 International (CC BY 4.0) |

---

## Abstract

This paper introduces Folio, a specification for describing, validating, and governing software architecture at the component level. Folio extends existing catalog-driven approaches with a formal constraint language, a multi-agent validation framework, and a novel violation taxonomy that distinguishes between tactical shortcuts and strategic architectural violations. The central thesis is that architectural drift is not a binary condition but a spectrum requiring intent-aware analysis, and that existing tools fail to reason about the gap between architectural intention and implementation reality.

*This document establishes the original authorship of the core concepts described herein and is published as a prior art record under Creative Commons Attribution 4.0 International license.*

---

## 1. The Problem of Architectural Drift

Software architecture is the articulation of intent. Code is its implementation. The gap between them — drift — is inevitable in any system that evolves over time. Yet the industry's tooling for detecting and managing this gap remains primitive.

Existing tools such as Backstage, ArchUnit, Deptrac, and Dependency-Cruiser share a fundamental limitation: they detect constraint violations but cannot reason about whether those violations are intentional, temporary, or systemic. A developer who deliberately bypasses a module boundary with a documented rationale and an expiry date is treated identically to one who does so accidentally. This conflation produces two failure modes:

- **False urgency** — legitimate tactical decisions are flagged as violations, eroding trust in the tooling and causing teams to disable or ignore it.
- **False safety** — genuine architectural decay is masked by the volume of noise, allowing strategic violations to accumulate undetected.

> The goal of Folio is to make architectural intent machine-readable, and to build a validation system that can distinguish between a developer who knows the rules and is deliberately bending them, and one who is unaware the rules exist.

---

## 2. Core Concepts and Original Contributions

Folio introduces the following concepts, each of which represents an original contribution to the field of architectural governance tooling.

### 2.1 The Violation Taxonomy

The most significant original contribution of this specification is a formal taxonomy of architectural violations. Folio classifies all violations into two primary categories:

| Category | Definition |
|---|---|
| **Tactical Shortcut** | A constraint violation accompanied by documented rationale, an ADR reference, an explicit expiry date, and owner acknowledgement. Tactical shortcuts are expected, governed, and time-bounded. |
| **Strategic Violation** | A constraint violation that lacks justification, has exceeded its permitted duration, crosses a security or compliance boundary, or has been repeated across multiple pull requests without resolution. Strategic violations represent genuine architectural decay. |

This distinction is absent from all existing architectural governance tools known to the author at the time of this writing. Its importance lies in the ability to preserve team velocity — allowing deliberate, documented exceptions — while maintaining integrity for violations that represent true decay.

### 2.2 The Normalization Signal

Folio introduces the concept of the **Normalization Signal**: an automatic reclassification mechanism that upgrades a tactical shortcut to a strategic violation when the same violation pattern recurs across multiple pull requests without the underlying ADR being resolved, extended, or superseded.

This addresses a failure mode not captured by static analysis: the gradual normalization of exceptions. When a tactical shortcut is copy-pasted or independently reproduced, the architecture is drifting toward treating the exception as the rule. The Normalization Signal detects this pattern and raises its severity accordingly.

### 2.3 Violation Tolerance in the DSL

Folio embeds exception governance directly into the architectural description language rather than treating it as an external process. The DSL includes a `violations` block that specifies, per component, the conditions under which a constraint violation may be tolerated:

- For **tactical shortcuts**: required ADR reference, mandatory expiry date, owner sign-off, and maximum permitted age in days.
- For **strategic exceptions**: required RFC documentation and explicit architecture board approval.

This makes exception governance a first-class concern of the architecture description, not an afterthought managed in a separate ticketing system.

### 2.4 Intent-Aware Multi-Agent Validation

Folio specifies a multi-agent validation architecture in which specialized agents handle distinct concerns — DSL validation, dependency analysis, pattern detection, data flow classification, and decision log analysis — coordinated by a master agent responsible for synthesizing findings and resolving conflicts.

The specification introduces the **Intent Resolver** agent, which applies probabilistic classification to ambiguous findings, producing a confidence score alongside each violation classification. Findings below a configurable confidence threshold are surfaced for human review rather than automated blocking. This is a deliberate design choice to reduce false positives in complex, real-world codebases.

### 2.5 Decision Log Integration

Folio specifies a machine-readable `ArchDecision` document kind that links architectural decisions to the specific constraint exceptions they justify. ADRs are scoped to components and constraints, carry expiry semantics, and participate in the violation taxonomy: an expired ADR automatically reclassifies its associated tactical shortcut as a strategic violation.

---

## 3. The Folio Specification

The full specification comprises three normative components:

- **Component Description Language** — the Folio DSL
- **Validation Framework** — the Investigator Protocol
- **Decision Log Format** — the ArchDecision Schema

Version 0.1 of each component is under active development. The DSL is defined as a YAML schema with formal constraint semantics. The Investigator Protocol specifies the interface contract between the master agent and sub-agents, including message formats, finding schemas, and conflict resolution rules. The ArchDecision Schema defines the structure, scoping rules, and lifecycle states of architectural decision records as first-class Folio documents.

Implementations claiming conformance to Folio MUST satisfy all MUST-level requirements defined in the normative specification as published by the author. The conformance test suite is a normative part of the specification.

---

## 4. Prior Art and Differentiation

The following tools and specifications constitute the relevant prior art landscape. Folio is distinguished from each:

- **Backstage (Spotify)** — provides a software catalog and component description format. Does not specify architectural constraints, violation governance, or validation.
- **ArchUnit / Deptrac / Dependency-Cruiser** — provide constraint validation against code. Do not distinguish violation intent, do not integrate decision logs, do not support probabilistic classification.
- **Structurizr / C4 Model** — provide architectural description and visualization. Do not provide validation, drift detection, or CI/CD integration.
- **RFC 2119 (IETF)** — provides conformance language (MUST, SHOULD, MAY) adopted by this specification.

The violation taxonomy, normalization signal, violation tolerance DSL syntax, intent-aware multi-agent architecture, and the combination of decision log integration with automatic expiry-driven reclassification are, to the author's knowledge, original contributions not present in any prior published work.

---

## 5. Authorship and Rights

Folio is conceived, designed, and authored by **Ivanovic Nosel**. This position paper is published on March 9, 2026 as a public record of original authorship and prior art.

The specification text is licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). Any person or organization may implement, extend, or build upon the Folio specification provided that attribution to Ivanovic Nosel as the original author is preserved in all derivative works, implementations, and publications.

The name "Folio" as applied to this specification and its associated tooling is the author's designation. Use of this name in connection with implementations claiming conformance to this specification requires attribution per the license terms above.

The author reserves the right to publish subsequent versions of this specification. Only implementations conforming to a specification version explicitly published or authorized by the author may represent themselves as Folio-conformant.

---

## 6. Roadmap

- **v0.1 Formal Specification** — normative DSL grammar, Investigator Protocol, ArchDecision Schema with RFC 2119 conformance language.
- **v0.1 Reference Implementation** — open-source tooling implementing the specification against TypeScript and Python codebases.
- **v0.1 Conformance Test Suite** — normative test suite for validating third-party implementations.
- **Trademark registration** — protection of the Folio name in connection with architectural governance tooling.

---

*© 2026 Ivanovic Nosel. All Rights Reserved.*  
*Licensed under CC BY 4.0 — attribution required for all derivative works.*
