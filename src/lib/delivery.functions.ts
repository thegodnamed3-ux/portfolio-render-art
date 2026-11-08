import { createServerFn } from "@tanstack/react-start";

export const DELIVERY_BUCKET = "client-deliveries";

export type DeliveryFile = {
  id: string;
  name: string;
  size: number;
  w: number;
  h: number;
  /** Web-sized image for the grid and the viewer. */
  preview: string;
  /** Original file (served as an attachment with the original name); null while the watermark is on. */
  download: string | null;
  /** True when no baked watermarked preview exists yet — the page overlays one. */
  overlay: boolean;
  /** Proofing: the client's heart and note. */
  favorite: boolean;
  note: string | null;
};

export type Delivery = {
  title: string;
  clientName: string | null;
  message: string | null;
  totalSize: number;
  /** Watermark until paid: previews only, no downloads. */
  watermark: boolean;
  files: DeliveryFile[];
  /** Photo shown when the link is shared (Telegram, WhatsApp…): the one picked in the studio, else the first. */
  cover: string | null;
};

export type DeliveryResult =
  | { state: "missing" }
  | { state: "expired" }
  | { state: "locked"; wrong: boolean }
  | { state: "ok"; delivery: Delivery };

type AccessInput = { token: string; password?: string | null };
const access = (input: AccessInput) => ({
  token: String(input?.token ?? ""),
  password: input?.password ? String(input.password).slice(0, 200) : null,
});

/** Signed links live for a day; reloading the page always issues fresh ones. */
const TTL = 60 * 60 * 24;

