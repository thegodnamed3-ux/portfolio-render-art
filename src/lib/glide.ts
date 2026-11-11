/**
 * Calm in-page scrolling for menu links: one eased glide (slow start, slow finish) whose length
 * grows with the distance, instead of the browser's quick jump. Any wheel/touch/key by the visitor
 * stops it. Returns false when the target isn't on this page (the caller then navigates normally).
 */
let stop: (() => void) | null = null;

export function glideTo(hash: string): boolean {
  const el = hash === "top" ? document.body : document.getElementById(hash);
  if (!el) return false;
  stop?.();
  const html = document.documentElement;
  const pad = parseFloat(getComputedStyle(html).scrollPaddingTop) || 0;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const max = html.scrollHeight - window.innerHeight;
  const to = hash === "top" ? 0 : Math.min(max, Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad - margin));
  const from = window.scrollY;
  const dist = to - from;
  if (Math.abs(dist) < 2) return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, to); return true; }

  const duration = Math.min(1300, Math.max(600, Math.abs(dist) * 0.45));
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  let raf = 0;
  const t0 = performance.now();
  const end = () => {
    cancelAnimationFrame(raf);
    html.style.scrollBehavior = prev;
    ["wheel", "touchstart", "keydown"].forEach((ev) => window.removeEventListener(ev, end));
    stop = null;
  };
  ["wheel", "touchstart", "keydown"].forEach((ev) => window.addEventListener(ev, end, { passive: true }));
  stop = end;
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, from + dist * ease(t));
    if (t < 1) raf = requestAnimationFrame(tick);
    else end();
  };
  raf = requestAnimationFrame(tick);
  return true;
}

/** Menu link click on the homepage: close the menu first, then glide once the page can scroll again. */
export function glideAfterClose(e: { preventDefault: () => void }, hash: string, close: () => void) {
  if (window.location.pathname !== "/" || !(hash === "top" || document.getElementById(hash))) { close(); return; }
  e.preventDefault();
  close();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    glideTo(hash);
    try { history.replaceState(history.state, "", hash === "top" ? "/" : `/#${hash}`); } catch { /* ignore */ }
  }));
}
