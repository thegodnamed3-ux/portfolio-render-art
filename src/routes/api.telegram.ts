import { createFileRoute } from "@tanstack/react-router";

/** Telegram webhook: button presses under the studio bot's messages. */
export const Route = createFileRoute("/api/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTelegramUpdate } = await import("@/lib/telegram-webhook.server");
        return handleTelegramUpdate(request);
      },
    },
  },
});
