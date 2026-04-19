"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InstallButton } from "./_components/install-button";
import { ApiError, getTodayWorkouts, listWorkoutSessions } from "./_lib/api";
import type { TodayWorkoutsResponse, WorkoutSessionDetail } from "./_lib/types";
import { formatDuration, formatSessionDate } from "./_lib/workout";
import { useSession } from "./providers";

export default function HomePage() {
  const router = useRouter();
  const { loading: sessionLoading, session } = useSession();
  const [today, setToday] = useState<TodayWorkoutsResponse | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSessionDetail[]>(
    [],
  );
  const [activeSession, setActiveSession] =
    useState<WorkoutSessionDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authenticated = Boolean(session?.authenticated && session.user);

  useEffect(() => {
    if (!sessionLoading && !authenticated) {
      router.replace("/login");
    }
  }, [authenticated, router, sessionLoading]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [todayResponse, activeResponse, historyResponse] =
          await Promise.all([
            getTodayWorkouts(),
            listWorkoutSessions({ limit: 1, status: "in_progress" }),
            listWorkoutSessions({ limit: 5 }),
          ]);

        if (cancelled) {
          return;
        }

        setToday(todayResponse);
        setActiveSession(activeResponse.items[0] ?? null);
        setRecentSessions(historyResponse.items);
        setErrorMessage(null);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not load today’s workouts.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  if (!authenticated) {
    return <section className="panel-card skeleton-panel" />;
  }

  return (
    <div className="content-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Athlete</p>
          <h2 className="hero-title">{session?.user?.displayName}</h2>
          <p className="hero-copy">
            Assigned work, quick resume, and low-friction logging built for
            phone use.
          </p>
        </div>
        <InstallButton />
      </section>

      {activeSession ? (
        <section className="panel-card accent-card">
          <div className="panel-row">
            <div>
              <p className="section-label">Resume now</p>
              <h3>{activeSession.workoutTemplate.name}</h3>
              <p>
                {activeSession.sets.length} sets logged · Started{" "}
                {new Intl.DateTimeFormat(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(activeSession.startedAt))}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                router.push(`/sessions/${activeSession.id}`);
              }}
              type="button"
            >
              Resume
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="section-label">Today</p>
            <h3>Assigned workouts</h3>
          </div>
          <span className="pill">{today?.items.length ?? 0}</span>
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <div className="list-stack">
          {today?.items.map((assignment) => (
            <article className="workout-card" key={assignment.id}>
              <div>
                <p className="mini-kicker">
                  {assignment.workoutTemplate.goal ?? "Workout"}
                </p>
                <h4>{assignment.workoutTemplate.name}</h4>
                <p>
                  {assignment.scheduleNotes ??
                    assignment.workoutTemplate.description}
                </p>
              </div>
              <div className="meta-row">
                <span>
                  {assignment.workoutTemplate.estimatedDurationMin ?? "?"} min
                </span>
                <Link
                  className="primary-button"
                  href={`/workouts/${assignment.workoutTemplate.id}`}
                >
                  Open
                </Link>
              </div>
            </article>
          ))}

          {today && today.items.length === 0 ? (
            <article className="empty-card">
              <h4>No active assignment today</h4>
              <p>
                Check with Fitnaista if the next workout has not been assigned
                yet.
              </p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="section-label">Recent</p>
            <h3>History snapshot</h3>
          </div>
          <Link className="text-link" href="/history">
            Full history
          </Link>
        </div>
        <div className="list-stack compact-stack">
          {recentSessions.map((workoutSession) => (
            <article className="history-row" key={workoutSession.id}>
              <div>
                <h4>{workoutSession.workoutTemplate.name}</h4>
                <p>
                  {formatSessionDate(workoutSession.startedAt)} ·{" "}
                  {workoutSession.status}
                </p>
              </div>
              <span className="pill neutral-pill">
                {formatDuration(workoutSession.durationSeconds)}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