/** Public client page: resolves a delivery by its secret link token (and password, if it has one). */
export const getDelivery = createServerFn({ method: "POST" })
  .inputValidator(access)
  .handler(async ({ data }): Promise<DeliveryResult> => {
    const { checkAccess } = await import("@/lib/delivery-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const a = await checkAccess(data.token, data.password);
    if (a.state !== "ok") return a;
    const d = a.delivery;

    const cols = "id, storage_path, preview_path, file_name, size, w, h, position, favorite, client_note";
    const query = (c: string) => supabaseAdmin.from("client_delivery_files").select(c).eq("delivery_id", d.id).order("position").order("file_name");
    let { data: rows, error: e2 } = (await query(`${cols}, preview_wm_path, branded_path`)) as { data: any[] | null; error: any };
    if (e2) ({ data: rows, error: e2 } = (await query(`${cols}, preview_wm_path`)) as { data: any[] | null; error: any });
    if (e2) ({ data: rows, error: e2 } = (await query(cols)) as { data: any[] | null; error: any });
    if (e2) {
      console.error("getDelivery files", e2);
      return { state: "missing" };
    }
    const files = rows ?? [];
    const bucket = supabaseAdmin.storage.from(DELIVERY_BUCKET);

    const wm = !!d.watermark;
    // With the watermark on, originals are never signed and previews are the watermarked copies.
    const previewOf = (f: (typeof files)[number]) => (wm && f.preview_wm_path) || f.preview_path || f.storage_path;
    // Custom logo on: the client downloads the copies with the logo (same file names).
    const branded = !!d.brand?.on;
    const skip = new Set(d.brand?.skip ?? []);
    const withLogo = (f: (typeof files)[number]) => branded && !!f.branded_path && !skip.has(f.id);
    const fileOf = (f: (typeof files)[number]) => (withLogo(f) && f.branded_path) || f.storage_path;
    const originals = wm ? [] : files.map(fileOf);
    // Custom logo on: previews with the logo (made by the studio together with the copies); the
    // plain preview is used for any photo whose logo preview isn't there.
    const logoPreview = (f: (typeof files)[number]) => (!wm && withLogo(f) ? `${f.branded_path.slice(0, f.branded_path.lastIndexOf("/"))}/__preview.jpg` : null);
    const previews = files.map(previewOf);
    const [dl, pv] = files.length
      ? await Promise.all([
          // Object names end with the original file name, so `download: true` keeps it.
          originals.length ? bucket.createSignedUrls(originals, TTL, { download: true }) : Promise.resolve({ data: [], error: null }),
          bucket.createSignedUrls(previews, TTL),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (dl.error || pv.error) {
      console.error("getDelivery signing", dl.error ?? pv.error);
      return { state: "missing" };
    }
    const dlBy = new Map((dl.data ?? []).map((s) => [s.path, s.signedUrl]));
    // Signed on their own: a missing logo preview must never break the page.
    const logoPaths = files.map(logoPreview).filter((p): p is string => !!p);
    const lpSigned = logoPaths.length ? await bucket.createSignedUrls(logoPaths, TTL).catch(() => null) : null;
    const lpBy = new Map((lpSigned?.data ?? []).filter((s) => s.signedUrl && !s.error).map((s) => [s.path, s.signedUrl]));
    const pvBy = new Map((pv.data ?? []).map((s) => [s.path, s.signedUrl]));

    const out: DeliveryFile[] = [];
    for (const f of files) {
      const download = wm ? null : (dlBy.get(fileOf(f)) ?? null);
      const lp = logoPreview(f);
      const preview = (lp && lpBy.get(lp)) || pvBy.get(previewOf(f)) || download;
      if (!preview || (!wm && !download)) continue;
      out.push({
        id: f.id, name: f.file_name, size: Number(f.size) || 0, w: f.w ?? 3, h: f.h ?? 2, preview, download,
        overlay: wm && !f.preview_wm_path,
        favorite: !!f.favorite, note: f.client_note,
      });
    }
    // Link-preview photo (column added later — ignored until its database update is applied).
    const coverRow = (await supabaseAdmin.from("client_deliveries").select("cover_file" as never).eq("id", d.id).maybeSingle()) as unknown as { data: { cover_file: string | null } | null };
    const coverFile = out.find((f) => f.id === coverRow.data?.cover_file) ?? out[0];
    return {
      state: "ok",
      delivery: {
        cover: coverFile?.preview ?? null,
        title: d.title,
        clientName: d.client_name,
        message: d.message,
        totalSize: out.reduce((n, f) => n + f.size, 0),
        watermark: wm,
        files: out,
      },
    };
  });

/** Proofing: the client hearts a photo and/or leaves a note on it. */
export const markDeliveryFile = createServerFn({ method: "POST" })
  .inputValidator((input: AccessInput & { fileId: string; favorite?: boolean; note?: string | null }) => ({
    ...access(input),
    fileId: String(input?.fileId ?? ""),
    favorite: typeof input?.favorite === "boolean" ? input.favorite : undefined,
    note: input?.note === undefined ? undefined : (String(input.note ?? "").trim().slice(0, 500) || null),
  }))
  .handler(async ({ data }) => {
    const { requireAccess } = await import("@/lib/delivery-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const d = await requireAccess(data.token, data.password);
    const patch: { favorite?: boolean; client_note?: string | null } = {};
    if (data.favorite !== undefined) patch.favorite = data.favorite;
    if (data.note !== undefined) patch.client_note = data.note;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin.from("client_delivery_files").update(patch).eq("id", data.fileId).eq("delivery_id", d.id);
    if (error) {
      console.error("markDeliveryFile", error);
      throw new Error("Could not save — please try again.");
    }
    return { ok: true };
  });

/** Stats: page opened, one photo downloaded, or the whole ZIP. Never fails the page. */
export const logDeliveryEvent = createServerFn({ method: "POST" })
  .inputValidator((input: AccessInput & { kind: "view" | "download" | "zip"; fileId?: string | null }) => ({
    ...access(input),
    kind: (["view", "download", "zip"] as const).includes(input?.kind) ? input.kind : "view",
    fileId: input?.fileId ? String(input.fileId) : null,
  }))
  .handler(async ({ data }) => {
    try {
      const { checkAccess } = await import("@/lib/delivery-auth.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const a = await checkAccess(data.token, data.password);
      if (a.state !== "ok") return { ok: false };
      const d = a.delivery;
      // First time the client opens the gallery, and every ZIP download, ping the studio.
      let first = false;
      if (data.kind === "view") {
        const { count } = await supabaseAdmin.from("client_delivery_events").select("id", { count: "exact", head: true }).eq("delivery_id", d.id).eq("kind", "view");
        first = (count ?? 0) === 0;
      }
      await supabaseAdmin.from("client_delivery_events").insert({ delivery_id: d.id, kind: data.kind, file_id: data.fileId });
      if (first || data.kind === "zip") {
        const { sendTelegram, esc, siteOrigin } = await import("@/lib/telegram.server");
        const who = esc(d.client_name || d.title);
        const html = first
          ? `<b>Gallery opened</b>\n\n<b>${who}</b>${d.client_name ? `\n${esc(d.title)}` : ""}\nThe client just opened the link for the first time.`
          : `<b>Archive downloaded</b>\n\n<b>${who}</b>${d.client_name ? `\n${esc(d.title)}` : ""}\nAll photos were downloaded as a ZIP.`;
        const origin = await siteOrigin();
        await sendTelegram(html, origin ? [{ text: "Open in studio", url: `${origin}/admin` }] : []);
      }
    } catch (e) {
      console.error("logDeliveryEvent", e);
    }
    return { ok: true };
  });

/** Proofing done: the client sends their hearted photos (and notes) to the studio's Telegram. */
export const submitPicks = createServerFn({ method: "POST" })
  .inputValidator(access)
  .handler(async ({ data }) => {
    const { requireAccess } = await import("@/lib/delivery-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const d = await requireAccess(data.token, data.password);
    const { data: rows, error } = await supabaseAdmin
      .from("client_delivery_files")
      .select("file_name, favorite, client_note, position")
      .eq("delivery_id", d.id)
      .order("position")
      .order("file_name");
    if (error) throw new Error("Could not send — please try again.");
    const picks = (rows ?? []).filter((f) => f.favorite);
    const notes = (rows ?? []).filter((f) => f.client_note);
    if (!picks.length && !notes.length) throw new Error("Tap the heart on the photos you like first.");

    await supabaseAdmin.from("client_delivery_events").insert({ delivery_id: d.id, kind: "picks" });

    const { sendTelegram, esc, siteOrigin } = await import("@/lib/telegram.server");
    const list = picks.slice(0, 80).map((f) => esc(f.file_name)).join("\n") + (picks.length > 80 ? `\n… and ${picks.length - 80} more` : "");
    const noteLines = notes.slice(0, 30).map((f) => `<i>${esc(f.file_name)}</i> — ${esc(f.client_note ?? "")}`).join("\n");
    const html = [
      "<b>Selection ready</b>",
      "",
      `<b>${esc(d.client_name || d.title)}</b>`,
      d.client_name ? esc(d.title) : null,
      `${picks.length} ${picks.length === 1 ? "photo" : "photos"} selected`,
      picks.length ? `\n<blockquote expandable>${list}</blockquote>` : null,
      notes.length ? `\n<b>Notes</b>\n${noteLines}` : null,
    ].filter((l) => l !== null).join("\n");
    const origin = await siteOrigin();
    await sendTelegram(html, origin ? [{ text: "Open in studio", url: `${origin}/admin` }] : []);
    return { count: picks.length };
  });

/* ---------------- Client page: every gallery of one client (by their e-mail) ---------------- */

export type PortalItem = { title: string; token: string; date: string; count: number; cover: string | null; locked: boolean; expires: string | null };
export type PortalResult = { state: "missing" } | { state: "ok"; name: string | null; items: PortalItem[] };

/** One link for a regular client (an agent, a brand): all their active galleries, newest first. */
export const getPortal = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "").slice(0, 64) }))
  .handler(async ({ data }): Promise<PortalResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const p = await sb.from("client_portals").select("email, name").eq("token", data.token).maybeSingle();
    if (p.error || !p.data?.email) return { state: "missing" };
    const ds = await sb.from("client_deliveries").select("id, token, title, client_name, created_at, expires_at, password_hash").ilike("client_email", p.data.email).eq("is_active", true).order("created_at", { ascending: false });
    const now = Date.now();
    const list = ((ds.data ?? []) as { id: string; token: string; title: string; client_name: string | null; created_at: string; expires_at: string | null; password_hash: string | null }[])
      .filter((d) => !d.expires_at || new Date(d.expires_at).getTime() > now);
    const ids = list.map((d) => d.id);
    const files = ids.length
      ? (((await sb.from("client_delivery_files").select("delivery_id, preview_path, storage_path, position").in("delivery_id", ids).order("position")).data ?? []) as { delivery_id: string; preview_path: string | null; storage_path: string }[])
      : [];
    const first = new Map<string, string>();
    const count = new Map<string, number>();
    files.forEach((f) => { count.set(f.delivery_id, (count.get(f.delivery_id) ?? 0) + 1); if (!first.has(f.delivery_id)) first.set(f.delivery_id, f.preview_path ?? f.storage_path); });
    // Covers only for galleries without a password (a locked gallery stays locked here too).
    const coverPaths = list.filter((d) => !d.password_hash && first.has(d.id)).map((d) => first.get(d.id)!);
    const signed = coverPaths.length ? await supabaseAdmin.storage.from(DELIVERY_BUCKET).createSignedUrls(coverPaths, TTL) : null;
    const urlBy = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));
    return {
      state: "ok",
      name: p.data.name || list[0]?.client_name || null,
      items: list.map((d) => ({
        title: d.title,
        token: d.token,
        date: d.created_at,
        count: count.get(d.id) ?? 0,
        cover: d.password_hash ? null : (urlBy.get(first.get(d.id) ?? "") ?? null),
        locked: !!d.password_hash,
        expires: d.expires_at,
      })),
    };
  });
