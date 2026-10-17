/**
 * Password hash for a client delivery: SHA-256 of "<delivery id>:<password>", hex.
 * The delivery id acts as the salt. Works in the browser (studio sets it) and on the
 * server (link checks it) through Web Crypto.
 */
export async function hashDeliveryPassword(deliveryId: string, password: string) {
  const bytes = new TextEncoder().encode(`${deliveryId}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
