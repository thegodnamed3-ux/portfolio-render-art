import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getSiteSettings } from "@/lib/portfolio.functions";
import { contact } from "@/content/contact";
import { TelegramIcon, WhatsAppIcon, InstagramIcon, BehanceIcon } from "@/components/ContactLinks";

/** Pages where the rail stays out of the way: the studio, sign-in and private client galleries. */
const HIDDEN = /^\/(admin|auth|g\/)/;

/**
 * Liquid-glass rail fixed to the right edge on every public page: Telegram, WhatsApp, Instagram,
 * Behance. Visible on the first and last screens, wiping away top-down in between; each icon sinks in when pressed.
 */
export function SocialRail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fetchSettings = useServerFn(getSiteSettings);
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: () => fetchSettings(), staleTime: 300_000 });
  // Shown on the first screen and on the last one (contacts). Leaving either end it wipes away from
  // the top down; arriving it draws in from the top down. "pre" = hidden, ready to draw in again.
  const [shown, setShown] = useState(false);
  const [state, setState] = useState<"pre" | "in" | "out">("pre");
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    let t = 0, f1 = 0, f2 = 0;
    if (shown) {
      if (stateRef.current === "out") {
        setState("pre");
        f1 = requestAnimationFrame(() => { f2 = requestAnimationFrame(() => setState("in")); });
      } else setState("in");
    } else if (stateRef.current === "in") {
      setState("out");
      t = window.setTimeout(() => setState("pre"), 800);
    }
    return () => { clearTimeout(t); cancelAnimationFrame(f1); cancelAnimationFrame(f2); };
  }, [shown]);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const vh = window.innerHeight;
      const top = window.scrollY < vh * 0.12;
      const bottom = document.documentElement.scrollHeight - (window.scrollY + vh) < vh * 0.35;
      setShown(top || bottom);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    const start = window.setTimeout(check, 450);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.clearTimeout(start); cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [path]);
  if (HIDDEN.test(path)) return null;
  const links = [
    { href: contact.telegram, label: "Telegram", Icon: TelegramIcon },
    { href: data?.whatsapp ?? contact.whatsapp, label: "WhatsApp", Icon: WhatsAppIcon },
    { href: contact.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: contact.behance, label: "Behance", Icon: BehanceIcon },
  ].filter((l): l is typeof l & { href: string } => !!l.href);
  if (!links.length) return null;
  return (
    <nav aria-label="Social" className="social-rail" data-state={state} aria-hidden={!shown}>
      {links.map(({ href, label, Icon }, i) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} tabIndex={shown ? 0 : -1} style={{ "--i": i } as CSSProperties}>
          <Icon className="size-[17px]" />
        </a>
      ))}
    </nav>
  );
}
