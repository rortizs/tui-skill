# Skill Repair Planning Specification

## Purpose

Define safe planning for skill repairs before any file mutation.

## Requirements

### Requirement: Explicit Repair Plans

The system MUST produce reviewable repair plans for invalid skills and MUST NOT mutate files unless the user explicitly approves applying a specific plan.

#### Scenario: Repair can be inferred safely

- GIVEN a skill is missing YAML delimiters but has clear frontmatter fields
- WHEN repair planning runs
- THEN the plan shows the proposed file change
- AND the file remains unchanged until approved

#### Scenario: Author intent is ambiguous

- GIVEN validation cannot infer a safe repair
- WHEN repair planning runs
- THEN the plan reports manual review required
- AND no invented name, description, or behavior is proposed as fact
