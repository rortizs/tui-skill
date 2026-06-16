# Safety Model

`tui-skills` is safe by default because the MVP is an external manager: it reads local files and configuration, builds JSON reports, and stops before any action that would change user state or contact external services.

## Default rule

No side effect runs without explicit approval and a reviewed plan.

| Side effect | Default behavior | Reason |
|-------------|------------------|--------|
| File writes | Denied | Repair output must remain reviewable before any mutation. |
| Config writes | Denied | OpenCode has global, project, and custom config layers; writing the wrong layer is surprising. |
| Plugin execution | Denied | OpenCode plugins execute code and are not needed for MVP inventory. |
| MCP connection | Denied | MCP servers may start local processes or connect to remote services. |
| MCP authentication | Denied | Authentication can create credentials or external sessions. |

The CLI includes a `safety` block in JSON reports that lists these denied actions.

## External-manager MVP

The MVP does not fork OpenCode, patch OpenCode, install a plugin bridge, execute OpenCode plugins, or connect MCP servers. It treats OpenCode as an integration target by reading documented and observed configuration surfaces, then reporting what it can prove.

This keeps the tool useful even when OpenCode behavior is uncertain:

- command collisions are reported with provenance;
- precedence is marked unknown unless verified;
- repair plans show proposed content instead of writing files;
- activation profiles recommend refinement instead of disabling skills.

## Approval boundary

`src/services/safety-service.ts` centralizes approval-gated side effects. The MVP uses a deny-by-default gate in CLI reporting to prove refused plugin and MCP actions do not execute.

Future apply commands may add explicit approval, but they must preserve this sequence:

1. Build a reviewable plan.
2. Show the target files, config layer, plugin, or MCP server.
3. Ask for explicit approval for that plan ID.
4. Execute only the approved action.
5. Report the result and keep rollback information available.

## Chained PR boundary

The SDD change uses chained PR slices with a 400-line review budget. This safety model belongs to the CLI/TUI/docs/E2E slice and does not authorize mutation features. A future PR must introduce any apply behavior as its own reviewable work unit with tests and documentation.
