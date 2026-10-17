import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackView } from "../lib/analytics.functions";
import { I18nProvider, getLang, useI18n } from "../lib/i18n";

import { LightboxProvider } from "../components/Lightbox";
import { PortfolioProvider } from "../components/PortfolioOverlay";
import { Toaster } from "../components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function Fallback({ meta, t1, t2, text, actions }: { meta: string; t1: string; t2: string; text: string; actions: ReactNode }) {
  return (
    <main className="flex min-h-[100svh] flex-col bg-background text-paper">
      <header className="px-5 py-5 md:px-10 md:py-7">
        <a href="/" className="wordmark text-paper transition-opacity hover:opacity-70">thegodnamed</a>
      </header>
      <section className="flex flex-1 flex-col justify-end px-5 pb-12 md:px-10 md:pb-16">
        <p className="meta text-paper/55">{meta}</p>
        <h1 className="display mt-5 text-[clamp(3rem,11vw,7.5rem)] leading-[0.95]">{t1} <em>{t2}</em></h1>
        <p className="mt-6 max-w-md text-sm text-paper/70 md:text-base">{text}</p>
        <div className="mt-8 flex flex-wrap gap-2.5">{actions}</div>
      </section>
    </main>
  );
}

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <Fallback
      meta={t("nf.meta")} t1={t("nf.t1")} t2={t("nf.t2")} text={t("nf.p")}
      actions={<Link to="/" className="meta rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90">{t("nf.home")}</Link>}
    />
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <Fallback
      meta={t("err.meta")} t1={t("err.t1")} t2={t("err.t2")} text={t("err.p")}
      actions={
        <>
          <button onClick={() => { router.invalidate(); reset(); }} className="meta rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90">{t("err.retry")}</button>
          <a href="/" className="glass meta rounded-full px-5 py-3 text-paper">{t("err.home")}</a>
        </>
      }
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "thegodnamed — Photography & film in Tallinn" },
      { name: "description", content: "Photography, film & visual storytelling, made in Tallinn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Inter:wght@500&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  loader: () => getLang(),
  staleTime: Infinity,
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const lang = Route.useLoaderData() ?? "en";

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initial={lang}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <LightboxProvider><PortfolioProvider>
        <Outlet />
      </PortfolioProvider></LightboxProvider>
      <Toaster position="bottom-center" />
      <ViewTracker />
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Cookie-free page-view counting: one call per page change (private pages are skipped server-side). */
function ViewTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const track = useServerFn(trackView);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === path) return;
    const first = last.current === null;
    last.current = path;
    void track({ data: { path, referrer: first ? document.referrer : "" } }).catch(() => {});
  }, [path, track]);
  return null;
}
