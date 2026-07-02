import type { EmailPayload, EmailProvider } from "./types";

export const mockEmailProvider: EmailProvider = {
  async send(payload: EmailPayload) {
    const providerMessageId = `mock-email-${Date.now()}`;
    console.log("[MockEmail]", { providerMessageId, ...payload });
    return { ok: true, providerMessageId };
  },
};
