# OpenCode Compatibility Specification

## Purpose

Define compatibility reporting where documented and observed OpenCode behavior may differ.

## Requirements

### Requirement: Compatibility Level Classification

The system MUST classify findings as `runtime-compatible`, `docs-compatible`, `portable-compatible`, or `incompatible` for each relevant client target.

#### Scenario: Multiple compatibility levels apply

- GIVEN an OpenCode skill has a valid runtime name but violates documented naming guidance
- WHEN compatibility is evaluated
- THEN the report marks runtime compatibility separately from docs compatibility
- AND does not claim universal validity

#### Scenario: Unsupported behavior is encountered

- GIVEN a client behavior cannot be verified for the configured version
- WHEN compatibility is evaluated
- THEN the finding is reported with explicit uncertainty
- AND the system avoids destructive recommendations
