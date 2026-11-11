/**
 * Page change as a "press and slide": the page you leave sinks back a little, the next one slides
 * in from the right over it (CSS: `html.slide-in::view-transition-*` in styles.css). Works with
 * the router's View Transitions; browsers without them change the page as before.
 */
type R = { options: { defaultViewTransition?: unknown } };
const routerOf = () => (window as Window & { __tgnRouter?: R }).__tgnRouter;
let slideTimer = 0;

export function slideIn() {
  const root = document.documentElement;
  root.classList.add('slide-in');
  // Only this page change runs as a View Transition; Back/Forward and swipes stay instant.
  const router = routerOf();
  if (router) router.options.defaultViewTransition = true;
  window.clearTimeout(slideTimer);
  slideTimer = window.setTimeout(() => {
    root.classList.remove("slide-in");
    if (router) router.options.defaultViewTransition = false;
  }, 1400);
}

if (typeof window !== 'undefined') window.addEventListener('popstate', () => {
  document.documentElement.classList.remove('slide-in');
  const router = routerOf();
  if (router) router.options.defaultViewTransition = false;
});

/** Every link to another page of the public site slides; skips admin, client galleries, new tabs, external and same-page links. */
export function installSlideLinks() {
  if (typeof document === 'undefined') return;
  const w = window as Window & { __slideLinks?: boolean };
  if (w.__slideLinks) return;
  w.__slideLinks = true;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    if (/^\/(admin|g\/|auth)/.test(location.pathname) || /^\/(admin|g\/)/.test(url.pathname)) return;
    slideIn();
  }, true);
}
