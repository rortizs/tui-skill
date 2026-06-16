# Safe Extension Controls Specification

## Purpose

Define safety gates for plugins, MCP, and configuration mutation.

## Requirements

### Requirement: Read-Only Extension Defaults

The system MUST treat plugin files, plugin specs, MCP servers, MCP prompts/tools/resources, authentication, connections, and config writes as read-only inventory by default.

#### Scenario: Plugin bridge is optional later

- GIVEN diagnostics could be surfaced through an OpenCode plugin bridge
- WHEN the user has not approved bridge installation or execution
- THEN the bridge is not installed or executed
- AND inventory remains available through the external manager

#### Scenario: MCP or config action requires approval

- GIVEN an action would connect to MCP, authenticate, execute code, mutate config, or install an extension
- WHEN the action is requested
- THEN the system requires explicit approval and a reviewed plan
- AND refusal or absence of approval leaves user files and external services untouched
