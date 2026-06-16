# Command Collision Reporting Specification

## Purpose

Define reporting for projected command names across OpenCode integration surfaces.

## Requirements

### Requirement: Command Projection Collision Report

The system MUST report command names projected from config commands, command markdown files, MCP prompts, and skills, including collisions and likely precedence when known.

#### Scenario: Collision across command sources

- GIVEN a command markdown file, MCP prompt, and skill project the same command name
- WHEN command inventory runs
- THEN the collision group lists every source and provenance
- AND likely precedence is shown only when supported by adapter knowledge

#### Scenario: Precedence is unknown

- GIVEN command precedence cannot be verified
- WHEN collision reporting runs
- THEN the report marks precedence as unknown
- AND does not auto-rename or suppress any source
