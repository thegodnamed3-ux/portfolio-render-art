import { describe, expect, it } from "vitest";
import { bioContacts, bioRealEstate, instagramHandle } from "@/content/bio-links";

const channels = { telegram: "https://t.me/thehorus", whatsapp: "https://wa.me/37258000729", instagram: "https://instagram.com/thegodnamed", behance: "https://www.behance.net/gorarsakjan2" };

describe("Bio contact destinations", () => {
  it("reads Telegram and Instagram from the shared contact source", () => {
    const changed = { ...channels, telegram: "https://t.me/new_contact", instagram: "https://instagram.com/new_contact" };
    expect(bioContacts({ whatsapp: null }, changed).map((row) => row.href)).toEqual([changed.telegram, channels.whatsapp, changed.instagram]);
  });
  it("uses the studio WhatsApp setting first", () => {
    expect(bioContacts({ whatsapp: "https://wa.me/123" }, channels)[1]?.href).toBe("https://wa.me/123");
  });
  it("falls back to the shared WhatsApp contact", () => {
    expect(bioContacts({ whatsapp: null }, channels)[1]?.href).toBe("https://wa.me/37258000729");
  });
  it("skips empty and null channels", () => {
    expect(bioContacts({ whatsapp: "" }, { ...channels, telegram: null, instagram: " " })).toEqual([]);
  });
  it("never includes Behance", () => {
    expect(bioContacts({ whatsapp: null }, channels).some((row) => row.href === channels.behance)).toBe(false);
  });
  it("extracts the handle from the Instagram URL", () => {
    expect(instagramHandle("https://instagram.com/thegodnamed/?igsh=abc")).toBe("@thegodnamed");
  });
  it("opens real estate at the requested HŌRA website", () => {
    expect(bioRealEstate).toBe("https://www.horastudios.ee");
  });
});