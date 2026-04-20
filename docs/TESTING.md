# Testing Strategy

This project should use a layered frontend testing strategy:

- `Unit` tests for pure logic and data transformations.
- `Page/component` tests for UI state, rendering branches, and user interaction within a single page.
- `E2E` tests for complete user stories across routes, browser state, and API integration boundaries.

The main rule is simple:

- All core functionality and all core user stories must have E2E tests.

Unit and page-level tests are required for speed and precision, but they do not replace E2E coverage for business-critical behavior.

## Goals

- Catch regressions in real user flows before they reach production.
- Keep the default feedback loop fast for daily development.
- Make it easy for future contributors and agents to add tests without rediscovering the app structure.
- Reduce brittle tests that fail because of harmless copy or layout changes.

## Stack

The frontend testing stack should stay focused on the tools already used in this repo:

- `Vitest` for unit and page/component tests.
- `@testing-library/react` and `@testing-library/user-event` for rendering and interaction.
- `Playwright` for end-to-end browser tests.

Do not introduce another overlapping browser test framework unless there is a clear technical need.

## Coverage Rules

### 1. Core functionality must have E2E coverage

If a feature is part of the main product workflow, it must have at least one E2E test that proves the user can complete it in the browser.

This includes:

- Authentication.
- Dashboard loading and navigation.
- Opening a workout.
- Starting a workout session.
- Resuming an in-progress session.
- Logging a set.
- Completing a workout.
- Submitting session feedback.
- Viewing history and resuming or following up from history.

A feature is not considered fully covered if it only has unit tests or page/component tests.

### 2. Unit tests protect logic

Use unit tests for:

- Formatting helpers.
- Session progress calculations.
- Workout progression helpers.
- Local storage persistence helpers.
- Mapping and parsing utilities.
- Small validation and normalization functions.

Unit tests should be fast, deterministic, and independent from routing or browser navigation.

### 3. Page/component tests protect UI behavior

Use page/component tests for:

- Loading, error, empty, and success states.
- Form behavior within one screen.
- Redirect logic triggered from page state.
- Button enabled or disabled states.
- Conditional rendering.
- Error banners and retry behavior.

These tests should mock external boundaries and focus on one page or component at a time.

## Decision Rule

When adding or changing frontend behavior, choose the test level with this rule:

- If it is pure logic with no browser dependency, write a unit test.
- If it is UI behavior inside one page, write a page/component test.
- If it crosses routes, session state, local storage, browser APIs, or real user workflow boundaries, write an E2E test.

For core functionality, the answer is not either/or:

- Add the smallest useful unit and page tests for fast feedback.
- Add or update the E2E test that proves the full user story still works.

## E2E Policy

E2E coverage is mandatory for core user stories.

Each core story should have at least one durable happy-path E2E test. High-risk flows should also have focused failure-path E2E tests.

Minimum expected E2E stories:

- Sign in or create a passkey and reach the authenticated app.
- Open an assigned workout from the dashboard.
- Start a workout session from the workout detail page.
- Resume an existing session.
- Log a set in the session runner.
- Finish the workout and reach the feedback screen.
- Submit feedback and return to history.
- Open history and continue an in-progress session.

When a new core story is added to the product, the feature is not done until the E2E coverage exists.

## Stability Rules

E2E tests must be written to survive normal UI evolution.

Prefer asserting:

- Accessible roles.
- Form labels.
- Headings.
- URLs.
- Explicit workflow state.
- Visible outcomes that matter to the user.

Avoid asserting:

- Large paragraphs of exact marketing or helper copy.
- Styling details.
- Fragile DOM structure.
- Implementation-specific class names unless there is no better selector.

For workflow-critical elements, prefer stable selectors or accessible names that are intentionally part of the UI contract.

## Test Design Principles

### Keep E2E scope tight

Each E2E test should prove one user story, not every possible branch of the app.

Good:

- Start workout, log one set, finish workout, land on feedback.

Bad:

- One giant test that covers dashboard, history, settings, retries, errors, and feedback in the same spec.

### Mock by default for fast E2E

Most E2E tests should run against controlled API responses so they are fast, deterministic, and easy to debug.

That means:

- Shared fixtures for authenticated state.
- Shared factories for workouts, sessions, sets, and feedback payloads.
- Shared route handlers instead of ad hoc mocks embedded in each spec.

### Keep a small live-integration slice

In addition to mocked E2E coverage, keep a very small set of live integration tests against a seeded backend environment to catch contract drift.

This suite should stay small and target only the highest-risk flows.

## Test Matrix By Feature

### Auth

- Unit: payload shaping and small helpers.
- Page/component: login form behavior, registration trimming, error handling, redirect behavior.
- E2E: authenticate and enter the app.

### Dashboard

- Page/component: loading, empty state, error state, active session card, assigned workouts list.
- E2E: land on dashboard after auth and open a workout.

### Workout detail

- Page/component: workout data load, exercise expansion, existing in-progress session state, start button errors.
- E2E: open workout and start or resume a session.

### Session runner

- Unit: set suggestion logic, completion logic, timers, storage helpers.
- Page/component: field behavior, validation, button states, completion state rendering.
- E2E: restore state, log a set, progress to completion, navigate to feedback.

### Feedback

- Page/component: prefilled values, pain toggle behavior, save and error states.
- E2E: submit feedback after finishing a session.

### History

- Page/component: empty state, completed vs in-progress rows, feedback call to action.
- E2E: open history and resume or follow up on a session.

## Agent-Friendly Conventions

The testing system should be easy to extend without repo archaeology.

Follow these conventions:

- One clear place for unit tests near the code they cover.
- One clear place for E2E specs under the frontend E2E directory.
- Shared E2E fixtures and test data factories instead of duplicating route mocks.
- Stable naming for scenarios so a contributor can find the right spec quickly.
- One user story per E2E test unless there is a strong reason to combine steps.

When implementing a new feature, decide the test seam immediately:

- Pure helper.
- Single-page UI behavior.
- Core user story requiring E2E.

Do not default to solving everything with one broad browser test.

## Commands

The target operating model should separate fast local feedback from heavier validation:

- `test:unit` for pure logic.
- `test:page` for page/component behavior.
- `test:e2e:mock` for deterministic browser flows using mocked API responses.
- `test:e2e:live` for a very small suite against seeded backend data.
- `test:ci` for the full required validation in continuous integration.

The default local loop should be fast. The release gate should be strict.

## Definition Of Done

A frontend feature is done when all of the following are true:

- The logic is covered at the lowest useful level.
- The page behavior is covered where UI state matters.
- The full core user story has E2E coverage if the feature is part of core functionality.
- The tests are written with durable selectors and stable assertions.
- The new tests can be extended later without copy-pasting large custom setups.
