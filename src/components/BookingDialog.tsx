import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SHOOT_TYPES, submitBooking } from "@/lib/booking.functions";
import { cn } from "@/lib/utils";

/** Light glass booking form; the request lands in Telegram. */
export function BookingDialog({ onClose }: { onClose: () => void }) {
  const send = useServerFn(submitBooking);
  const [f, setF] = useState({ name: "", contact: "", type: "Portraits", date: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { html.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await send({ data: f });
      setState("sent");
    } catch (err) {
      toast.error((err as Error).message || "Could not send the request");
      setState("idle");
    }
  };

  const field = "w-full rounded-2xl border border-ink/12 bg-white/60 px-4 py-3 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-ink/35";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Booking request"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-white/5 p-3 backdrop-blur-2xl sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card max-h-[92svh] w-full max-w-md overflow-y-auto rounded-[32px] !bg-white/85 p-5 text-ink md:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="display text-3xl leading-none">Book a <em>session.</em></p>
          <button type="button" onClick={onClose} aria-label="Close" className="glass-ink hit grid size-9 shrink-0 place-items-center rounded-full text-ink/70 hover:text-ink">
            <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {state === "sent" ? (
          <div className="py-4">
            <p className="text-sm text-ink/75">Thank you — your request is on its way. I’ll get back to you shortly.</p>
            <button type="button" onClick={onClose} className="meta mt-6 rounded-full bg-ink px-5 py-2.5 text-paper">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input className={field} value={f.name} onChange={set("name")} placeholder="Your name" maxLength={80} required aria-label="Your name" autoComplete="name" />
            <input className={field} value={f.contact} onChange={set("contact")} placeholder="Phone, e-mail or Telegram" maxLength={120} required aria-label="How to reach you" />
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type of shoot">
              {SHOOT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={f.type === t}
                  onClick={() => setF({ ...f, type: t })}
                  className={cn("meta rounded-full px-3 py-1.5 text-[0.625rem]", f.type === t ? "bg-ink text-paper" : "glass-ink text-ink/80")}
                >
                  {t}
                </button>
              ))}
            </div>
            <input className={field} value={f.date} onChange={set("date")} placeholder="Preferred date (optional)" maxLength={40} aria-label="Preferred date" />
            <textarea className={cn(field, "min-h-28 resize-y")} value={f.message} onChange={set("message")} placeholder="A few words about the idea (optional)" maxLength={1500} aria-label="Message" />
            {/* Honeypot — hidden from people, tempting to bots. */}
            <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
            <button type="submit" disabled={state === "sending"} className="meta w-full rounded-full bg-ink px-5 py-3 text-paper transition-opacity hover:opacity-90 disabled:opacity-50">
              {state === "sending" ? "Sending…" : "Send request"}
            </button>
            <p className="text-center text-[0.6875rem] text-ink/45">
              Your details are used only to reply to you. <a href="/privacy" className="underline underline-offset-2">Privacy</a>
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
