# Design: Skill Management Platform

## Technical Approach

Build `tui-skills` as an external, headless TypeScript manager with thin CLI/TUI entry points. The core owns inventory, validation, repair planning, activation profile modeling, and safety decisions. Client-specific behavior lives behind adapters; OpenCode is the first rich adapter and is modeled from observed source behavior in `/home/richard/workspace/opencode`, not from docs alone. The MVP reads OpenCode/Codex-compatible roots and config, reports findings, and produces plans; it does not fork OpenCode, execute plugins, connect MCP servers, authenticate MCP, or mutate config without explicit approval.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| MVP integration | External manager first | OpenCode fork; runtime plugin first | Inventory/validation can be delivered safely without coupling to OpenCode internals or plugin execution. |
| Stack | TypeScript domain core with CLI first; TUI shell later | Go Bubble Tea now; Python scripts | OpenCode behavior is TypeScript/JSONC/YAML-heavy, so TS reduces impedance for schemas and fixtures while leaving TUI choice deferred. |
| Adapter model | Adapter-owned discovery/provenance/compatibility rules | Path checks scattered through CLI | OpenCode has layered config, external skill roots, permissions, commands, plugins, and MCP; central adapter contracts prevent drift. |
| Compatibility | Multi-level findings: `runtime-compatible`, `docs-compatible`, `portable-compatible`, `incompatible` | Single valid/invalid flag | OpenCode runtime accepts `name` plus optional `description`; docs are stricter. Findings must explain which contract is satisfied. |
| Extensions | Inventory-only plugin/MCP by default | Load plugins or connect MCP for richer data | OpenCode plugin loading executes code; MCP local/remote starts processes or network auth. Side effects require approval gates. |

## Data Flow

```text
CLI/TUI command
  -> InventoryService
  -> ClientAdapter(OpenCode, Codex)
  -> SourceReaders(files/config only)
  -> NormalizedInventory
  -> Validators + CollisionAnalyzer + RepairPlanner
  -> Report / explicit apply plan
```

OpenCode adapter inputs: config directories from global/project/`OPENCODE_CONFIG_DIR`, `opencode.{json,jsonc}`, `.opencode/{skill,skills}`, `~/.config/opencode/{skill,skills}`, Claude/Agent external roots, configured `skills.paths`/`skills.urls`, `{agent,agents}` and `{mode,modes}` markdown, `{command,commands}` markdown/config commands, plugin declarations, and `mcp` declarations.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Create | Define TypeScript CLI package, scripts, and test command. |
| `tsconfig.json` | Create | Strict TS configuration for core and CLI. |
| `src/domain/inventory.ts` | Create | Normalized entities: skills, agents, commands, plugins, MCP, config sources. |
| `src/domain/compatibility.ts` | Create | Compatibility levels and validation result model. |
| `src/domain/approval.ts` | Create | Side-effect classes and explicit approval contract. |
| `src/adapters/opencode/*` | Create | Discovery, config provenance, skill parsing, agent/mode, command, plugin, MCP inventory, and collision projection. |
| `src/adapters/codex/*` | Create | Codex skill root/frontmatter validation adapter. |
| `src/services/*` | Create | Inventory orchestration, validation, collision analysis, repair planning. |
| `src/cli/index.ts` | Create | Initial commands for `inventory`, `validate`, and `plan-repair`. |
| `test/fixtures/*` | Create | Invalid frontmatter, duplicate skills, config layers, commands, plugin/MCP declarations. |
| `openspec/changes/skill-management-platform/design.md` | Create | This design artifact. |

## Interfaces / Contracts

```ts
type CompatibilityLevel = "runtime-compatible" | "docs-compatible" | "portable-compatible" | "incompatible";
type SideEffect = "file-write" | "config-write" | "plugin-execute" | "mcp-connect" | "mcp-auth";

interface ClientAdapter {
  id: "opencode" | "codex";
  inventory(input: InventoryInput): Promise<InventoryReport>;
  validate(report: InventoryReport): ValidationFinding[];
}

interface ApprovalGate {
  require(effect: SideEffect, planId: string): Promise<"approved" | "denied">;
}
```

OpenCode command collision analysis MUST include built-ins, config commands, command markdown, MCP prompts, and skill-projected commands. It MUST report source provenance and projected precedence; it MUST NOT auto-rename.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Parsers, compatibility levels, collision rules, approval classification | Bootstrap Vitest with fixture-driven tests before implementation. |
| Integration | OpenCode adapter inventory across layered config and file roots | Temporary directory fixtures; no plugin execution or MCP connection. |
| E2E | CLI reports for inventory/validate/plan-repair | Add after CLI exists; snapshot JSON output. |

Current `tui-skills` has no detected test runner, so the first implementation slice should add the package/test scaffold and failing fixture tests.

## Migration / Rollout

No data migration required. Roll out in chained slices: scaffold/test harness, domain model, OpenCode skill inventory, validation/compatibility, command/config provenance, safe plugin/MCP inventory, then repair planning. Plugin bridge remains deferred.

## Open Questions

- [ ] Final TUI framework remains deferred until the headless CLI proves the domain contracts.
