import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSiteSettings } from "@/lib/portfolio.functions";
import { contact } from "@/content/contact";
import { cn } from "@/lib/utils";

export const TelegramIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn(className, "fill-current")}><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3z" /></svg>
);
export const WhatsAppIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn(className, "fill-current")}><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z" /></svg>
);
export const InstagramIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn(className, "fill-none stroke-current")} strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" className="fill-current" /></svg>
);
export const BehanceIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn(className, "fill-current")}><path d="M8.2 11.3c.9-.4 1.4-1.1 1.4-2.1 0-2-1.5-2.7-3.4-2.7H1v11h5.4c2 0 3.9-1 3.9-3.2 0-1.4-.7-2.5-2.1-3zM3.4 8.4h2.3c.9 0 1.6.2 1.6 1.2s-.6 1.2-1.4 1.2H3.4zm2.5 7.2H3.4v-3h2.6c1 0 1.7.4 1.7 1.5s-.8 1.5-1.8 1.5zM15 7h5.4v1.3H15zm2.8 2.4c-2.6 0-4.3 1.9-4.3 4.4 0 2.6 1.6 4.4 4.3 4.4 2 0 3.3-.9 4-2.9h-2c-.2.7-1.1 1.1-1.9 1.1-1.3 0-2-.8-2-2h6c.2-2.6-1.2-5-4.1-5zm-1.9 3.6c.1-1 .8-1.7 1.9-1.7s1.6.6 1.7 1.7z" /></svg>
);

type Props = { tone?: "light" | "dark" | "glass"; className?: string; align?: "start" | "end"; iconsClassName?: string };

/** Compact Liquid Glass pills (Telegram / WhatsApp) + small icon buttons. */
export function ContactLinks({ tone = "light", className, align = "start", iconsClassName }: Props) {
  const glass = tone !== "light";
  const fetchSettings = useServerFn(getSiteSettings);
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: () => fetchSettings(), staleTime: 300_000 });
  const whatsapp = data?.whatsapp ?? contact.whatsapp;
  const surface = glass ? "glass text-paper" : "glass-ink text-ink";
  const primary = cn("hit group inline-flex items-center gap-2.5 rounded-full px-3.5 py-2", surface);
  const icon = cn("hit inline-flex size-8 items-center justify-center rounded-full", surface);
  const messaging = [
    contact.telegram && { href: contact.telegram, label: "Telegram", Icon: TelegramIcon },
    whatsapp && { href: whatsapp, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter(Boolean) as { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element }[];

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", align === "end" && "justify-end", className)}>
      {messaging.map(({ href, label, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={primary}>
          <Icon />
          <span className="meta text-[0.625rem]">{label}</span>
          <span aria-hidden className="text-xs transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </a>
      ))}
      {(contact.instagram || contact.behance) && (
        <div className={cn("flex w-full items-center gap-2.5 md:w-auto", align === "end" && "justify-end", iconsClassName)}>
          {contact.instagram && (
            <a href={contact.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={icon}><InstagramIcon /></a>
          )}
          {contact.behance && (
            <a href={contact.behance} target="_blank" rel="noopener noreferrer" aria-label="Behance" className={icon}><BehanceIcon /></a>
          )}
        </div>
      )}
    </div>
  );
}
