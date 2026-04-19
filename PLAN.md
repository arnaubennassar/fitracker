# Fitracker Plan

## 1. Product Vision and Goals

### Vision
Build a lightweight, coachable fitness app focused on exercise execution and workout tracking for Arnau, with Fitnaista as the main coaching interface and a clean API that can later support more users if needed.

### Primary Goals
- Help Arnau see, start, and complete assigned workouts easily from mobile.
- Make workout execution practical, fast, and low-friction during training.
- Capture structured workout results, exercise-level performance, and end-of-session feedback.
- Give Fitnaista a clear admin surface and API to create exercises, build workouts, and review adherence and progress.
- Keep the system simple to run locally or on a small server with Docker and SQLite.
- Publish a well-documented OpenAPI contract so the coach agent can consume the backend reliably.

### Explicit Non-Goals
- Nutrition planning, calorie tracking, macros, menus, recipes, or supplement management.
- Social features, public profiles, leaderboards, or community feeds in the MVP.
- Advanced wearable integrations in the first version.
- Complex analytics before the core tracking loop is solid.

## 2. Design Principles

### Mobile First
- All critical user flows must be usable one-handed on a phone.
- Large tap targets, low input friction, and minimal typing during a workout.
- Fast loading and offline-tolerant UX where reasonable.

### Simplicity Over Feature Bloat
- Optimize for the core loop: select workout, perform workout, log result, give feedback.
- Prefer opinionated defaults over too many knobs.
- Avoid building generic fitness software when the real use case is a coach-guided system for one user first.

### Real Tracking
- Store what was planned and what was actually performed.
- Support reps, load, duration, rest, perceived effort, notes, and completion state.
- Preserve workout history clearly enough to review compliance and progression.

### Coachability
- The coach must be able to define exercises and workouts without touching frontend code.
- The system should make it easy to compare prescription versus execution.
- Feedback must be structured enough to inform future plan adjustments.

### Operational Pragmatism
- SQLite is acceptable and desirable for MVP speed and simplicity.
- Clean migrations, deterministic seeds, Docker-first local setup, and straightforward CI/CD are mandatory.
- Architecture should leave room for future scaling without overengineering now.

## 3. Proposed Architecture

### Recommended Stack

#### Backend
- **Language/runtime:** TypeScript on Node.js
- **Framework:** Fastify
- **ORM / DB access:** Prisma or Drizzle ORM
- **Database:** SQLite
- **API docs:** OpenAPI generated from schema definitions
- **Validation:** Zod or framework-native schema validation

#### Frontend
- **Framework:** Next.js with App Router or a Vite-based React PWA
- **UI:** React + Tailwind CSS
- **Auth:** Passkey/WebAuthn for frontend user login
- **State/data:** TanStack Query for server state
- **PWA capabilities:** installable mobile-first experience, cached shell, optional offline draft logging

#### Infrastructure / Delivery
- **Containers:** Docker + Docker Compose for local/dev deployment
- **Reverse proxy:** optional Caddy or Nginx in deployment, not required for MVP dev
- **CI/CD:** GitHub Actions building and publishing OCI image to GHCR on every commit to `main` and every semver tag

### Architecture Rationale
- **Fastify** is fast, simple, and works well with schema-driven APIs and OpenAPI generation.
- **TypeScript across backend and frontend** reduces context switching and mismatch between API and UI types.
- **SQLite** is enough for a single-user or low-scale early product and easy to ship.
- **React + mobile-first web app** gives fast iteration and broad device reach without requiring native apps.
- **Passkeys** reduce password friction and fit a personal app well.

### High-Level Components
1. **User App**
   - Workout selection
   - Workout execution flow
   - Logging and feedback
2. **Coach/Admin API**
   - Exercise library management
   - Workout and routine authoring
   - Activity review
3. **Workout Tracking API**
   - Deliver assigned workouts and exercise metadata
   - Accept workout session data and feedback
4. **Database Layer**
   - Canonical storage of exercises, workout templates, assignments, workout sessions, and feedback
5. **Media Layer**
   - Exercise image/video references served from local mounted storage or object storage later

## 4. Initial Data Model

### Core Entities

#### User
Represents the frontend athlete account.
- `id`
- `display_name`
- `status`
- `created_at`
- `updated_at`

