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
- Photoshoot stacks live in the database (media → photoshoots → photoshoot_images) and are edited at /admin; public pages read only `published` shoots via a server function, so content changes need no code edits.
- Admin rights come from the `user_roles` table (first account created is granted admin by a trigger); never trust client-side flags.
- Uploaded photos go to the private `portfolio` bucket and are served through long-lived signed URLs, because public buckets are blocked in this workspace.
- Client deliveries (finished photos for a client) live in `client_deliveries` → `client_delivery_files` and the private `client-deliveries` bucket, managed in the studio's "Client delivery" tab. Anonymous users have no table or bucket access; the public page `/g/$token` resolves the secret token through a service-role server function and hands out day-long signed URLs. Originals are stored untouched (object name ends with the sanitized original file name, so signed downloads keep it); a ≤2048px JPEG preview is generated in the browser at upload. "Download all" builds a stored ZIP in the browser (`src/lib/zip.ts`), streaming to disk where the File System Access API exists.
- Reviews live in `reviews` (pending → approved/hidden), moderated in the studio's "Reviews" tab. Clients submit only through an active delivery link (`submitReview` checks the token, max 5 per delivery); the website reads approved ones through `getApprovedReviews`. Anonymous users have no direct table access. The homepage Contact band (`ContactSection`) shows a "Reviews →" pill only when approved reviews exist; it slides the band sideways to a glass window of review cards.
- "Selected works" on the homepage is `site_settings.featured_work` (photos + captions) and `featured_columns` (2–6 per row on desktop), edited under Homepage in the studio with a live preview. `WorkGrid` does the layout: equal frames, an unfinished last row centred via a doubled track grid; phones show two per row (first frame full width when the count is odd).
- Deliveries can carry a password (`password_hash` = SHA-256 of "<delivery id>:<password>", see `delivery-hash.ts`) and an `expires_at`. Every client-side action goes through `delivery-auth.server.ts` (`checkAccess` / `requireAccess`), which checks token, active flag, expiry and password. Proofing marks (`favorite`, `client_note`) live on `client_delivery_files`; opens/downloads are logged in `client_delivery_events` and summarised in the studio.
- Telegram: `telegram.server.ts` sends to the studio chat with the TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets. Used for booking requests (`booking.functions.ts`, form in the Contact band) and for new reviews (best-effort; a failed message never fails the review).
- Photos originally imported from Wfolio pointed at its CDN. The Media library has a "Move all photos from Wfolio" panel (`wfolio-migrate.functions.ts`) that copies them into the `portfolio` bucket under `wfolio/` and swaps the links (media rows, then homepage settings, writing code defaults into settings). After it runs, the site no longer loads anything from Wfolio.
- Review alerts in Telegram carry Publish / Hide buttons. Presses arrive at the server route `/api/telegram` (`telegram-webhook.server.ts`), verified by a secret derived from the bot token and by the studio chat id; the webhook is registered from the studio's Reviews tab ("Connect buttons", on the published site).
