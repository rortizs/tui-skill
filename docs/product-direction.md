# Product Direction: Cross-Client Skill Doctor

`tui-skill` is a cross-client skill doctor and activation manager for the Gentle AI ecosystem. It should help users understand, validate, repair, and eventually toggle skills across Codex, OpenCode, Pi, and related AI coding clients without binding the core product to any single runtime.

## Decision

Build `tui-skill` as an external manager first, not as an OpenCode plugin.

| Area | Direction |
|------|-----------|
| Primary home | Gentle AI ecosystem layer |
| Core product | Cross-client diagnostics and activation model |
| OpenCode plugin | Optional future visual adapter |
| Codex support | Treat Codex as the strict compatibility baseline |
| Safety model | Read-only by default; mutation only through explicit plans and approval |

## Why this exists

Codex, OpenCode, and Pi expose skills differently:

- Codex emits visible warnings when user-installed `SKILL.md` files are invalid.
- OpenCode exposes `/skill` and a skill modal, but appears more permissive.
- Pi exposes a `/skill`-style list with enabled/disabled markers.

The problem is not just listing skills. Users need to know whether their installed skills are valid, duplicated, shadowed by another root, client-compatible, enabled, disabled, or likely to create runtime noise.

## Product layers

### 1. Doctor layer

The doctor layer explains skill health before a client runtime loads the skills.

- Inventory discovered skill roots.
- Detect unavailable roots.
- Validate `SKILL.md` frontmatter and required fields.
- Detect duplicate skills across roots.
- Classify client compatibility:
  - `runtime-compatible`
  - `docs-compatible`
  - `portable-compatible`
  - `incompatible`
- Generate repair plans without mutating files by default.

### 2. Activation layer

The activation layer explains and eventually changes which skills are active.

- Report enabled/disabled state where a client exposes it.
- Distinguish activation semantics by adapter:
  - native toggle
  - path-scoped toggle
  - name-scoped toggle
  - profile overlay
  - root exclusion
  - unsupported
- Warn when a skill looks disabled but another duplicate source keeps it active.
- Apply changes only through explicit approval.

## Client convergence

`tui-skill` should not replace each client's runtime UI.

| Client | Existing surface | `tui-skill` role |
|--------|------------------|------------------|
| Codex | Skill warnings and enable/disable UI | Explain warnings, validate strict compatibility, detect confusing activation state |
| OpenCode | `/skill` modal and MCP/LSP side surfaces | Provide diagnostics and JSON reports that a future plugin can consume |
| Pi | `/skill`-style list with markers | Model inventory and activation semantics once the canonical runtime behavior is confirmed |

## Existing upstream evidence

The direction is backed by existing upstream issues:

- `openai/codex#20704` — repeated invalid `SKILL.md` warning spam.
- `openai/codex#23987` — disable UI is path-scoped but appears name-scoped; duplicates remain active.
- `openai/codex#27985` — related skills remain enabled after disabling an app.
- `anomalyco/opencode#32100` — machine-readable skill inventory and validation diagnostics.
- `anomalyco/opencode#31616` — skill documentation/runtime behavior inconsistencies.
- `Gentleman-Programming/gentle-ai#843` — proposed Gentle AI home for `tui-skill`.

## Non-goals for the MVP

- Do not fork OpenCode.
- Do not make the OpenCode plugin the core product.
- Do not connect MCP servers during inventory.
- Do not execute plugins during inventory.
- Do not silently mutate skill files or client configs.
- Do not assume enable/disable means the same thing across clients.

## Next step

Plan the next change as `activation-management`: model cross-client activation capabilities and add safe reporting before implementing write/toggle behavior.
