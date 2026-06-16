# Proposal: Skill Management Platform

## Intent

Build `tui-skills` as a Gentle AI-aligned skill management layer for OpenCode, Codex, and similar AI coding clients. The first pain to solve is skill hygiene and saturation: clients should stop surprising users with warnings like “Skipped loading 7 skill(s) due to invalid SKILL.md files” and should make it clear which skills, agents, commands, plugins, MCP entries, and config sources are active, valid, duplicated, colliding, or risky to load.

OpenCode must be treated as a first-class integration target, but the MVP should remain an external manager rather than a fork. The platform should inventory and explain OpenCode behavior without mutating user config, executing plugins, or connecting MCP servers unless the user explicitly approves those actions.

## Scope

### In Scope
- Discover skills across known client roots and normalize them into one inventory.
- Validate `SKILL.md` frontmatter and report actionable issues, including the known Codex missing-`---` case.
- Plan safe repairs without silently inventing author intent.
- Define activation/profile concepts to reduce active-skill saturation.
- Model OpenCode integration surfaces: skills, agents/modes, commands, plugins, MCP servers/prompts/tools/resources, config provenance, permissions, and command collision behavior.
- Report compatibility levels where documented client behavior and observed runtime behavior may differ.
- Default plugin and MCP handling to read-only inventory unless the user explicitly approves mutation, execution, authentication, or connection.

### Out of Scope
- Remote skill marketplace, syncing, or installation.
- Destructive auto-repair without explicit user approval.
- Full TUI polish before the inventory/validation core exists.
- Guaranteeing identical runtime loading behavior across all clients.
- Forking or patching OpenCode for the MVP.
- Executing OpenCode plugins or connecting to MCP servers during inventory by default.
- Installing an OpenCode plugin bridge without explicit approval and safety controls.

## Capabilities

### New Capabilities
- `skill-inventory`: discovers configured skill roots, normalizes skills, deduplicates by identity, and preserves source paths.
- `skill-validation`: validates `SKILL.md` structure/frontmatter and reports client-specific compatibility issues.
- `skill-repair-planning`: produces safe repair plans for invalid skills, requiring explicit apply for mutations.
- `skill-activation-profiles`: models active/inactive skills, profiles, and saturation guidance across client adapters.
- `opencode-inventory`: inventories OpenCode skills, agents/modes, commands, plugins, MCP config, and config source provenance.
- `opencode-compatibility`: classifies findings by compatibility level instead of assuming docs and runtime validation are identical.
- `command-collision-reporting`: reports command names projected from config commands, command markdown, MCP prompts, and skills, including collisions and likely precedence.
- `safe-extension-controls`: defines explicit approval gates for plugin execution, config mutation, MCP authentication, and MCP connections.

### Modified Capabilities
- None.

## Approach

Use a registry-first external manager: create a headless domain core with client adapters, then expose it through a small CLI and later a TUI. Keep OpenCode/Codex rules in adapter data rather than scattered path checks. Deliver as force-chained slices within the 400-line review budget.

For OpenCode, the adapter should model file roots, config merge/provenance, skill parsing, permission-filtered availability, agent and mode definitions, command projection, plugin declarations, and MCP declarations. The MVP remains inventory, validation, duplicate/collision reporting, and repair planning. It should not fork OpenCode and should not depend on an OpenCode runtime plugin.

A later optional OpenCode plugin bridge may surface diagnostics inside OpenCode through approved plugin hooks, but it must be gated behind explicit user approval and safety controls because plugins can execute code and MCP servers can connect to external services.

Validation should report compatibility levels, for example:

- `runtime-compatible`: known to satisfy observed runtime parsing/loading behavior.
- `docs-compatible`: satisfies documented client schema expectations.
- `portable-compatible`: satisfies the stricter cross-client rules used by `tui-skills`.
- `incompatible`: likely skipped, invalid, colliding, disabled, or unsafe for a target client.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.atl/skill-registry.md` | Modified | Seed/reference for inventory behavior, not product source of truth. |
| `openspec/specs/` | New | Source specs for the new capabilities. |
| future source tree | New | Domain core, client adapters, CLI/TUI entry points. |
| OpenCode adapter model | New | Models OpenCode skill roots, agents/modes, commands, plugins, MCP, config provenance, permissions, and collision behavior. |
| OpenCode plugin bridge | Deferred | Optional later integration; not required for MVP and gated behind approval/safety controls. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Repair corrupts skill intent | Med | Default to report/plan; require explicit apply. |
| Scope exceeds review budget | High | Force chained MVP slices. |
| Client activation semantics differ | High | Use adapter contracts and explicit unsupported states. |
| OpenCode docs and runtime validation differ | High | Report compatibility levels and cite observed adapter behavior instead of claiming universal validity. |
| Command names collide across commands, MCP prompts, and skills | Med | Preserve source provenance and report collisions rather than auto-renaming. |
| Plugin or MCP inventory triggers side effects | Med | Keep plugin/MCP handling read-only by default; require explicit approval for execution, auth, connection, or mutation. |
| Writing to the wrong OpenCode config layer surprises users | Med | Track config provenance and require reviewed write plans before modifying global/project/custom config. |

## Rollback Plan

Revert generated specs/source changes. For any future repair/apply action, create backups or dry-run plans first so mutated skill files can be restored. OpenCode plugin bridge installation, plugin execution, MCP authentication/connection, and config writes must be separately reversible and must not happen in the MVP inventory path.

## Dependencies

- Project stack, package manager, test runner, and TUI framework are still undecided.
- OpenCode runtime parity work depends on observed behavior from OpenCode source and should be versioned as adapter compatibility data.

## Success Criteria

- [ ] Codex invalid frontmatter warnings can be detected and explained.
- [ ] Inventory reports skills, roots, duplicates, validity, and client compatibility.
- [ ] Repair and activation/profile behavior is specified without unsafe mutation defaults.
- [ ] OpenCode inventory reports agents/modes, commands, plugins, MCP declarations, config provenance, permissions, and command collisions.
- [ ] Validation distinguishes runtime-compatible, docs-compatible, portable-compatible, and incompatible states.
- [ ] Plugin and MCP handling remains read-only unless an explicit approval path is specified and exercised.
- [ ] MVP design avoids forking OpenCode and treats any plugin bridge as a later optional integration.
