export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Something went wrong — thegodnamed</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500&display=swap" />
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; min-height: 100svh; background: #1b1b1b; color: #f1efea; font: 15px/1.55 Manrope, system-ui, sans-serif; display: flex; flex-direction: column; }
      header { padding: 1.5rem 1.25rem; }
      .mark { font: 800 1.15rem Archivo, Arial, sans-serif; letter-spacing: -0.03em; color: inherit; text-decoration: none; }
      main { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 1.25rem 3rem; max-width: 60rem; }
      .meta { font-size: 0.6875rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(241,239,234,.55); }
      h1 { font: 400 clamp(3rem, 11vw, 7rem)/0.95 "Instrument Serif", Georgia, serif; margin: 1.25rem 0 1.5rem; }
      h1 em { font-style: italic; }
      p { color: rgba(241,239,234,.7); max-width: 28rem; margin: 0 0 2rem; }
      .actions { display: flex; gap: .6rem; flex-wrap: wrap; }
      a.btn, button { font: 500 .6875rem Manrope, sans-serif; letter-spacing: .2em; text-transform: uppercase; padding: .9rem 1.4rem; border-radius: 999px; cursor: pointer; text-decoration: none; }
      .primary { background: #f1efea; color: #1b1b1b; border: 0; }
      .secondary { background: rgba(241,239,234,.08); color: #f1efea; border: 1px solid rgba(241,239,234,.18); }
      @media (min-width: 768px) { header { padding: 2rem 2.5rem; } main { padding: 0 2.5rem 4rem; } }
    </style>
  </head>
  <body>
    <header><a class="mark" href="/">thegodnamed</a></header>
    <main>
      <span class="meta">Error</span>
      <h1>Something went <em>sideways.</em></h1>
      <p>The page didn’t load this time. Try again in a moment — or head back to the start.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="btn secondary" href="/">Home</a>
      </div>
    </main>
  </body>
</html>`;
}
