# AGENTS

This repository is a `pnpm` monorepo for Fitracker. Agents working here should behave like careful maintainers: make the smallest correct change, preserve existing architecture and conventions, and avoid unrelated edits.

## Working Rules

- Read the relevant code and nearby docs before changing behavior.
- Prefer targeted changes over broad refactors unless the task explicitly requires a larger rewrite.
- Keep backend and frontend contracts aligned when a change crosses that boundary.
- Do not introduce new tools, frameworks, or patterns without a clear need.
- Update documentation when behavior, setup, or workflows materially change.

## Testing Expectations

- `docs/TESTING.md` is the source of truth for test strategy and required coverage.
- Every time code is changed meaningfully or a new feature is added, follow the testing rules in `docs/TESTING.md`.
- In particular, core functionality and core user stories require the appropriate automated coverage, including E2E coverage where `docs/TESTING.md` says it is mandatory.
- Do not treat a feature as done if the required tests have not been added or updated.

## Validation Before Push

Before pushing changes, the relevant quality checks must pass. At minimum, agents should run and fix failures in:

- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

If a change only affects part of the repo, narrower checks may be useful during development, but before push the branch should be in a state where tests, linters, type checks, and builds pass.

## Change Discipline

- Avoid destructive git operations unless explicitly requested.
- Do not revert user changes that are unrelated to the task.
- Keep commits focused and scoped to the requested work.
- Note any assumptions, risks, or follow-up work when handing off changes.
