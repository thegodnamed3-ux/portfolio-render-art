<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Apply the shared `wordmark` utility to every visible brand name; keep its font isolated from display and body tokens so identity updates never change other typography.
- Portfolio content (categories, media, contact links) lives in `src/content/`, separate from components, so content can change without touching layouts; `media.ts` was generated from the original Wfolio site.
- The fullscreen viewer is a context provider mounted in `__root.tsx`; pages call `useLightbox().open(items, i)` so the page underneath stays mounted.
