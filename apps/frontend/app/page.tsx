"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, getTodayWorkouts, listWorkoutSessions } from "./_lib/api";
import { useForegroundRefresh } from "./_lib/foreground-refresh";
import type { TodayWorkoutsResponse, WorkoutSessionDetail } from "./_lib/types";
import { useSession } from "./providers";

export default function HomePage() {
  const router = useRouter();
  const { loading: sessionLoading, session } = useSession();
  const [today, setToday] = useState<TodayWorkoutsResponse | null>(null);
  const [activeSession, setActiveSession] =
    useState<WorkoutSessionDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const authenticated = Boolean(session?.authenticated);

  const loadDashboard = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      const [todayResponse, activeResponse] = await Promise.all([
        getTodayWorkouts(),
        listWorkoutSessions({ limit: 1, status: "in_progress" }),
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setToday(todayResponse);
      setActiveSession(activeResponse.items[0] ?? null);
      setErrorMessage(null);
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Could not load today’s workouts.",
      );
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !authenticated) {
      router.replace("/login");
    }
  }, [authenticated, router, sessionLoading]);

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void loadDashboard();
  }, [authenticated, loadDashboard]);

  useForegroundRefresh({
    disabled: !authenticated,
    refresh: loadDashboard,
  });

  if (!authenticated) {
    return <section className="panel-card skeleton-panel" />;
  }

  return (
    <div className="content-stack home-page">
      <section className="panel-card workout-list-panel">
        <div className="panel-heading home-panel-heading">
          <h1 className="home-page-title">Assigned workouts</h1>
          {today ? (
            <span className="pill neutral-pill">{today.items.length}</span>
          ) : null}
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <div className="list-stack home-workout-list">
          {!today && !errorMessage ? (
            <article
              aria-hidden="true"
              className="workout-card skeleton-panel"
            />
          ) : null}

          {today?.items.map((assignment) => {
            const resumeSession =
              activeSession &&
              (activeSession.assignmentId === assignment.id ||
                activeSession.workoutTemplate.id ===
                  assignment.workoutTemplate.id)
                ? activeSession
                : null;

            return (
              <article className="workout-card" key={assignment.id}>
                <div className="workout-card-header">
                  <div>
                    <p className="mini-kicker">
                      {assignment.workoutTemplate.goal ?? "Workout"}
                    </p>
                    <h4>{assignment.workoutTemplate.name}</h4>
                  </div>
                  <span className="pill neutral-pill">
                    {assignment.workoutTemplate.estimatedDurationMin ?? "?"} min
                  </span>
                </div>
                <p>
                  {assignment.scheduleNotes ??
                    assignment.workoutTemplate.description}
                </p>
                <div className="meta-row">
                  <div className="meta-chip-row">
                    <span
                      className={
                        resumeSession
                          ? "status-pill in_progress"
                          : "status-pill"
                      }
                    >
                      {resumeSession ? "In progress" : "Assigned today"}
                    </span>
                    {assignment.frequencyPerWeek ? (
                      <span className="pill neutral-pill">
                        {assignment.frequencyPerWeek}x / week
                      </span>
                    ) : null}
                  </div>
                  {resumeSession ? (
                    <button
                      className="primary-button"
                      onClick={() => {
                        router.push(`/sessions/${resumeSession.id}`);
                      }}
                      type="button"
                    >
                      Resume
                    </button>
                  ) : (
                    <Link
                      className="primary-button"
                      href={`/workouts/${assignment.workoutTemplate.id}`}
                    >
                      Open workout
                    </Link>
                  )}
                </div>
              </article>
            );
          })}

          {today && today.items.length === 0 ? (
            <article className="empty-card">
              <h4>No active assignment today</h4>
              <p>
                The queue is clear for now. Check with your coach if the next
                block has not landed yet.
              </p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
