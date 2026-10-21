import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSiteSettings } from "@/lib/portfolio.functions";
import { contact } from "@/content/contact";
import { TelegramIcon, WhatsAppIcon, InstagramIcon, BehanceIcon } from "@/components/ContactLinks";

/** Pages where the rail stays out of the way: the studio, sign-in and private client galleries. */
const HIDDEN = /^\/(admin|auth|g\/)/;

/**
 * Liquid-glass rail fixed to the right edge on every public page: Telegram, WhatsApp, Instagram,
 * Behance. Visible on the first and last screens, fading out in between; each icon sinks in when pressed.
 */
export function SocialRail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fetchSettings = useServerFn(getSiteSettings);
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: () => fetchSettings(), staleTime: 300_000 });
  // Shown on the first screen and on the last one (contacts); in between it fades out,
  // and fades back in when the visitor reaches either end.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const vh = window.innerHeight;
      const top = window.scrollY < vh * 0.55;
      const bottom = document.documentElement.scrollHeight - (window.scrollY + vh) < vh * 0.6;
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
    <nav aria-label="Social" className="social-rail" data-shown={shown ? "" : undefined} aria-hidden={!shown}>
      {links.map(({ href, label, Icon }, i) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} tabIndex={shown ? 0 : -1} style={{ animationDelay: `${0.7 + i * 0.07}s` }}>
          <Icon className="size-[17px]" />
        </a>
      ))}
    </nav>
  );
}
