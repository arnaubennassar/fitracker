"use client";

import { useParams, useRouter } from "next/navigation";
import React from "react";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { MediaGallery } from "../../_components/media-gallery";
import {
  ApiError,
  completeWorkoutSession,
  createWorkoutSet,
  getExerciseDetail,
  getWorkoutDetail,
  getWorkoutSession,
} from "../../_lib/api";
import {
  clearRunnerState,
  loadRunnerState,
  saveRunnerState,
} from "../../_lib/storage";
import type {
  ExerciseDetail,
  WorkoutSessionDetail,
  WorkoutTemplateDetail,
  WorkoutTemplateExercise,
} from "../../_lib/types";
import {
  clampNumber,
  describeExerciseTarget,
  formatDuration,
  getNextIncompleteExerciseIndex,
  getSessionElapsedSeconds,
  getSuggestedSetValues,
  isExerciseComplete,
  setsForExercise,
  titleCase,
} from "../../_lib/workout";
import { useSession } from "../../providers";

type DraftState = {
  distanceMeters: number | null;
  durationSeconds: number | null;
  notes: string;
  reps: number | null;
  rpe: number | null;
  weight: number | null;
  weightUnit: string | null;
};

function NumberStepper({
  label,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  onChange: (value: number | null) => void;
  step?: number;
  value: number | null;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="stepper">
        <button
          className="icon-button"
          onClick={() => {
            onChange(value === null ? 0 : Math.max(0, value - step));
          }}
          type="button"
        >
          -
        </button>
        <input
          inputMode="decimal"
          onChange={(event) => {
            const nextValue = event.target.value.trim();
            onChange(nextValue ? Number(nextValue) : null);
          }}
          value={value ?? ""}
        />
        <button
          className="icon-button"
          onClick={() => {
            onChange((value ?? 0) + step);
          }}
          type="button"
        >
          +
        </button>
      </div>
    </label>
  );
}

function DraftFields({
  currentExercise,
  draft,
  setDraft,
}: {
  currentExercise: WorkoutTemplateExercise;
  draft: DraftState;
  setDraft: Dispatch<SetStateAction<DraftState>>;
}) {
  return (
    <div className="field-grid">
      {(currentExercise.exercise.trackingMode === "reps" ||
        currentExercise.exercise.trackingMode === "mixed") && (
        <NumberStepper
          label="Reps"
          onChange={(value) => {
            setDraft((current) => ({ ...current, reps: value }));
          }}
          value={draft.reps}
        />
      )}

      {(currentExercise.targetWeight !== null ||
        currentExercise.exercise.trackingMode === "mixed" ||
        currentExercise.exercise.trackingMode === "reps") && (
        <label className="field">
          <span>Load</span>
          <div className="inline-field">
            <input
              inputMode="decimal"
              onChange={(event) => {
                const nextValue = event.target.value.trim();
                setDraft((current) => ({
                  ...current,
                  weight: nextValue ? Number(nextValue) : null,
                }));
              }}
              value={draft.weight ?? ""}
            />
            <input
              className="unit-input"
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  weightUnit: event.target.value,
                }));
              }}
              value={draft.weightUnit ?? ""}
            />
          </div>
        </label>
      )}

      {(currentExercise.targetDurationSeconds !== null ||
        currentExercise.exercise.trackingMode === "time" ||
        currentExercise.exercise.trackingMode === "mixed") && (
        <NumberStepper
          label="Duration (sec)"
          onChange={(value) => {
            setDraft((current) => ({ ...current, durationSeconds: value }));
          }}
          value={draft.durationSeconds}
        />
      )}

      {currentExercise.targetDistanceMeters !== null && (
        <NumberStepper
          label="Distance (m)"
          onChange={(value) => {
            setDraft((current) => ({ ...current, distanceMeters: value }));
          }}
          step={25}
          value={draft.distanceMeters}
        />
      )}
    </div>
  );
}

