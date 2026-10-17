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
    let { data: rows, error: e2 } = (await query(`${cols}, preview_wm_path`)) as { data: any[] | null; error: any };
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
    const originals = wm ? [] : files.map((f) => f.storage_path);
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
    const pvBy = new Map((pv.data ?? []).map((s) => [s.path, s.signedUrl]));

    const out: DeliveryFile[] = [];
    for (const f of files) {
      const download = wm ? null : (dlBy.get(f.storage_path) ?? null);
      const preview = pvBy.get(previewOf(f)) ?? download;
      if (!preview || (!wm && !download)) continue;
      out.push({
        id: f.id, name: f.file_name, size: Number(f.size) || 0, w: f.w ?? 3, h: f.h ?? 2, preview, download,
        overlay: wm && !f.preview_wm_path,
        favorite: !!f.favorite, note: f.client_note,
      });
    }
    return {
      state: "ok",
      delivery: {
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
      await supabaseAdmin.from("client_delivery_events").insert({ delivery_id: a.delivery.id, kind: data.kind, file_id: data.fileId });
    } catch (e) {
      console.error("logDeliveryEvent", e);
    }
    return { ok: true };
  });
