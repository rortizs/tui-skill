## Exploration: skill-management-platform

### Current State
`tui-skills` is currently an SDD/agent metadata workspace, not an implemented application. The repo contains OpenSpec artifacts and a generated `.atl/skill-registry.md`; no source tree, package manifest, CLI/TUI framework, lint/typecheck/format tooling, or test runner exists yet.

OpenCode now provides concrete integration targets. Skills are discovered from `.opencode/{skill,skills}/**/SKILL.md`, `~/.config/opencode/{skill,skills}/**/SKILL.md`, Claude-compatible `.claude/skills/**/SKILL.md`, Agent-compatible `.agents/skills/**/SKILL.md`, configured `skills.paths`, and remote `skills.urls` indexes. Runtime loading requires parseable YAML frontmatter with at least `name`; docs state `description` is required and that names should match folder names, but current runtime parsing only accepts `name` plus optional `description` and silently skips non-conforming frontmatter.

OpenCode represents agents through config (`agent` object) and markdown files in `{agent,agents}/**/*.md` plus `{mode,modes}/*.md`. Agent config supports `model`, `prompt`, `description`, `mode`, `hidden`, `permission`, options, color, temperature/top_p, and disabling built-ins. Commands are config entries or `{command,commands}/**/*.md` files with `template`, `description`, `agent`, `model`, and `subtask`; MCP prompts and skills also become commands when names do not collide. Plugins are local `{plugin,plugins}/*.{ts,js}` files or config `plugin` specs, loaded with provenance and ordered by merged config sources. MCP is configured under `mcp` with local command-based or remote URL-based servers, optional OAuth, headers, enabled flag, and timeout.

The existing proposal's registry-first direction still fits, but it should treat OpenCode as a first-class adapter with file layout, config merge precedence, skill permissions, command projection, plugin hooks, and MCP-backed prompts/tools modeled explicitly rather than inferred from path guesses.

### Affected Areas
- `/home/richard/workspace/opencode/packages/opencode/src/skill/index.ts` — authoritative runtime skill discovery, parse behavior, duplicate handling, built-in `customize-opencode`, and permission-filtered availability.
- `/home/richard/workspace/opencode/packages/opencode/src/tool/skill.ts` — native `skill` tool behavior; loads full skill content, samples sibling files, and enforces `skill` permission.
- `/home/richard/workspace/opencode/packages/opencode/src/config/config.ts` and `config/paths.ts` — config precedence, `.opencode` directory discovery, plugin origin tracking, and project/global/custom config loading.
- `/home/richard/workspace/opencode/packages/opencode/src/config/agent.ts` and `agent/agent.ts` — markdown/JSON agent representation, built-in agent overrides, permissions, modes, and subagent constraints.
- `/home/richard/workspace/opencode/packages/opencode/src/config/command.ts` and `command/index.ts` — command markdown/config loading plus command projection from MCP prompts and skills.
- `/home/richard/workspace/opencode/packages/opencode/src/config/plugin.ts`, `plugin/index.ts`, and `web/src/content/docs/plugins.mdx` — safe extension point for non-fork integration through local/npm plugins and event/tool hooks.
- `/home/richard/workspace/opencode/packages/core/src/v1/config/mcp.ts` and `opencode/src/mcp/index.ts` — MCP config model and runtime status/tools/prompts/resources that can be inventoried but should not be mutated blindly.
- `openspec/changes/skill-management-platform/proposal.md` — still valid direction, but specs/design should add OpenCode adapter requirements before task breakdown.

### Approaches
1. **External OpenCode-aware manager** — Build `tui-skills` as a separate CLI/TUI that reads OpenCode-compatible roots/configs, validates skills/agents/commands/plugins/MCP references, and writes only explicit user-approved plans.
   - Pros: Avoids forking OpenCode; aligns with OpenCode's existing file/config extension points; can support Codex and other clients through adapters; safest path for repair planning.
   - Cons: Must replicate enough discovery/merge semantics to explain runtime behavior; cannot guarantee perfect parity with OpenCode internals across versions.
   - Effort: Medium

2. **OpenCode plugin bridge** — Provide a small OpenCode plugin that surfaces Gentle AI registry/validation results inside OpenCode through hooks, custom tools, toasts, or command integration.
   - Pros: Uses official plugin mechanism; can integrate with OpenCode UI/session events without modifying OpenCode; good future path for in-client diagnostics.
   - Cons: Requires OpenCode runtime and Bun/plugin environment; plugin hooks are not ideal for offline bulk repair; still needs a separate domain core.
   - Effort: Medium

3. **Fork or patch OpenCode** — Add Gentle AI skill management directly to OpenCode's skill/config subsystems.
   - Pros: Maximum runtime parity and direct access to internal state.
   - Cons: High maintenance cost, unnecessary for inventory/validation, and couples Gentle AI release cadence to OpenCode internals.
   - Effort: High

### Recommendation
Use the **External OpenCode-aware manager** as the immediate architecture, with an optional OpenCode plugin bridge later. Do not fork OpenCode for MVP. The headless core should model OpenCode as an adapter with: discovered roots, config source precedence, skill schema/runtime-vs-doc validation, permissions, duplicate resolution, command projection, plugin inventory, and MCP inventory.

Specs/design/tasks should adjust the proposal before implementation by expanding “client adapters” to include OpenCode-specific entities beyond skills: agents, modes, commands, plugins, MCP servers/prompts, and config provenance. The MVP should still stay narrow: inventory + validation + repair planning for skills first, but the data model must not block later OpenCode-native activation profiles or plugin diagnostics.

Safe hooks without forking are: `.opencode/skills` and `~/.config/opencode/skills` for managed skills, `skills.paths` for external roots, `.opencode/commands` for explicit user commands, `.opencode/plugins` or config `plugin` specs for runtime bridge behavior, and MCP config only after explicit approval. `OPENCODE_CONFIG_DIR` is useful for testing overlays but should not be the primary user-facing activation mechanism until precedence and override behavior are specified.

### Risks
- OpenCode runtime behavior and docs are not identical: runtime accepts optional `description` and does not enforce documented name/folder rules in `skill/index.ts`; validation must report compatibility levels, not pretend one rule set is universal.
- OpenCode silently skips some invalid/non-conforming skills and logs duplicate names; the manager must preserve source paths and explain which definition wins.
- Config precedence is layered and merged; writing to the wrong level (`global`, project `opencode.json`, `.opencode`, or `OPENCODE_CONFIG_DIR`) can surprise users.
- Plugins and MCP can execute code or connect external services; inventory is safe, mutation/auth/connect operations require explicit approval and should be out of the first repair MVP.
- Command names can collide across custom commands, MCP prompts, and skills; specs must define collision reporting and avoid unsafe auto-renaming.
- No implementation stack exists, so proposal/design must choose language, packaging, test runner, and TUI framework before apply.
- Full platform scope will exceed the 400-line review budget unless split into chained PR slices.

### Ready for Proposal
Yes, but adjust the proposal before specs/design/tasks. The orchestrator should keep the MVP focused on normalized skill inventory, OpenCode/Codex validation, duplicate/collision reporting, and safe repair planning, while explicitly adding OpenCode agents/commands/plugins/MCP/config provenance as modeled integration surfaces for later slices.
