"use client";

import { useParams, useRouter } from "next/navigation";
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MediaGallery } from "../../_components/media-gallery";
import { ApiError, getExerciseDetail, getWorkoutDetail } from "../../_lib/api";
import { useForegroundRefresh } from "../../_lib/foreground-refresh";
import type { ExerciseDetail, WorkoutTemplateDetail } from "../../_lib/types";
import { describeExerciseTarget, titleCase } from "../../_lib/workout";
import { useSession } from "../../providers";

export default function WorkoutDetailPage() {
  const params = useParams<{ workoutId: string }>();
  const router = useRouter();
  const { loading, session } = useSession();
  const [workout, setWorkout] = useState<WorkoutTemplateDetail | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(
    null,
  );
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadWorkout = useCallback(async () => {
    if (!session?.authenticated || !params.workoutId) {
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      const detail = await getWorkoutDetail(params.workoutId);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setWorkout(detail);
      setExpandedExerciseId(
        (current) => current ?? detail.exercises[0]?.exercise.id ?? null,
      );
      setErrorMessage(null);
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Could not load the workout.",
      );
    }
  }, [params.workoutId, session?.authenticated]);

  useEffect(() => {
    if (!loading && !session?.authenticated) {
      router.replace("/login");
    }
  }, [loading, router, session]);

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  useForegroundRefresh({
    disabled: !session?.authenticated || !params.workoutId,
    refresh: loadWorkout,
  });

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
      <div className="content-stack home-page">
        {errorMessage ? (
          <p className="error-banner">{errorMessage}</p>
        ) : (
          <section className="panel-card skeleton-panel" />
        )}
      </div>
    );
  }

  return (
    <div className="content-stack home-page">
      <section className="panel-card workout-list-panel">
        <div className="panel-heading">
          <p className="section-label">Exercise plan</p>
          <span className="pill neutral-pill">{workout.exercises.length}</span>
        </div>
        <div className="panel-heading home-panel-heading">
          <h1 className="home-page-title">{workout.name}</h1>
        </div>
        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
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
