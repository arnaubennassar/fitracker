"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { useEffect, useState } from "react";

import { MediaGallery } from "../../_components/media-gallery";
import {
  ApiError,
  createWorkoutSession,
  getExerciseDetail,
  getTodayWorkouts,
  getWorkoutDetail,
  listWorkoutSessions,
} from "../../_lib/api";
import type {
  ExerciseDetail,
  WorkoutAssignment,
  WorkoutSessionDetail,
  WorkoutTemplateDetail,
} from "../../_lib/types";
import { describeExerciseTarget, titleCase } from "../../_lib/workout";
import { useSession } from "../../providers";

export default function WorkoutDetailPage() {
  const params = useParams<{ workoutId: string }>();
  const router = useRouter();
  const { loading, session } = useSession();
  const [workout, setWorkout] = useState<WorkoutTemplateDetail | null>(null);
  const [assignment, setAssignment] = useState<WorkoutAssignment | null>(null);
  const [activeSession, setActiveSession] =
    useState<WorkoutSessionDetail | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(
    null,
  );
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!loading && !session?.authenticated) {
      router.replace("/login");
    }
  }, [loading, router, session]);

  useEffect(() => {
    if (!session?.authenticated || !params.workoutId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [detail, today, active] = await Promise.all([
          getWorkoutDetail(params.workoutId),
          getTodayWorkouts(),
          listWorkoutSessions({ limit: 10, status: "in_progress" }),
        ]);

        if (cancelled) {
          return;
        }

        setWorkout(detail);
        setExpandedExerciseId(
          (current) => current ?? detail.exercises[0]?.exercise.id ?? null,
        );
        setAssignment(
          today.items.find(
            (item) => item.workoutTemplate.id === params.workoutId,
          ) ?? null,
        );
        setActiveSession(
          active.items.find(
            (item) => item.workoutTemplate.id === params.workoutId,
          ) ?? null,
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not load the workout.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [params.workoutId, session]);

  useEffect(() => {
    if (!expandedExerciseId) {
      setExerciseDetail(null);
      return;
    }

    const exerciseId = expandedExerciseId;

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
  }, [expandedExerciseId]);

  if (!workout) {
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

  return (
    <div className="content-stack">
      <section className="hero-card hero-card-spotlight">
        <div className="hero-grid">
          <div className="hero-copy-block">
            <div>
              <p className="eyebrow">{workout.goal ?? "Assigned workout"}</p>
              <h2 className="hero-title">{workout.name}</h2>
            </div>
            <p className="hero-copy">{workout.description}</p>
          </div>

          <div className="metric-grid compact-metric-grid">
            <article className="metric-card">
              <span className="metric-label">Length</span>
              <strong className="metric-value">
                {workout.estimatedDurationMin ?? "?"}
              </strong>
              <p className="metric-copy">minutes planned</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Blocks</span>
              <strong className="metric-value">
                {workout.exercises.length}
              </strong>
              <p className="metric-copy">exercise targets</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Level</span>
              <strong className="metric-value">
                {workout.difficulty ?? "all"}
              </strong>
              <p className="metric-copy">training difficulty</p>
            </article>
          </div>
        </div>
        <div className="action-row">
          {activeSession ? (
            <Link
              className="primary-button"
              href={`/sessions/${activeSession.id}`}
            >
              Resume current session
            </Link>
          ) : (
            <button
              className="primary-button"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  const created = await createWorkoutSession({
                    assignmentId: assignment?.id ?? null,
                    workoutTemplateId: workout.id,
                  });
                  router.push(`/sessions/${created.id}`);
                } catch (error) {
                  setErrorMessage(
                    error instanceof ApiError
                      ? error.message
                      : "Could not start the workout.",
                  );
                } finally {
                  setStarting(false);
                }
              }}
              type="button"
            >
              {starting ? "Starting..." : "Start workout"}
            </button>
          )}
        </div>
      </section>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="section-label">Plan</p>
            <h3>{workout.exercises.length} exercise blocks</h3>
          </div>
        </div>
        <div className="list-stack">
          {workout.exercises.map((exercise) => {
            const expanded = expandedExerciseId === exercise.exercise.id;

            return (
              <article className="exercise-card" key={exercise.id}>
                <button
                  className="exercise-card-toggle"
                  onClick={() => {
                    setExpandedExerciseId((current) =>
                      current === exercise.exercise.id
                        ? null
                        : exercise.exercise.id,
                    );
                  }}
                  type="button"
                >
                  <div className="workout-card-header">
                    <span className="exercise-index">
                      {String(exercise.sequence + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="mini-kicker">
                        {titleCase(exercise.blockLabel)}
                      </p>
                      <h4>{exercise.exercise.name}</h4>
                      <p>{describeExerciseTarget(exercise)}</p>
                    </div>
                  </div>
                  <span className="ghost-note">
                    {expanded ? "Hide" : "View"}
                  </span>
                </button>

                {expanded && exerciseDetail ? (
                  <div className="exercise-detail">
                    <div className="meta-chip-row">
                      {exercise.isOptional ? (
                        <span className="pill neutral-pill">
                          Optional block
                        </span>
                      ) : null}
                      {exercise.restSeconds ? (
                        <span className="pill neutral-pill">
                          {exercise.restSeconds}s rest
                        </span>
                      ) : null}
                    </div>
                    <MediaGallery
                      media={exerciseDetail.media}
                      title={exercise.exercise.name}
                    />
                    <p>
                      {exercise.instructionOverride ??
                        exerciseDetail.instructions}
                    </p>
                    <p className="helper-copy">
                      Equipment:{" "}
                      {exerciseDetail.equipment.length > 0
                        ? exerciseDetail.equipment.join(", ")
                        : "Bodyweight"}
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
