import { env } from "./env";

const highlights = [
  "SQLite-backed backend foundation with committed migrations and deterministic seed data.",
  "Admin bearer token guard and OpenAPI endpoints ready for coach tooling.",
  "Next.js App Router frontend kept same-origin friendly for a clean PWA path.",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Phase 2 Backend Core</p>
        <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
        <p className="lede">
          A lightweight fitness tracker scaffold with the database, backend
          docs, and auth foundation ready for the next domain APIs.
        </p>
      </section>

      <section className="card-grid" aria-label="Bootstrap highlights">
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
        <a className="status-pill" href="/docs">
          Open backend docs
        </a>
      </section>
    </main>
  );
}
