import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getHomeMedia } from "@/lib/portfolio.functions";
import { defaultHero } from "@/content/home";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — thegodnamed" },
      { name: "description", content: "Private sign-in for the thegodnamed portfolio studio." },
      { property: "og:title", content: "Sign in — thegodnamed" },
      { property: "og:description", content: "Private sign-in for the thegodnamed portfolio studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => getHomeMedia(),
  component: AuthPage,
});

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-4"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" /></svg>
);
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.8zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" /></svg>
);

type Mode = "in" | "up" | "forgot" | "recover";

function AuthPage() {
  const navigate = useNavigate();
  const media = Route.useLoaderData();
  const bg = media?.hero?.[0] ?? defaultHero[0]!;
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Arriving from a password-reset email: Supabase signs the visitor in for recovery.
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") { setMode("recover"); setMsg(null); } });
    if (window.location.hash.includes("type=recovery")) setMode("recover");
    else supabase.auth.getUser().then(({ data: u }) => { if (u.user && !window.location.hash.includes("type=recovery")) navigate({ to: "/admin", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const social = async (provider: "google" | "apple") => {
    setBusy(true); setMsg(null);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
    setBusy(false);
    if (r.error) setMsg(r.error.message || "Sign-in could not be completed.");
    else if (!r.redirected) navigate({ to: "/admin", replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      navigate({ to: "/admin", replace: true });
    } else if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setBusy(false);
      if (error) return setMsg(error.message);
      if (data.session) navigate({ to: "/admin", replace: true });
      else setMsg("Check your email to confirm the account, then sign in.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` });
      setBusy(false);
      setMsg(error ? error.message : "If that address has an account, a reset link is on its way.");
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (error) return setMsg(error.message);
      window.history.replaceState(null, "", "/auth");
      navigate({ to: "/admin", replace: true });
    }
  };

  const field = "w-full rounded-full border border-paper/15 bg-paper/[0.04] px-5 py-3 text-sm text-paper outline-none transition-colors placeholder:text-paper/40 focus:border-paper/50";
  const ghost = "glass meta inline-flex w-full items-center justify-center gap-2.5 rounded-full px-5 py-3 text-paper disabled:opacity-50";
  const link = "meta text-[0.5625rem] text-paper/45 transition-colors hover:text-paper/85";
  const title = { in: "Private", up: "New account", forgot: "Reset password", recover: "New password" }[mode];
  const action = { in: "Sign in", up: "Create account", forgot: "Send reset link", recover: "Save new password" }[mode];

  return (
    <main className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <img src={bg.src} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover blur-[2px]" style={{ objectPosition: bg.pos ?? "50% 50%" }} />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/75 to-background/40" />

      <header className="flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <Link to="/" className="meta inline-flex flex-col items-center whitespace-nowrap text-paper transition-opacity hover:opacity-70">
          <span className="wordmark">thegodnamed</span>
          <span className="-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · VISUALS</span>
        </Link>
        <Link to="/" className="meta text-[0.6875rem] text-paper/70 hover:text-paper">← Website</Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 pb-16 md:items-start md:pt-[7vh]">
        <div className="glass-panel w-full max-w-sm rounded-[32px] p-7 text-paper md:p-8">
          <p className="meta text-paper/60">{title}</p>
          <h1 className="display pb-5 pt-1 text-5xl">Studio<em>.</em></h1>

          {(mode === "in" || mode === "up") && (
            <>
              <div className="space-y-2">
                <button type="button" disabled={busy} onClick={() => social("google")} className={ghost}><GoogleIcon />Continue with Google</button>
                <button type="button" disabled={busy} onClick={() => social("apple")} className={ghost}><AppleIcon />Continue with Apple</button>
              </div>
              <p className="meta my-4 flex items-center gap-3 text-[0.5625rem] text-paper/35"><span className="h-px flex-1 bg-paper/15" />or with email<span className="h-px flex-1 bg-paper/15" /></p>
            </>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode !== "recover" && <input className={field} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            {mode !== "forgot" && <input className={field} type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder={mode === "recover" ? "New password" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />}
            <button disabled={busy} className="meta w-full rounded-full bg-paper px-5 py-3.5 text-ink transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
              {busy ? "…" : action}
            </button>
          </form>
          {msg && <p className="pt-3 text-center text-xs text-paper/70">{msg}</p>}

          <div className="mt-5 flex items-center justify-between gap-3">
            {mode === "in" && <><button type="button" onClick={() => { setMode("up"); setMsg(null); }} className={link}>Create an account</button><button type="button" onClick={() => { setMode("forgot"); setMsg(null); }} className={link}>Forgot password?</button></>}
            {(mode === "up" || mode === "forgot") && <button type="button" onClick={() => { setMode("in"); setMsg(null); }} className={link}>← Back to sign in</button>}
          </div>
        </div>
      </div>
    </main>
  );
}
