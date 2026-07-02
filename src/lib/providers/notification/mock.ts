import type { NotificationPayload, NotificationProvider } from "./types";

export const mockNotificationProvider: NotificationProvider = {
  async send(payload: NotificationPayload) {
    const providerMessageId = `mock-noti-${Date.now()}`;
    console.log("[MockNotification]", { providerMessageId, ...payload });
    return { ok: true, providerMessageId };
  },
};
