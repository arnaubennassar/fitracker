"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ApiError,
  getWorkoutSession,
  submitWorkoutFeedback,
} from "../../../_lib/api";
import type { WorkoutSessionDetail } from "../../../_lib/types";
import { useSession } from "../../../providers";

const moodOptions = ["steady", "good", "flat", "fatigued", "stressed"];

function RatingInput({
  label,
  max,
  onChange,
  value,
}: {
  label: string;
  max: number;
  onChange: (value: number) => void;
  value: number | null;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chip-row">
        {Array.from({ length: max }, (_, index) => index + 1).map((option) => (
          <button
            className={value === option ? "chip-button active" : "chip-button"}
            key={option}
            onClick={() => {
              onChange(option);
            }}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { loading, session } = useSession();
  const [workoutSession, setWorkoutSession] =
    useState<WorkoutSessionDetail | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [energyRating, setEnergyRating] = useState<number | null>(null);
  const [painFlag, setPainFlag] = useState(false);
  const [painNotes, setPainNotes] = useState("");
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session?.authenticated) {
      router.replace("/login");
    }
  }, [loading, router, session]);

  useEffect(() => {
    if (!session?.authenticated || !params.sessionId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const detail = await getWorkoutSession(params.sessionId);
        if (!cancelled) {
          setWorkoutSession(detail);
          setMood(detail.feedback?.mood ?? null);
          setDifficultyRating(detail.feedback?.difficultyRating ?? null);
          setEnergyRating(detail.feedback?.energyRating ?? null);
          setPainFlag(detail.feedback?.painFlag ?? false);
          setPainNotes(detail.feedback?.painNotes ?? "");
          setFreeText(detail.feedback?.freeText ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not load feedback.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [params.sessionId, session]);

  return (
    <div className="content-stack">
      <section className="hero-card hero-card-spotlight">
        <div className="hero-grid">
          <div className="hero-copy-block">
            <div>
              <p className="eyebrow">Session feedback</p>
              <h2 className="hero-title">
                {workoutSession?.workoutTemplate.name ?? "Workout"}
              </h2>
            </div>
            <p className="hero-copy">
              Fast notes for the next prescription. Keep it short, specific, and
              useful.
            </p>
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <span className="metric-label">Sets</span>
              <strong className="metric-value">
                {workoutSession?.sets.length ?? 0}
              </strong>
              <p className="metric-copy">logged in this session</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Status</span>
              <strong className="metric-value">
                {workoutSession?.status === "completed" ? "Done" : "Open"}
              </strong>
              <p className="metric-copy">feedback stays editable until you leave</p>
            </article>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="section-label">Coach handoff</p>
            <h3>Session notes</h3>
          </div>
        </div>
        <div className="field">
          <span>Mood</span>
          <div className="chip-row">
            {moodOptions.map((option) => (
              <button
                className={
                  mood === option ? "chip-button active" : "chip-button"
                }
                key={option}
                onClick={() => {
                  setMood(option);
                }}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <RatingInput
          label="Difficulty"
          max={10}
          onChange={setDifficultyRating}
          value={difficultyRating}
        />
        <RatingInput
          label="Energy"
          max={5}
          onChange={setEnergyRating}
          value={energyRating}
        />

        <label className="toggle-row">
          <span>Pain or discomfort to flag</span>
          <input
            checked={painFlag}
            onChange={(event) => {
              setPainFlag(event.target.checked);
            }}
            type="checkbox"
          />
        </label>

        {painFlag ? (
          <label className="field">
            <span>Pain notes</span>
            <textarea
              onChange={(event) => {
                setPainNotes(event.target.value);
              }}
              rows={2}
              value={painNotes}
            />
          </label>
        ) : null}

        <label className="field">
          <span>Coach note</span>
          <textarea
            onChange={(event) => {
              setFreeText(event.target.value);
            }}
            rows={3}
            value={freeText}
          />
        </label>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <div className="action-row">
          <button
            className="primary-button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setErrorMessage(null);

              try {
                await submitWorkoutFeedback(params.sessionId, {
                  difficultyRating,
                  energyRating,
                  freeText: freeText.trim() || null,
                  mood,
                  painFlag,
                  painNotes: painFlag ? painNotes.trim() || null : null,
                });
                router.push("/history");
              } catch (error) {
                setErrorMessage(
                  error instanceof ApiError
                    ? error.message
                    : "Could not save feedback.",
                );
              } finally {
                setSubmitting(false);
              }
            }}
            type="button"
          >
            {submitting ? "Saving..." : "Save feedback"}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              router.push("/history");
            }}
            type="button"
          >
            Skip for now
          </button>
        </div>
      </section>
    </div>
  );
}
