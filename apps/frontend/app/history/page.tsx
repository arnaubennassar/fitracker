"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, listWorkoutSessions } from "../_lib/api";
import { useForegroundRefresh } from "../_lib/foreground-refresh";
import type { WorkoutSessionDetail } from "../_lib/types";
import { formatDuration, formatSessionDate } from "../_lib/workout";
import { useSession } from "../providers";

export default function HistoryPage() {
  const router = useRouter();
  const { loading, session } = useSession();
  const [sessions, setSessions] = useState<WorkoutSessionDetail[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadHistory = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      const response = await listWorkoutSessions({ limit: 30 });

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setSessions(response.items);
      setErrorMessage(null);
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage(
        error instanceof ApiError ? error.message : "Could not load history.",
      );
    }
  }, []);

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
    if (!session?.authenticated) {
      return;
    }

    void loadHistory();
  }, [loadHistory, session]);

  useForegroundRefresh({
    disabled: !session?.authenticated,
    refresh: loadHistory,
  });

  return (
    <div className="content-stack home-page">
      <section className="panel-card workout-list-panel">
        <div className="panel-heading home-panel-heading">
          <h1 className="home-page-title">History</h1>
          <span className="pill neutral-pill">{sessions.length}</span>
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
              <p>
                As soon as you finish a workout, it will land here with duration
                and notes.
              </p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
