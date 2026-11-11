import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Off by default so Back/Forward and Safari's edge swipe change pages instantly; a link click
    // switches the View Transition on for that one page change (slideIn in src/lib/slide.ts).
    defaultViewTransition: false,
  });
  if (typeof window !== "undefined") (window as Window & { __tgnRouter?: typeof router }).__tgnRouter = router;

  return router;
};