#### PasskeyCredential
Stores WebAuthn credentials.
- `id`
- `user_id`
- `credential_id`
- `public_key`
- `counter`
- `transports`
- `created_at`
- `last_used_at`

#### AdminToken
Token for coach/admin API authentication.
- `id`
- `name`
- `token_hash`
- `scopes`
- `last_used_at`
- `expires_at`
- `created_at`
- `revoked_at`

#### ExerciseCategory
Grouping such as strength, mobility, cardio, warmup, cooldown.
- `id`
- `name`
- `description`

#### Exercise
Canonical exercise definition.
- `id`
- `slug`
- `name`
- `category_id`
- `description`
- `instructions`
- `equipment`
- `tracking_mode` (reps, time, distance, mixed)
- `difficulty`
- `primary_muscles`
- `secondary_muscles`
- `is_active`
- `created_at`
- `updated_at`

#### ExerciseMedia
Attached image/video assets for an exercise.
- `id`
- `exercise_id`
- `type` (image, video)
- `url`
- `mime_type`
- `duration_seconds` (nullable)
- `thumbnail_url` (nullable)
- `sort_order`

#### WorkoutTemplate
Coach-authored workout definition.
- `id`
- `name`
- `description`
- `goal`
- `estimated_duration_min`
- `difficulty`
- `is_active`
- `created_at`
- `updated_at`

#### WorkoutTemplateExercise
Exercise entry inside a workout template.
- `id`
- `workout_template_id`
- `exercise_id`
- `sequence`
- `block_label` (warmup, main, finisher, cooldown)
- `instruction_override`
- `target_sets`
- `target_reps`
- `target_reps_min`
- `target_reps_max`
- `target_weight`
- `target_weight_unit`
- `target_duration_seconds`
- `target_distance_meters`
- `rest_seconds`
- `tempo`
- `rir_target` or `rpe_target`
- `is_optional`

#### WorkoutPlan
Optional higher-level plan or routine grouping workouts by schedule.
- `id`
- `name`
- `description`
- `created_at`
- `updated_at`

#### WorkoutPlanAssignment
Assigns a plan or workout to the user over time.
- `id`
- `user_id`
- `workout_plan_id` (nullable)
- `workout_template_id` (nullable)
- `assigned_by`
- `starts_on`
- `ends_on`
- `schedule_notes`
- `is_active`

#### WorkoutSession
One performed workout instance.
- `id`
- `user_id`
- `workout_template_id`
- `assignment_id` (nullable)
- `status` (planned, in_progress, completed, abandoned)
- `started_at`
- `completed_at`
- `duration_seconds`
- `performed_version_snapshot` (JSON snapshot of template at start)
- `notes`

#### ExerciseSetLog
Actual performed detail within a workout session.
- `id`
- `workout_session_id`
- `exercise_id`
- `workout_template_exercise_id` (nullable)
- `sequence`
- `set_number`
- `performed_reps`
- `performed_weight`
- `performed_weight_unit`
- `performed_duration_seconds`
- `performed_distance_meters`
- `rest_seconds_actual`
- `rpe`
- `completed`
- `notes`
- `logged_at`

#### ExerciseEventLog
Optional granular workout events for timers and UX analytics.
- `id`
- `workout_session_id`
- `exercise_id`
- `event_type` (exercise_started, set_completed, rest_started, rest_completed, skipped)
- `payload`
- `created_at`

#### WorkoutFeedback
End-of-workout feedback.
- `id`
- `workout_session_id`
- `user_id`
- `mood`
- `difficulty_rating`
- `energy_rating`
- `pain_flag`
- `pain_notes`
- `free_text`
- `created_at`

### Relationships Summary
- One `User` has many `PasskeyCredential`, `WorkoutPlanAssignment`, `WorkoutSession`, and `WorkoutFeedback`.
- One `ExerciseCategory` has many `Exercise`.
- One `Exercise` has many `ExerciseMedia` and can appear in many `WorkoutTemplateExercise` rows.
- One `WorkoutTemplate` has many `WorkoutTemplateExercise` rows.
- One `WorkoutSession` belongs to a `WorkoutTemplate` and has many `ExerciseSetLog`, `ExerciseEventLog`, and one `WorkoutFeedback`.
- One `WorkoutPlan` can group multiple assignments or future plan items.

