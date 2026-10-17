import { createServerFn } from "@tanstack/react-start";

export type PublicReview = { id: string; name: string; body: string; rating: number | null };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
/** A single delivery link can't be used to flood the studio with reviews. */
const MAX_PER_DELIVERY = 5;

/** Client page: leave a review. Only works through an active delivery link; lands as "pending". */
export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; name: string; body: string; rating: number | null }) => {
    const token = String(input?.token ?? "");
    const name = String(input?.name ?? "").trim().slice(0, 60);
    const body = String(input?.body ?? "").trim().slice(0, 1000);
    const r = Number(input?.rating);
    const rating = Number.isInteger(r) && r >= 1 && r <= 5 ? r : null;
    if (!TOKEN.test(token)) throw new Error("This link is not valid.");
    if (!name) throw new Error("Please add your name.");
    if (body.length < 3) throw new Error("Please write a few words.");
    return { token, name, body, rating };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin
      .from("client_deliveries")
      .select("id, is_active")
      .eq("token", data.token)
      .maybeSingle();
    if (!d || !d.is_active) throw new Error("This link is no longer active.");

    const { count } = await supabaseAdmin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("delivery_id", d.id);
    if ((count ?? 0) >= MAX_PER_DELIVERY) throw new Error("Thank you — we already have your review.");

    const { error } = await supabaseAdmin
      .from("reviews")
      .insert({ delivery_id: d.id, name: data.name, body: data.body, rating: data.rating, status: "pending" });
    if (error) {
      console.error("submitReview", error);
      throw new Error("Could not send the review. Please try again.");
    }
    return { ok: true };
  });

/** Website: approved reviews only, newest first. */
export const getApprovedReviews = createServerFn({ method: "GET" }).handler(async (): Promise<PublicReview[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, name, body, rating")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(48);
  if (error) {
    console.error("getApprovedReviews", error);
    return [];
  }
  return data ?? [];
});
