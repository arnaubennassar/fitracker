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
              <div>
                <p className="mini-kicker">
                  {formatSessionDate(sessionItem.startedAt)}
                </p>
                <h4>{sessionItem.workoutTemplate.name}</h4>
                <p>
                  {sessionItem.status} · {sessionItem.sets.length} sets ·{" "}
                  {formatDuration(sessionItem.durationSeconds)}
                </p>
                {sessionItem.feedback?.freeText ? (
                  <p className="helper-copy">{sessionItem.feedback.freeText}</p>
                ) : null}
              </div>
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
        </div>
      </section>
    </div>
  );
}
