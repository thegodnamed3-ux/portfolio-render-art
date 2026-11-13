import { contact } from "./contact";

export function instagramHandle(href: string): string {
  try {
    const handle = new URL(href).pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : "";
  } catch { return ""; }
}

/** Shared site contacts; null settings use the same fallback as ContactList. */
export function bioContacts(settings: { whatsapp: string | null }, channels = contact) {
  return [
    { title: "Telegram", href: channels.telegram, description: "links.telegram" as const },
    { title: "WhatsApp", href: settings.whatsapp ?? channels.whatsapp, description: "links.whatsapp" as const },
    { title: "Instagram", href: channels.instagram, description: null },
  ].filter((row): row is typeof row & { href: string } => typeof row.href === "string" && row.href.trim().length > 0);
}

export const bioRealEstate = "https://www.horastudios.ee";