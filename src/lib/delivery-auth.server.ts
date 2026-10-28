import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashDeliveryPassword } from "@/lib/delivery-hash";
import type { Brand } from "@/lib/brand";

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export type DeliveryRow = {
  id: string;
  title: string;
  client_name: string | null;
  message: string | null;
  is_active: boolean;
  password_hash: string | null;
  expires_at: string | null;
  watermark: boolean;
  /** Custom logo on downloads (null when not set up, or before its database update). */
  brand?: Brand | null;
};

export type Access =
  | { state: "missing" }
  | { state: "expired" }
  | { state: "locked"; wrong: boolean }
  | { state: "ok"; delivery: DeliveryRow };

/** Resolves a client link: unknown / switched off, expired, password needed, or open. */
export async function checkAccess(token: string, password?: string | null): Promise<Access> {
  if (!TOKEN_RE.test(token)) return { state: "missing" };
  const base = "id, title, client_name, message, is_active, password_hash, expires_at";
  let { data: d, error } = (await supabaseAdmin.from("client_deliveries").select(`${base}, watermark, brand` as never).eq("token", token).maybeSingle()) as unknown as { data: DeliveryRow | null; error: { message: string } | null };
  if (error) ({ data: d, error } = await supabaseAdmin.from("client_deliveries").select(`${base}, watermark`).eq("token", token).maybeSingle());
  if (error) {
    // Database update for the watermark not applied yet: carry on without it.
    const r = await supabaseAdmin.from("client_deliveries").select(base).eq("token", token).maybeSingle();
    d = r.data ? { ...r.data, watermark: false } : null;
    error = r.error;
  }
  if (error) {
    console.error("checkAccess", error);
    return { state: "missing" };
  }
  if (!d || !d.is_active) return { state: "missing" };
  if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return { state: "expired" };
  if (d.password_hash) {
    if (!password) return { state: "locked", wrong: false };
    const hash = await hashDeliveryPassword(d.id, password);
    if (hash !== d.password_hash) return { state: "locked", wrong: true };
  }
  return { state: "ok", delivery: d };
}

/** For client actions: the open delivery, or an error the page can show. */
export async function requireAccess(token: string, password?: string | null) {
  const a = await checkAccess(token, password);
  if (a.state === "ok") return a.delivery;
  if (a.state === "expired") throw new Error("This link has expired.");
  if (a.state === "locked") throw new Error("Please enter the password again.");
  throw new Error("This link is no longer active.");
}