### Notes on Modeling
- Store both planned values and performed values separately.
- Capture a JSON snapshot of the workout template when a workout starts to preserve historical truth even if templates later change.
- Keep `ExerciseEventLog` optional for MVP if schedule pressure is high, but design for it now because timers and in-workout state benefit from event tracking.

## 5. Initial API Design

### API Areas
1. Public health/version endpoints
2. User authentication and passkeys
3. User workout consumption
4. User workout logging and feedback
5. Admin exercise management
6. Admin workout and assignment management
7. Admin reporting / history lookup

### Auth Model
- **User app:** passkey/WebAuthn session-based auth or short-lived token after WebAuthn verification
- **Admin/coach API:** bearer token authentication with hashed tokens in DB
- Separate admin and athlete auth boundaries

### Suggested Endpoint Groups

#### System
- `GET /health`
- `GET /version`
- `GET /openapi.json`
- `GET /docs`

#### User Auth
- `POST /auth/passkey/register/options`
- `POST /auth/passkey/register/verify`
- `POST /auth/passkey/login/options`
- `POST /auth/passkey/login/verify`
- `POST /auth/logout`
- `GET /auth/me`

#### User Workouts
- `GET /me/workouts/today`
- `GET /me/workouts`
- `GET /me/workouts/:workoutId`
- `POST /me/workout-sessions`
- `GET /me/workout-sessions/:sessionId`
- `PATCH /me/workout-sessions/:sessionId`
- `POST /me/workout-sessions/:sessionId/sets`
- `PATCH /me/workout-sessions/:sessionId/sets/:setId`
- `POST /me/workout-sessions/:sessionId/events`
- `POST /me/workout-sessions/:sessionId/complete`
- `POST /me/workout-sessions/:sessionId/feedback`

#### User Exercises
- `GET /me/exercises`
- `GET /me/exercises/:exerciseId`

#### Admin Exercises
- `GET /admin/exercises`
- `POST /admin/exercises`
- `GET /admin/exercises/:exerciseId`
- `PATCH /admin/exercises/:exerciseId`
- `POST /admin/exercises/:exerciseId/media`
- `DELETE /admin/exercises/:exerciseId/media/:mediaId`

#### Admin Workouts
- `GET /admin/workouts`
- `POST /admin/workouts`
- `GET /admin/workouts/:workoutId`
- `PATCH /admin/workouts/:workoutId`
- `POST /admin/workouts/:workoutId/exercises`
- `PATCH /admin/workout-exercises/:id`
- `DELETE /admin/workout-exercises/:id`

#### Admin Assignments / Plans
- `GET /admin/assignments`
- `POST /admin/assignments`
- `PATCH /admin/assignments/:id`
- `GET /admin/plans`
- `POST /admin/plans`

#### Admin Reporting
- `GET /admin/users/:userId/workout-sessions`
- `GET /admin/users/:userId/workout-sessions/:sessionId`
- `GET /admin/users/:userId/feedback`
- `GET /admin/dashboard/adherence`

### API Design Notes
- Version the API from day one, for example `/api/v1/...`.
- Generate OpenAPI directly from route schemas to avoid drift.
- Add pagination and filtering to admin listing endpoints from the start.
- Use idempotent completion semantics where possible to prevent duplicate logging on unstable mobile connections.

## 6. Frontend Requirements and Main Screens

### Core Frontend Requirements
- Mobile-first responsive layout.
- Passkey sign-in and session persistence.
- Clear workout list with today/next/upcoming grouping.
- Fast workout-start flow with minimal taps.
- In-workout UI that supports timers, set logging, and quick completion.
- End-of-workout feedback capture.
- Exercise media preview with instructions.
- Graceful handling of temporary connectivity issues.

### Main Screens

#### 1. Sign-In / Registration
- Passkey registration and login
- Device-friendly onboarding copy
- Fallback error states if passkey creation fails

#### 2. Home / Today
- Today’s assigned workouts
- Quick CTA to start next workout
- Recent history snapshot
- Optional streak/compliance summary later

#### 3. Workout Detail
- Workout name, description, expected duration
- Ordered exercise list
- Exercise targets, rest, and notes
- Start button

#### 4. In-Workout Execution Screen
- Current exercise card
- Set counter and rep counter
- Rest timer and exercise timer
- Previous/next exercise navigation
- Mark set done / skip / add note
- Visible progress through workout
- Media/instructions drawer or modal