function RatingChips({
  onPick,
  options,
  selected,
}: {
  onPick: (value: number) => void;
  options: number[];
  selected: number | null;
}) {
  return (
    <div className="chip-row">
      {options.map((option) => (
        <button
          className={selected === option ? "chip-button active" : "chip-button"}
          key={option}
          onClick={() => {
            onPick(option);
          }}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function SessionRunnerPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { loading, session: authSession } = useSession();
  const [session, setSession] = useState<WorkoutSessionDetail | null>(null);
  const [workout, setWorkout] = useState<WorkoutTemplateDetail | null>(null);
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | null>(
    null,
  );
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [restTimerEndsAt, setRestTimerEndsAt] = useState<number | null>(null);
  const [exerciseTimerEndsAt, setExerciseTimerEndsAt] = useState<number | null>(
    null,
  );
  const [exerciseTimerSeconds, setExerciseTimerSeconds] = useState<
    number | null
  >(null);
  const [exerciseTimerExerciseId, setExerciseTimerExerciseId] = useState<
    string | null
  >(null);
  const [tick, setTick] = useState(Date.now());
  const [draft, setDraft] = useState<DraftState>({
    distanceMeters: null,
    durationSeconds: null,
    notes: "",
    reps: null,
    rpe: null,
    weight: null,
    weightUnit: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !authSession?.authenticated) {
      router.replace("/login");
    }
  }, [authSession, loading, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!authSession?.authenticated || !params.sessionId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const sessionResponse = await getWorkoutSession(params.sessionId);
        const workoutResponse = await getWorkoutDetail(
          sessionResponse.workoutTemplate.id,
        );

        if (cancelled) {
          return;
        }

        setSession(sessionResponse);
        setWorkout(workoutResponse);

        const persisted = loadRunnerState(params.sessionId);
        const initialIndex =
          persisted?.currentExerciseIndex ??
          getNextIncompleteExerciseIndex(
            workoutResponse.exercises,
            sessionResponse,
          );
        setCurrentExerciseIndex(
          clampNumber(
            initialIndex,
            0,
            Math.max(workoutResponse.exercises.length - 1, 0),
          ),
        );
        setRestTimerEndsAt(persisted?.restTimerEndsAt ?? null);
        setExerciseTimerEndsAt(persisted?.exerciseTimerEndsAt ?? null);
        setExerciseTimerExerciseId(persisted?.exerciseTimerExerciseId ?? null);
        setExerciseTimerSeconds(persisted?.exerciseTimerSeconds ?? null);
        setErrorMessage(null);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not load the session.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authSession, params.sessionId]);

  const currentExercise = workout?.exercises[currentExerciseIndex] ?? null;

  useEffect(() => {
    if (!currentExercise) {
      return;
    }

    const exerciseId = currentExercise.exercise.id;

    let cancelled = false;

    async function loadExercise() {
      try {
        const detail = await getExerciseDetail(exerciseId);
        if (!cancelled) {
          setExerciseDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setExerciseDetail(null);
        }
      }
    }

    void loadExercise();

    return () => {
      cancelled = true;
    };
  }, [currentExercise]);

  useEffect(() => {
    if (!session || !workout || !params.sessionId) {
      return;
    }

    saveRunnerState(params.sessionId, {
      currentExerciseIndex,
      exerciseTimerEndsAt,
      exerciseTimerExerciseId,
      exerciseTimerSeconds,
      restTimerEndsAt,
      updatedAt: Date.now(),
    });
  }, [
    currentExerciseIndex,
    exerciseTimerEndsAt,
    exerciseTimerExerciseId,
    exerciseTimerSeconds,
    params.sessionId,
    restTimerEndsAt,
    session,
    workout,
  ]);

  useEffect(() => {
    if (!currentExercise || !session) {
      return;
    }

    const suggestedValues = getSuggestedSetValues(
      currentExercise,
      setsForExercise(session, currentExercise.id),
    );
    setDraft((current) => ({
      distanceMeters: suggestedValues.distanceMeters,
      durationSeconds: suggestedValues.durationSeconds,
      notes: current.notes,
      reps: suggestedValues.reps,
      rpe: suggestedValues.rpe,
      weight: suggestedValues.weight,
      weightUnit: suggestedValues.weightUnit,
    }));
  }, [currentExercise, session]);

  if (!session || !workout || !currentExercise) {
    return (
      <div className="content-stack">
        {errorMessage ? (
          <p className="error-banner">{errorMessage}</p>
        ) : (
          <section className="panel-card skeleton-panel" />
        )}
      </div>
    );
  }

  const currentSets = setsForExercise(session, currentExercise.id);
  const nextSetNumber = currentSets.length + 1;
  const restRemainingSeconds = restTimerEndsAt
    ? Math.max(0, Math.ceil((restTimerEndsAt - tick) / 1000))
    : 0;
  const exerciseTimerRemainingSeconds =
    exerciseTimerEndsAt && exerciseTimerExerciseId === currentExercise.id
      ? Math.max(0, Math.ceil((exerciseTimerEndsAt - tick) / 1000))
      : 0;
  const exerciseFinished = isExerciseComplete(currentExercise, session);
  const isFirstExercise = currentExerciseIndex === 0;
  const isLastExercise = currentExerciseIndex === workout.exercises.length - 1;

  return (
    <div className="content-stack">
      <section className="hero-card">
        <div className="hero-topline">
          <div>
            <p className="eyebrow">
              Exercise {currentExerciseIndex + 1} of {workout.exercises.length}
              {" · "}
              {titleCase(currentExercise.blockLabel)}
            </p>
            <h2 className="hero-title">{currentExercise.exercise.name}</h2>
          </div>
          <span className={exerciseFinished ? "pill success-pill" : "pill"}>
            Set{" "}
            {Math.min(
              nextSetNumber,
              currentExercise.targetSets ?? nextSetNumber,
            )}
            {currentExercise.targetSets
              ? ` / ${currentExercise.targetSets}`
              : ""}
          </span>
        </div>
        <p className="hero-copy">{describeExerciseTarget(currentExercise)}</p>
        <div className="meta-chip-row">
          {currentExercise.restSeconds ? (
            <span className="pill neutral-pill">
              {currentExercise.restSeconds}s rest
            </span>
          ) : null}
          {currentExercise.rpeTarget ? (
            <span className="pill neutral-pill">
              Target RPE {currentExercise.rpeTarget}
            </span>
          ) : null}
          {currentExercise.rirTarget ? (
            <span className="pill neutral-pill">
              {currentExercise.rirTarget} RIR
            </span>
          ) : null}
        </div>
        <p>
          {currentExercise.instructionOverride ?? exerciseDetail?.instructions}
        </p>
        {exerciseDetail ? (
          <MediaGallery
            media={exerciseDetail.media}
            title={currentExercise.exercise.name}
          />
        ) : null}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="section-label">Quick log</p>
            <h3>
              {exerciseFinished
                ? "Exercise complete"
                : `Log set ${nextSetNumber}`}
            </h3>
          </div>
        </div>
        <DraftFields
          currentExercise={currentExercise}
          draft={draft}
          setDraft={setDraft}
        />
        <div className="field">
          <span>RPE</span>
          <RatingChips
            onPick={(value) => {
              setDraft((current) => ({ ...current, rpe: value }));
            }}
            options={[6, 7, 8, 9, 10]}
            selected={draft.rpe}
          />
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                notes: event.target.value,
              }));
            }}
            placeholder="Only if needed"
            rows={2}
            value={draft.notes}
          />
        </label>
        <div className="action-row">
          <button
            className="primary-button"
            disabled={submitting || exerciseFinished}
            onClick={async () => {
              setSubmitting(true);
              setErrorMessage(null);

              try {
                const createdSet = await createWorkoutSet(session.id, {
                  completed: true,
                  exerciseId: currentExercise.exercise.id,
                  notes: draft.notes.trim() || null,
                  performedDistanceMeters: draft.distanceMeters,
                  performedDurationSeconds: draft.durationSeconds,
                  performedReps: draft.reps,
                  performedWeight: draft.weight,
                  performedWeightUnit: draft.weightUnit,
                  restSecondsActual:
                    currentExercise.restSeconds && restTimerEndsAt
                      ? currentExercise.restSeconds - restRemainingSeconds
                      : null,
                  rpe: draft.rpe,
                  sequence: currentExercise.sequence,
                  setNumber: nextSetNumber,
                  workoutTemplateExerciseId: currentExercise.id,
                });

                const nextSession = {
                  ...session,
                  sets: [...session.sets, createdSet].sort(
                    (left, right) =>
                      left.sequence - right.sequence ||
                      left.setNumber - right.setNumber,
                  ),
                };

                setSession(nextSession);
                setDraft((current) => ({ ...current, notes: "" }));

                if (currentExercise.restSeconds) {
                  setRestTimerEndsAt(
                    Date.now() + currentExercise.restSeconds * 1000,
                  );
                } else {
                  setRestTimerEndsAt(null);
                }

                if (isExerciseComplete(currentExercise, nextSession)) {
                  const nextIndex = getNextIncompleteExerciseIndex(
                    workout.exercises,
                    nextSession,
                  );
                  setCurrentExerciseIndex(nextIndex);
                }
              } catch (error) {
                setErrorMessage(
                  error instanceof ApiError
                    ? error.message
                    : "Could not log the set.",
                );
              } finally {
                setSubmitting(false);
              }
            }}
            type="button"
          >
            {submitting ? "Saving..." : "Complete set"}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              if (currentExercise.targetDurationSeconds) {
                setExerciseTimerEndsAt(
                  Date.now() + currentExercise.targetDurationSeconds * 1000,
                );
                setExerciseTimerSeconds(currentExercise.targetDurationSeconds);
                setExerciseTimerExerciseId(currentExercise.id);
              }
            }}
            type="button"
          >
            Start exercise timer
          </button>
        </div>

        {exerciseTimerRemainingSeconds > 0 ? (
          <div className="timer-card">
            <span>Exercise timer</span>
            <strong>{formatDuration(exerciseTimerRemainingSeconds)}</strong>
          </div>
        ) : null}

        {restRemainingSeconds > 0 ? (
          <div className="timer-card">
            <span>Rest</span>
            <strong>{formatDuration(restRemainingSeconds)}</strong>
            <button
              className="text-link"
              onClick={() => {
                setRestTimerEndsAt(null);
              }}
              type="button"
            >
              Skip
            </button>
          </div>
        ) : null}

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        <div className="chip-row">
          {currentSets.map((setItem) => (
            <span className="set-chip" key={setItem.id}>
              {setItem.setNumber}:{" "}
              {setItem.performedReps ??
                setItem.performedDurationSeconds ??
                setItem.performedDistanceMeters ??
                "-"}
            </span>
          ))}
          {currentSets.length === 0 ? (
            <span className="ghost-note">No sets logged yet.</span>
          ) : null}
        </div>
      </section>

      <section className="panel-card">
        <div className="action-row">
          <button
            className="secondary-button"
            disabled={isFirstExercise}
            onClick={() => {
              const nextIndex = clampNumber(
                currentExerciseIndex - 1,
                0,
                workout.exercises.length - 1,
              );
              setCurrentExerciseIndex(nextIndex);
            }}
            type="button"
          >
            Previous
          </button>
          <button
            className="secondary-button"
            disabled={isLastExercise}
            onClick={() => {
              const nextIndex = clampNumber(
                currentExerciseIndex + 1,
                0,
                workout.exercises.length - 1,
              );
              setCurrentExerciseIndex(nextIndex);
            }}
            type="button"
          >
            Next
          </button>
        </div>
        <button
          className="primary-button full-width"
          onClick={async () => {
            setSubmitting(true);
            try {
              const completed = await completeWorkoutSession(session.id, {
                durationSeconds: getSessionElapsedSeconds(session),
              });
              clearRunnerState(session.id);
              setSession(completed);
              router.push(`/sessions/${session.id}/feedback`);
            } catch (error) {
              setErrorMessage(
                error instanceof ApiError
                  ? error.message
                  : "Could not finish workout.",
              );
            } finally {
              setSubmitting(false);
            }
          }}
          type="button"
        >
          Finish workout
        </button>
      </section>
    </div>
  );
}
