import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const links = [
  { hash: "work", label: "Work" },
  { hash: "disciplines", label: "Explore" },
  { hash: "about", label: "About" },
  { hash: "contact", label: "Contact" },
];

export function SiteNav() {
  const [overLight, setOverLight] = useState(false);
  const [menu, setMenu] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const update = () => {
      const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-light]"));
      setOverLight(bands.some((el) => { const r = el.getBoundingClientRect(); return r.top < 112 && r.bottom > 0; }));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [menu]);

  const light = overLight && !menu;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 md:h-80">
        <div className={`absolute inset-0 bg-gradient-to-b from-background via-background via-40% to-transparent transition-opacity duration-500 md:via-30% ${light ? "opacity-0" : "opacity-100"}`} />
        <div className={`absolute inset-0 bg-gradient-to-b from-paper via-paper via-40% to-transparent transition-opacity duration-500 md:via-30% ${light ? "opacity-100" : "opacity-0"}`} />
      </div>
      <nav className={`meta relative px-5 py-4 transition-colors duration-500 md:px-10 md:py-6 ${light ? "text-ink" : "text-paper"}`}>
        <div className="flex items-baseline justify-between gap-4">
          <Link to="/" hash="top" onClick={() => setMenu(false)} className="wordmark whitespace-nowrap transition-opacity hover:opacity-60">
            thegodnamed
          </Link>
          <div className="hidden gap-8 text-[0.6875rem] md:flex">
            {links.map((l) => (
              <Link key={l.hash} to="/" hash={l.hash} className="transition-opacity hover:opacity-60">{l.label}</Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            className="-my-2 py-2 text-[0.6875rem] md:hidden"
          >
            {menu ? "Close" : "Menu"}
          </button>
        </div>
        <p className={`mt-1.5 whitespace-nowrap text-[0.5rem] tracking-[0.3em] transition-colors duration-500 md:text-[0.5625rem] ${light ? "text-ink/75" : "text-paper/85"}`}>
          PHOTOGRAPHY · FILM
        </p>
      </nav>

      <div
        id="mobile-menu"
        className={`fixed inset-0 -z-10 flex flex-col justify-end bg-background px-5 pb-10 transition-opacity duration-300 md:hidden ${menu ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ul className="border-t border-border">
          {links.map((l, i) => (
            <li key={l.hash} className="border-b border-border">
              <Link to="/" hash={l.hash} onClick={() => setMenu(false)} className="flex items-baseline justify-between py-5 text-paper" tabIndex={menu ? 0 : -1}>
                <span className="display text-5xl">{l.label}</span>
                <span className="meta text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
