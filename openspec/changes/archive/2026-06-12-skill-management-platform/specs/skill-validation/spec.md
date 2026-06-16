# Skill Validation Specification

## Purpose

Define skill schema and compatibility validation behavior.

## Requirements

### Requirement: Client-Aware Skill Validation

The system MUST validate `SKILL.md` structure, frontmatter boundaries, required fields, and client-specific compatibility expectations without assuming all clients share one schema.

#### Scenario: Missing frontmatter boundary

- GIVEN a skill file without opening `---`
- WHEN validation runs
- THEN the issue is reported as invalid frontmatter
- AND the report explains the likely client loading impact

#### Scenario: Runtime and documentation rules differ

- GIVEN a skill satisfies runtime parsing but not documented schema guidance
- WHEN validation runs
- THEN the result distinguishes runtime compatibility from documentation compatibility
