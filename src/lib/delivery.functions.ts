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
  /** Original file; the response is served as an attachment with the original name. */
  download: string;
};

export type Delivery = {
  title: string;
  clientName: string | null;
  message: string | null;
  totalSize: number;
  files: DeliveryFile[];
};

/** Signed links live for a day; reloading the page always issues fresh ones. */
const TTL = 60 * 60 * 24;

/** Public client page: resolves a delivery by its secret link token. Returns null if unknown or switched off. */
export const getDelivery = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => {
    const token = String(input?.token ?? "");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { token: "" };
    return { token };
  })
  .handler(async ({ data }): Promise<Delivery | null> => {
    if (!data.token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: d, error } = await supabaseAdmin
      .from("client_deliveries")
      .select("id, title, client_name, message, is_active")
      .eq("token", data.token)
      .maybeSingle();
    if (error) {
      console.error("getDelivery", error);
      return null;
    }
    if (!d || !d.is_active) return null;

    const { data: rows, error: e2 } = await supabaseAdmin
      .from("client_delivery_files")
      .select("id, storage_path, preview_path, file_name, size, w, h, position")
      .eq("delivery_id", d.id)
      .order("position")
      .order("file_name");
    if (e2) {
      console.error("getDelivery files", e2);
      return null;
    }
    const files = rows ?? [];
    const bucket = supabaseAdmin.storage.from(DELIVERY_BUCKET);

    const originals = files.map((f) => f.storage_path);
    const previews = files.map((f) => f.preview_path ?? f.storage_path);
    const [dl, pv] = files.length
      ? await Promise.all([
          // Object names end with the original file name, so `download: true` keeps it.
          bucket.createSignedUrls(originals, TTL, { download: true }),
          bucket.createSignedUrls(previews, TTL),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (dl.error || pv.error) {
      console.error("getDelivery signing", dl.error ?? pv.error);
      return null;
    }
    const dlBy = new Map((dl.data ?? []).map((s) => [s.path, s.signedUrl]));
    const pvBy = new Map((pv.data ?? []).map((s) => [s.path, s.signedUrl]));

    const out: DeliveryFile[] = [];
    for (const f of files) {
      const download = dlBy.get(f.storage_path);
      const preview = pvBy.get(f.preview_path ?? f.storage_path) ?? download;
      if (!download || !preview) continue;
      out.push({ id: f.id, name: f.file_name, size: Number(f.size) || 0, w: f.w ?? 3, h: f.h ?? 2, preview, download });
    }
    return {
      title: d.title,
      clientName: d.client_name,
      message: d.message,
      totalSize: out.reduce((n, f) => n + f.size, 0),
      files: out,
    };
  });
