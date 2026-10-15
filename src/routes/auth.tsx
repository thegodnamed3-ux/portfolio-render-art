import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
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

  const field = "w-full rounded-full border border-border bg-transparent px-5 py-3 text-sm text-paper outline-none transition-colors placeholder:text-muted-foreground focus:border-paper/60";

  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-5">
      <Link to="/" className="wordmark mb-12 text-paper">thegodnamed</Link>
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-3 rounded-[28px] p-6">
        <p className="meta mb-4 text-muted-foreground">{mode === "in" ? "Studio sign in" : "Create account"}</p>
        <input className={field} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={field} type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} className="meta w-full rounded-full bg-paper px-5 py-3 text-ink transition-opacity disabled:opacity-50">
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        {msg && <p className="pt-2 text-center text-xs text-muted-foreground">{msg}</p>}
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="meta mt-6 text-muted-foreground hover:text-paper">
        {mode === "in" ? "First time? Create the account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
