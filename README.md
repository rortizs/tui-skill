# tui-skills

`tui-skills` is an external skill-management MVP for AI coding clients. It inventories skills and OpenCode surfaces, validates skill files, plans safe repairs, reports command collisions, and produces activation-profile guidance without mutating user configuration.

## Quick path

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## Local install and packaging

Build the CLI before running it directly from the repository:

```bash
npm run build
node ./dist/cli/index.js inventory --client opencode --project-dir . --home-dir "$HOME" --skill-root ~/.config/opencode/skill
node ./dist/cli/index.js doctor --client opencode --project-dir . --home-dir "$HOME" --skill-root ~/.config/opencode/skill
```

For a local package smoke test, create a tarball and install it into a temporary project:

```bash
npm pack
mkdir -p /tmp/tui-skills-smoke
npm install --prefix /tmp/tui-skills-smoke ./tui-skills-0.1.0.tgz
/tmp/tui-skills-smoke/node_modules/.bin/tui-skills profile-report --client opencode --skill-root ~/.config/opencode/skill
```

`npm pack` runs `npm run build` through the package `prepack` lifecycle. The published tarball is constrained to the built `dist/` output, `docs/`, and this README.

Run CLI reports from the built package or import `runCli()` in tests:

```bash
tui-skills inventory --client opencode --project-dir . --home-dir "$HOME" --skill-root ~/.config/opencode/skill
tui-skills doctor --client opencode --project-dir . --home-dir "$HOME" --skill-root ~/.config/opencode/skill
tui-skills validate --client codex --skill-file ./path/to/SKILL.md
tui-skills plan-repair --client codex --skill-file ./path/to/SKILL.md
tui-skills profile-report --client opencode --skill-root ~/.config/opencode/skill --selected typescript
```

Every report is JSON so it can be reviewed, captured in snapshots, or passed to a future TUI presenter.

## MVP boundaries

| Area | Decision |
|------|----------|
| Integration model | External manager first. The MVP does not fork OpenCode and does not require an OpenCode runtime plugin. |
| Runtime safety | Inventory and reports are read-only by default. The CLI does not mutate files, write OpenCode config, execute plugins, authenticate MCP, or connect MCP servers. |
| Repair flow | `plan-repair` produces reviewable plans only. Applying plans is intentionally out of scope for this slice. |
| TUI | `src/tui/boundary.ts` is a thin JSON presenter boundary. The full TUI framework choice is deferred until the headless reports stabilize. |
| Delivery | The SDD change is delivered through chained PR slices with a 400-line review budget; this slice covers CLI/TUI/docs/E2E only. |

## CLI reports

### `inventory`

Discovers configured skill roots and, for OpenCode, config-driven surfaces such as commands, plugins, MCP declarations, and command collisions.

```bash
tui-skills inventory --client opencode --project-dir . --home-dir "$HOME" --skill-root ./skills
```

The command reports collision groups instead of renaming or suppressing sources. Precedence is marked as unknown unless adapter knowledge can prove it.

### `doctor`

Runs the default read-only diagnostic entry point for a client. The current JSON report composes existing inventory, validation, command-collision, activation-profile, repair-planning, and safety summaries without mutating skill files or client configuration.

```bash
tui-skills doctor --client opencode --project-dir . --home-dir "$HOME" --skill-root ./skills
```

### `validate`

Validates one `SKILL.md` file against client-aware runtime, docs, portable, and incompatible compatibility levels.

```bash
tui-skills validate --client codex --skill-file ./skills/example/SKILL.md
```

### `plan-repair`

Produces a safe repair plan when delimiter fixes can be inferred from existing author-provided fields. Ambiguous content requires manual review.

```bash
tui-skills plan-repair --client codex --skill-file ./skills/example/SKILL.md
```

### `profile-report`

Builds activation guidance for selected skills and reports inactive, duplicated, incompatible, and saturation states without changing client config.

```bash
tui-skills profile-report --client opencode --skill-root ./skills --profile-id frontend --selected typescript
```

## Review and verification

This project is intentionally kept in reviewable work units. For this slice, verification is:

```bash
npm ci
npm audit
npm test
npm run typecheck
npm run build
```

See `docs/safety-model.md` for the safety rules that keep the MVP read-only.