#### 5. Workout Summary / Feedback
- Summary of performed data
- Quick ratings: difficulty, energy, mood
- Pain/discomfort flag and notes
- Submit feedback action

#### 6. Exercise Library / Detail
- Exercise name, instructions, equipment, media
- Useful mainly for reviewing technique outside active workout

#### 7. History
- Completed workouts list
- Per-workout summary and feedback
- Basic trend view later, not mandatory in MVP

### UX Priorities During Workout
- Avoid hidden critical controls.
- Do not require heavy typing between sets.
- Make timer interactions obvious and forgiving.
- Preserve state across accidental refresh or app backgrounding.

## 7. Exercise Media Strategy

### MVP Strategy
- Support one or more images and optionally one short video per exercise.
- Store media metadata in DB and serve files from a simple mounted directory in Docker deployment, or from object storage if already available.
- Prefer URLs in the data model so media hosting can evolve without DB redesign.

### Recommended Rules
- Define allowed formats: JPEG, PNG, WebP for images; MP4/WebM for video.
- Keep mobile-friendly size limits and compress aggressively.
- Generate thumbnails for videos if video is supported in MVP.
- Require alt text or descriptive caption metadata where useful.

### Future-Proofing
- Abstract media storage behind a service layer.
- Start with local storage volume in dev/self-hosted mode.
- Later migrate to S3-compatible storage without changing API contracts significantly.

## 8. Security and Authentication

### User Authentication
- Use WebAuthn/passkeys for the athlete-facing frontend.
- Maintain secure challenge generation and verification server-side.
- Use secure session cookies where possible for browser flows.

### Admin Authentication
- Use long random bearer tokens stored hashed in DB.
- Support token rotation and revocation.
- Scope tokens minimally if multiple admin integrations appear later.

### General Security Controls
- Validate all input with schema validation.
- Sanitize and constrain uploaded media.
- Enforce authorization checks on every admin and user route.
- Rate-limit authentication and sensitive endpoints.
- Keep secrets out of the repo and inject via environment variables.
- Log security-relevant admin actions.

### Privacy and Safety
- Minimize personal data storage.
- Clearly separate workout feedback from any medical claims.
- If pain/discomfort is reported, store the feedback but avoid implying diagnosis.

## 9. DevEx, Docker, Migrations, Seeds, and CI/CD

### Repository Structure Proposal
- `apps/backend`
- `apps/frontend`
- `packages/shared` or `packages/api-types`
- `infra/` or `docker/`
- `.github/workflows/`
- `docs/` if supporting design notes are added later

### Local Developer Experience
- One-command local startup with Docker Compose.
- Hot reload for backend and frontend in dev mode if feasible.
- `.env.example` with all required variables.
- Seed command to create:
  - Arnau user
  - one admin token
  - starter exercise library
  - starter workouts

### Database Migrations
- Use ORM-managed migrations committed to git.
- Add migration check to CI.
- Keep schema evolution explicit and reproducible.

### Seeds
- Deterministic seed data for local testing and demos.
- Include realistic exercise/workout examples to validate UX.
- Separate base seed from optional demo seed if needed later.

### Docker
- Backend Dockerfile
- Frontend Dockerfile
- Optional Compose file with backend, frontend, and mounted data volume for SQLite/media
- Simple volume strategy:
  - `/data/app.db`
  - `/data/media/`

### CI/CD with GitHub Actions
At minimum:
1. Run install and lint
2. Run tests
3. Validate migrations/build
4. Build backend and frontend artifacts or containers
5. Publish container image to GHCR on:
   - every push to `main`
   - every semver tag, for example `v0.1.0`

### Release Conventions
- Commit and push frequently.
- Tag semver versions for meaningful milestones.
- Use conventional or at least consistently descriptive commit messages.

## 10. Roadmap and Milestones

### Phase 0, Foundation and Planning
- Create `PLAN.md`
- Confirm stack choice
- Confirm repository structure
- Define MVP scope boundaries clearly
- Document open decisions

### Phase 1, Project Bootstrap
- Initialize monorepo or dual-app workspace
- Add backend and frontend skeletons
- Add formatting, linting, TypeScript config, env handling
- Add Dockerfiles and Compose baseline
- Add initial GitHub Actions workflow skeleton

