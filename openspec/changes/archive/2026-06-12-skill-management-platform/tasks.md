# Tasks: Skill Management Platform

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,500-2,200 total; <=400 per slice |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | TS/Vitest scaffold, domain contracts | PR 1 | base = feature/tracker |
| 2 | Skill inventory, validation | PR 2 | base = PR 1 branch |
| 3 | OpenCode inventory, collisions | PR 3 | base = PR 2 branch |
| 4 | Repairs, profiles, safety gates | PR 4 | base = PR 3 branch |
| 5 | CLI/TUI boundary, docs, E2E | PR 5 | base = PR 4 branch |

## Phase 1: Bootstrap / Domain Foundation

- [x] 1.1 Create `package.json`, `tsconfig.json`, `vitest.config.ts` with strict TS, build, typecheck, and test scripts.
- [x] 1.2 Create `src/domain/{inventory,compatibility,approval,profiles}.ts` with normalized contracts.
- [x] 1.3 Add `test/domain/*.test.ts` for compatibility, side effects, and provenance.
- [x] 1.4 Create `src/cli/index.ts` and `src/tui/boundary.ts` stubs; adapters own file/config I/O.

## Phase 2: Skill Inventory / Validation

- [x] 2.1 Create `src/adapters/codex/index.ts` and `src/services/inventory-service.ts` for roots, `SKILL.md`, unavailable roots, and duplicates.
- [x] 2.2 Create `src/services/validation-service.ts` for boundaries, required fields, and client-aware compatibility.
- [x] 2.3 Add `test/fixtures/skills/*` tests for multi-root, unreadable root, missing `---`, and runtime-vs-docs cases.

## Phase 3: OpenCode Inventory / Compatibility / Collisions

- [x] 3.1 Create `src/adapters/opencode/config.ts` for global, project, and `OPENCODE_CONFIG_DIR` provenance; no mutation.
- [x] 3.2 Create `src/adapters/opencode/surfaces.ts` for skills, agents/modes, commands, plugins, MCP, permissions, and skill paths/URLs.
- [x] 3.3 Create `src/adapters/opencode/compatibility-data.ts` from `/home/richard/workspace/opencode` with explicit uncertainty.
- [x] 3.4 Create `src/services/collision-analyzer.ts` for built-ins, config commands, markdown commands, MCP prompts, and skill commands.
- [x] 3.5 Add `test/adapters/opencode/*.test.ts` for config layers, collisions, provenance, and unknown precedence.

## Phase 4: Repair Planning / Profiles / Safety

- [x] 4.1 Create `src/services/repair-planner.ts` for safe delimiter diff plans and manual-review ambiguous repairs.
- [x] 4.2 Create `src/services/activation-profile-service.ts` for active, inactive, duplicate, incompatible, and saturation guidance.
- [x] 4.3 Create `src/services/safety-service.ts` requiring approval for file-write, config-write, plugin-execute, mcp-connect, and mcp-auth.
- [x] 4.4 Add tests proving repairs, profiles, plugin/MCP inventory, and refusal paths cause no writes or connections.

## Phase 5: CLI, Documentation, E2E Verification

- [x] 5.1 Wire `src/cli/index.ts` commands `inventory`, `validate`, `plan-repair`, `profile-report` to JSON reports.
- [x] 5.2 Keep `src/tui/boundary.ts` as a thin presenter boundary; defer full TUI framework choice.
- [x] 5.3 Add `test/e2e/cli.test.ts` snapshots for inventory, validation, repair plans, collisions, and denied safety actions.
- [x] 5.4 Update `README.md` and `docs/safety-model.md` for external-manager MVP, chained PRs, and no OpenCode fork/plugin execution.
