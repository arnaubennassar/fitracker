import { env } from "./env";

const highlights = [
  "Monorepo wiring with shared TypeScript and Biome config.",
  "Fastify backend scaffold ready for API routes and infrastructure.",
  "Next.js App Router frontend with a mobile-first landing shell.",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Phase 1 Bootstrap</p>
        <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
        <p className="lede">
          A lightweight fitness tracker scaffold focused on clean delivery
          foundations before domain logic lands.
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
          <p className="section-label">API baseline</p>
          <h2>Backend target</h2>
          <p>{env.NEXT_PUBLIC_API_BASE_URL}</p>
        </div>
        <div className="status-pill">Ready for Phase 2</div>
      </section>
    </main>
  );
}