### Phase 2, Backend Core
- Set up SQLite and ORM
- Implement initial schema and first migration
- Add seed data
- Implement Fastify app structure
- Add health endpoint
- Add OpenAPI generation and docs endpoint
- Add admin token auth middleware

### Phase 3, Domain Modeling and Admin API
- Implement exercise category, exercise, media models
- Implement workout template and workout template exercise models
- Implement admin CRUD for exercises and workouts
- Implement assignment endpoints
- Add reporting endpoints for performed sessions and feedback

### Phase 4, User Auth and User API
- Implement user entity and passkey/WebAuthn flows
- Implement authenticated user session handling
- Implement endpoints for listing assigned workouts and exercise details
- Implement workout session creation and update flows
- Implement set logging and completion endpoints
- Implement feedback submission endpoint

### Phase 5, Frontend MVP
- Build passkey login flow
- Build home/today screen
- Build workout detail view
- Build in-workout execution flow with set logging
- Build timers for exercise/rest
- Build feedback screen
- Build history screen
- Add media rendering for exercises

### Phase 6, Quality and Hardening
- Add backend unit/integration tests
- Add frontend component and end-to-end smoke tests
- Validate mobile UX on real viewport sizes
- Improve loading/error/retry states
- Add audit logging for admin actions
- Review input validation and auth boundaries

### Phase 7, Deployment and Release Readiness
- Finalize GHCR publishing workflow
- Prepare production-like Docker Compose example
- Document deployment steps
- Create first semver tag for MVP candidate
- Smoke test API docs consumption by Fitnaista

### Suggested Task Order
1. Finalize plan and stack
2. Bootstrap repo structure
3. Implement DB schema and migrations
4. Expose OpenAPI-backed backend skeleton
5. Build admin authoring endpoints
6. Add passkey auth
7. Add user workout logging endpoints
8. Build frontend flow on top of stable API
9. Add media management
10. Harden CI/CD and release process

## 11. MVP Acceptance Criteria

### Backend
- SQLite-backed backend runs through Docker with persistent storage.
- Clean migrations can create the schema from scratch.
- Seed data can populate a usable demo environment.
- OpenAPI docs are exposed and match implemented endpoints.
- Admin token auth protects admin routes.

### Functional Data
- Exercises can be created, listed, updated, and linked with media.
- Workouts can be created with ordered exercise prescriptions.
- Assigned workouts can be retrieved by the athlete app.
- Completed workout sessions store planned context and performed results.
- End-of-workout feedback is stored and retrievable by admin.

### Frontend
- User can authenticate with passkey.
- User can see assigned workouts on mobile.
- User can start a workout and log exercise progress.
- User can use exercise/rest timers during workout.
- User can submit workout feedback at the end.
- Exercise detail can show image or video illustration.

### Delivery
- Repo has Docker setup, env examples, and basic run instructions.
- GitHub Actions builds and publishes container image on `main` and tags.
- First deployable MVP can be started with predictable steps.

## 12. Open Decisions and Questions to Validate Later

### Product Questions
- Is the app strictly single-user for now, or should multi-user support be designed into the admin model from day one?
- Should workout assignments be calendar-based, manually selected, or both in MVP?
- How detailed should progression logic be initially: purely coach-authored or partially automated?
- Is history/trend visualization needed in MVP or can it wait?

### Technical Questions
- Prefer **Next.js PWA** or **Vite React PWA** for the frontend?
- Prefer **Prisma** or **Drizzle** based on migration ergonomics and SQLite workflow?
- Should media uploads go through backend in MVP, or should media simply be referenced by URL first?
- Should passkeys be the only athlete auth method, or is a fallback recovery flow needed?
- Is offline-first logging required for MVP, or only resilient reconnect behavior?

### Operational Questions
- Where will Arnau deploy this first: local machine, VPS, home server, or another platform?
- Should frontend and backend publish as separate images or a combined deployment artifact?
- What semver milestone should represent the first usable coach + athlete loop, `v0.1.0` or later?

## Recommended Immediate Next Step
After approving this plan, the next implementation step should be to bootstrap the repository structure and choose the exact stack pair:
- Backend: Fastify + TypeScript + Prisma/Drizzle + SQLite
- Frontend: React mobile-first PWA with passkey auth

That choice should be made once, early, and then kept stable to avoid unnecessary churn.