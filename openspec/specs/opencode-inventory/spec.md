# OpenCode Inventory Specification

## Purpose

Define OpenCode as a first-class external inventory target.

## Requirements

### Requirement: OpenCode Surface Inventory

The system MUST inventory OpenCode skills, agents, modes, commands, plugins, MCP declarations, permissions, and config source provenance while remaining an external manager for the MVP.

#### Scenario: Inventory OpenCode surfaces

- GIVEN OpenCode project, global, and custom configuration sources
- WHEN OpenCode inventory runs
- THEN the report includes skills, agents/modes, commands, plugins, MCP entries, permissions, and source provenance
- AND identifies which source contributed each record

#### Scenario: External-manager-first MVP

- GIVEN OpenCode inventory is requested
- WHEN the MVP path runs
- THEN the system reads and reports OpenCode state without forking OpenCode, installing plugins, executing plugins, connecting MCP servers, or mutating config
