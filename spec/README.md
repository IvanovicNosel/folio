# Folio
## Architectural Intent Specification

*Conceived and authored by Ivanovic Nosel — first published March 9, 2026*  
*Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)*

---

Folio is a specification for describing, validating, and governing software architecture at the component level. It gives teams a formal language for expressing architectural intent, a validation framework for detecting when code diverges from that intent, and a governance model for distinguishing between deliberate exceptions and genuine decay.

The core idea: **architectural drift is not binary**. A developer who bypasses a module boundary with a documented rationale and an expiry date is not the same as one who does so accidentally. Existing tools treat them identically. Folio does not.

---

## Documents

| Document | Status | Description |
|---|---|---|
| [Position Paper](POSITION-PAPER.md) | Published | Authorship record, prior art statement, original contributions |
| [DSL Grammar](DSL-GRAMMAR.md) | Draft v0.1 | Component Description Language — YAML syntax, constraints, violation tolerances |
| [ArchDecision Schema](ARCHDECISION-SCHEMA.md) | Draft v0.1 | Decision Log Format — machine-readable ADRs with expiry semantics |
| [Investigator Protocol](INVESTIGATOR-PROTOCOL.md) | Draft v0.1 | Validation Framework — multi-agent architecture, finding schema, CI output |

---

## Status

`v0.1 — Position paper published. Formal specification drafts complete. Reference implementation in progress.`

---

*© 2026 Ivanovic Nosel. All Rights Reserved.*
