# Skill Inventory Specification

## Purpose

Define normalized skill discovery across supported AI coding clients.

## Requirements

### Requirement: Normalized Skill Inventory

The system MUST discover configured skill roots, parse candidate `SKILL.md` files, preserve source paths, and deduplicate skills by stable identity without deleting source records.

#### Scenario: Discover skills from multiple roots

- GIVEN multiple configured client skill roots
- WHEN inventory runs
- THEN each discovered skill record includes identity, source path, client source, and load status
- AND duplicate identities are grouped without losing source provenance

#### Scenario: Empty or unreadable roots

- GIVEN a configured root is missing or unreadable
- WHEN inventory runs
- THEN the root is reported as unavailable
- AND inventory continues for remaining roots
