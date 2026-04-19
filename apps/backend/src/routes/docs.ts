import type { AppEnv } from "../env.js";

export function buildDocsHtml(env: AppEnv) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${env.APP_NAME} API docs</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f4ee;
        --surface: rgba(255, 255, 255, 0.88);
        --text: #17212b;
        --muted: #54616c;
        --accent: #0f6b57;
        --accent-soft: #dff4ec;
        --border: rgba(23, 33, 43, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top, rgba(223, 244, 236, 0.95), transparent 34%),
          linear-gradient(180deg, #fffaf3 0%, var(--bg) 60%, #eee3d0 100%);
        color: var(--text);
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      }
      main { max-width: 72rem; margin: 0 auto; padding: 1.25rem; display: grid; gap: 1rem; }
      .panel {
        border: 1px solid var(--border);
        border-radius: 1.5rem;
        background: var(--surface);
        backdrop-filter: blur(10px);
        box-shadow: 0 20px 50px rgba(15, 34, 28, 0.1);
        padding: 1.25rem;
      }
      h1, h3, p { margin: 0; }
      h1 {
        font-family: "Avenir Next", "Century Gothic", sans-serif;
        font-size: clamp(2.4rem, 8vw, 4.8rem);
        letter-spacing: -0.05em;
      }
      .eyebrow {
        margin-bottom: 0.75rem;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.8rem;
        font-family: "Avenir Next", "Century Gothic", sans-serif;
        font-weight: 600;
      }
      .lede, .meta, .endpoint-copy, .notice { color: var(--muted); line-height: 1.6; }
      .meta-grid, .endpoint-grid { display: grid; gap: 0.9rem; }
      .meta-grid { grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
      .meta-card, .endpoint {
        border: 1px solid var(--border);
        border-radius: 1.2rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.72);
      }
      .method {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 4rem;
        padding: 0.45rem 0.7rem;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-family: "Avenir Next", "Century Gothic", sans-serif;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      code { font-family: "SFMono-Regular", "Consolas", monospace; font-size: 0.92rem; }
      .endpoint-head { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; }
      .endpoint-copy { margin-top: 0.55rem; }
      .status {
        display: inline-flex;
        margin-top: 0.7rem;
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        background: rgba(15, 107, 87, 0.08);
        color: var(--accent);
        font-family: "Avenir Next", "Century Gothic", sans-serif;
        font-size: 0.8rem;
        font-weight: 600;
      }
      a { color: var(--accent); }
      @media (min-width: 700px) {
        main { padding: 2rem; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <p class="eyebrow">Backend docs</p>
        <h1>${env.APP_NAME}</h1>
        <p class="lede">
          OpenAPI-backed backend foundation for the coach/admin API. The raw contract is available at
          <a href="/openapi.json"><code>/openapi.json</code></a>.
        </p>
      </section>

      <section class="panel">
        <div class="meta-grid">
          <article class="meta-card">
            <p class="eyebrow">Health</p>
            <p class="meta"><code>GET /health</code></p>
          </article>
          <article class="meta-card">
            <p class="eyebrow">Versioned API base</p>
            <p class="meta"><code>${env.API_BASE_PATH}</code></p>
          </article>
          <article class="meta-card">
            <p class="eyebrow">Seed admin token</p>
            <p class="meta">Read <code>ADMIN_SEED_TOKEN</code> from the backend env.</p>
          </article>
        </div>
      </section>

      <section class="panel">
        <p class="eyebrow">Operations</p>
        <div class="endpoint-grid" id="endpoint-grid"></div>
        <p class="notice" id="loading">Loading OpenAPI document…</p>
      </section>
    </main>

    <script>
      const endpointGrid = document.getElementById("endpoint-grid");
      const loading = document.getElementById("loading");

      function renderEndpoint(method, path, operation) {
        const article = document.createElement("article");
        article.className = "endpoint";

        const responses = Object.keys(operation.responses || {}).join(", ");
        const tag = (operation.tags && operation.tags[0]) || "system";

        article.innerHTML = [
          '<div class="endpoint-head">',
          '<span class="method">' + method.toUpperCase() + "</span>",
          "<code>" + path + "</code>",
          "</div>",
          "<h3>" + (operation.summary || operation.operationId || "Untitled operation") + "</h3>",
          '<p class="endpoint-copy">Tag: ' + tag + "</p>",
          '<p class="endpoint-copy">Responses: ' + responses + "</p>",
          operation.security ? '<span class="status">Bearer auth required</span>' : "",
        ].join("");

        endpointGrid.appendChild(article);
      }

      fetch("/openapi.json")
        .then((response) => response.json())
        .then((document) => {
          loading.remove();

          const entries = Object.entries(document.paths || {});

          if (entries.length === 0) {
            const empty = document.createElement("p");
            empty.className = "notice";
            empty.textContent = "No documented endpoints available.";
            endpointGrid.appendChild(empty);
            return;
          }

          for (const [path, pathItem] of entries) {
            for (const [method, operation] of Object.entries(pathItem)) {
              renderEndpoint(method, path, operation);
            }
          }
        })
        .catch((error) => {
          loading.textContent = "Failed to load OpenAPI document: " + error.message;
        });
    </script>
  </body>
</html>`;
}
