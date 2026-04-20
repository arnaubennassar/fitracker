"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, listWorkoutSessions } from "../_lib/api";
import type { WorkoutSessionDetail } from "../_lib/types";
import { formatDuration, formatSessionDate } from "../_lib/workout";
import { useSession } from "../providers";

export default function HistoryPage() {
  const router = useRouter();
  const { loading, session } = useSession();
  const [sessions, setSessions] = useState<WorkoutSessionDetail[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const completedCount = sessions.filter(
    (sessionItem) => sessionItem.status === "completed",
  ).length;
  const feedbackPendingCount = sessions.filter(
    (sessionItem) => sessionItem.status === "completed" && !sessionItem.feedback,
  ).length;
  const totalSetCount = sessions.reduce(
    (total, sessionItem) => total + sessionItem.sets.length,
    0,
  );

  useEffect(() => {
    if (!loading && !session?.authenticated) {
      router.replace("/login");
    }
  }, [loading, router, session]);

  useEffect(() => {
    if (!session?.authenticated) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await listWorkoutSessions({ limit: 30 });
        if (!cancelled) {
          setSessions(response.items);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not load history.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <div className="content-stack">
      <section className="hero-card hero-card-spotlight">
        <div className="hero-grid">
          <div className="hero-copy-block">
            <div>
              <p className="eyebrow">Training archive</p>
              <h2 className="hero-title">Your logged work.</h2>
            </div>
            <p className="hero-copy">
              Review the last sessions, pick up anything still in progress, and
              leave feedback where the coach still needs context.
            </p>
          </div>

          <div className="metric-grid compact-metric-grid">
            <article className="metric-card">
              <span className="metric-label">Sessions</span>
              <strong className="metric-value">{sessions.length}</strong>
              <p className="metric-copy">recent logs loaded</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Completed</span>
              <strong className="metric-value">{completedCount}</strong>
              <p className="metric-copy">finished workouts</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Feedback</span>
              <strong className="metric-value">{feedbackPendingCount}</strong>
              <p className="metric-copy">{totalSetCount} sets captured overall</p>
            </article>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="section-label">Workout sessions</p>
            <h3>All logged sessions</h3>
          </div>
          <span className="pill">{sessions.length}</span>
        </div>
        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        <div className="list-stack">
          {sessions.map((sessionItem) => (
            <article className="history-card" key={sessionItem.id}>
              <div className="history-card-header">
                <div>
                  <p className="mini-kicker">
                    {formatSessionDate(sessionItem.startedAt)}
                  </p>
                  <h4>{sessionItem.workoutTemplate.name}</h4>
                  <p>
                    {sessionItem.sets.length} sets ·{" "}
                    {formatDuration(sessionItem.durationSeconds)}
                  </p>
                </div>
                <span className={`status-pill ${sessionItem.status}`}>
                  {sessionItem.status.replace("_", " ")}
                </span>
              </div>
              {sessionItem.feedback?.freeText ? (
                <p className="helper-copy">{sessionItem.feedback.freeText}</p>
              ) : null}
              <div className="action-row">
                {sessionItem.status === "in_progress" ? (
                  <Link
                    className="primary-button"
                    href={`/sessions/${sessionItem.id}`}
                  >
                    Resume
                  </Link>
                ) : null}
                {sessionItem.status === "completed" && !sessionItem.feedback ? (
                  <Link
                    className="secondary-button"
                    href={`/sessions/${sessionItem.id}/feedback`}
                  >
                    Add feedback
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {sessions.length === 0 ? (
            <article className="empty-card">
              <h4>No history yet</h4>
              <p>As soon as you finish a workout, it will land here with duration and notes.</p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
