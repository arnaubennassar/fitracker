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
  const athleteName = session?.user?.displayName?.split(" ")[0] ?? "Athlete";
  const assignedCount = today?.items.length ?? 0;
  const recentCompletedCount = recentSessions.filter(
    (workoutSession) => workoutSession.status === "completed",
  ).length;
  const recentSetCount = recentSessions.reduce(
    (total, workoutSession) => total + workoutSession.sets.length,
    0,
  );

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
      <section className="hero-card hero-card-spotlight">
        <div className="hero-grid">
          <div className="hero-copy-block">
            <div>
              <p className="eyebrow">Training dashboard</p>
              <h2 className="hero-title">Stay sharp, {athleteName}.</h2>
            </div>
            <p className="hero-copy">
              Clean view of today&apos;s training, your active session, and the
              last few workouts without making the logging flow feel heavy.
            </p>
          </div>

          <div className="metric-grid compact-metric-grid">
            <article className="metric-card">
              <span className="metric-label">Today</span>
              <strong className="metric-value">{assignedCount}</strong>
              <p className="metric-copy">assigned workouts</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Status</span>
              <strong className="metric-value">
                {activeSession ? "Live" : "Ready"}
              </strong>
              <p className="metric-copy">
                {activeSession ? "session in progress" : "nothing paused"}
              </p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Recent</span>
              <strong className="metric-value">{recentCompletedCount}</strong>
              <p className="metric-copy">{recentSetCount} sets across recent logs</p>
            </article>
          </div>
        </div>
        <div className="hero-install-row">
          <InstallButton />
        </div>
      </section>

      {activeSession ? (
        <section className="panel-card accent-card">
          <div className="panel-row">
            <div>
              <p className="section-label">Live session</p>
              <h3>{activeSession.workoutTemplate.name}</h3>
              <p>
                {activeSession.sets.length} sets logged · Started{" "}
                {new Intl.DateTimeFormat(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(activeSession.startedAt))}
              </p>
            </div>
            <div className="meta-chip-row">
              <span className="pill neutral-pill">In progress</span>
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
                {assignment.scheduleNotes ?? assignment.workoutTemplate.description}
              </p>
              <div className="meta-chip-row">
                <span className="status-pill">Assigned today</span>
                {assignment.frequencyPerWeek ? (
                  <span className="pill neutral-pill">
                    {assignment.frequencyPerWeek}x / week
                  </span>
                ) : null}
              </div>
              <div className="meta-row">
                <span className="ghost-note">Open the plan and start when ready.</span>
                <Link
                  className="primary-button"
                  href={`/workouts/${assignment.workoutTemplate.id}`}
                >
                  Open workout
                </Link>
              </div>
            </article>
          ))}

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
              <div className="meta-chip-row">
                <span
                  className={`status-pill ${workoutSession.status}`}
                >
                  {workoutSession.status.replace("_", " ")}
                </span>
                <span className="pill neutral-pill">
                  {formatDuration(workoutSession.durationSeconds)}
                </span>
              </div>
            </article>
          ))}
          {recentSessions.length === 0 ? (
            <article className="empty-card">
              <h4>No recent sessions</h4>
              <p>Your last completed workouts will show up here once you log them.</p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
