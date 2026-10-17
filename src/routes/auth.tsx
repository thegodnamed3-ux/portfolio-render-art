import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
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

function AuthPage() {
  const navigate = useNavigate();
  const media = Route.useLoaderData();
  const bg = media?.hero?.[0] ?? defaultHero[0]!;
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/admin", replace: true }); });
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      navigate({ to: "/admin", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setBusy(false);
      if (error) return setMsg(error.message);
      if (data.session) navigate({ to: "/admin", replace: true });
      else setMsg("Check your email to confirm the account, then sign in.");
    }
  };

  const field = "w-full rounded-full border border-paper/15 bg-paper/[0.04] px-5 py-3 text-sm text-paper outline-none transition-colors placeholder:text-paper/40 focus:border-paper/50";

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

      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <form onSubmit={submit} className="glass-panel w-full max-w-sm space-y-3 rounded-[32px] p-7 text-paper md:p-8">
          <p className="meta text-paper/60">{mode === "in" ? "Private" : "First setup"}</p>
          <h1 className="display pb-3 text-5xl">Studio<em>.</em></h1>
          <input className={field} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="meta w-full rounded-full bg-paper px-5 py-3.5 text-ink transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
            {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
          {msg && <p className="pt-1 text-center text-xs text-paper/70">{msg}</p>}
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="meta block w-full pt-2 text-center text-[0.5625rem] text-paper/40 hover:text-paper/80">
            {mode === "in" ? "First time? Create the account" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
