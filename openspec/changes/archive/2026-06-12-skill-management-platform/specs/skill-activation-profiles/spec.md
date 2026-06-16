# Skill Activation Profiles Specification

## Purpose

Define activation profile and saturation guidance for skill loading.

## Requirements

### Requirement: Profile-Based Activation Guidance

The system MUST model active and inactive skills per client/profile and SHOULD report saturation risks when too many or conflicting skills are active for a context.

#### Scenario: Profile limits active skills

- GIVEN a profile selects a subset of known skills
- WHEN activation guidance is requested
- THEN selected, inactive, duplicated, and incompatible skills are reported separately
- AND no client configuration is changed by default

#### Scenario: Saturation risk detected

- GIVEN many active skills match the same task context
- WHEN profile analysis runs
- THEN the system reports saturation risk
- AND suggests profile refinement rather than silently disabling skills
