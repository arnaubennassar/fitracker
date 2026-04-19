import { env } from "./env";

const highlights = [
  "Passkey/WebAuthn registration, login, and cookie-backed session handling.",
  "/api/v1 user endpoints for today's workout, workout detail, session, sets, completion, and feedback.",
  "Admin bearer token auth and admin catalog/workout/reporting endpoints preserved from earlier phases.",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Phase 4 Athlete App</p>
        <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
        <p className="lede">
          Mobile-first workout tracker for Arnau and Fitnaista, ready for
          passkey sign-in, assigned workouts, and end-of-session feedback.
        </p>
      </section>

      <section className="card-grid" aria-label="Phase 4 highlights">
        {highlights.map((item) => (
          <article className="card" key={item}>
            <p>{item}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div>
          <p className="section-label">API base path</p>
          <h2>Frontend to backend contract</h2>
          <p>{env.NEXT_PUBLIC_API_BASE_URL}</p>
        </div>
        <div style={{ display: "grid", gap: "0.5rem", justifyItems: "start" }}>
          <a className="status-pill" href="/login">
            Sign in with passkey
          </a>
          <a className="status-pill" href="/docs">
            Open backend docs
          </a>
        </div>
      </section>
    </main>
  );
}
