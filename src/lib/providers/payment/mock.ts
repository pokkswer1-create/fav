import type { PaymentLinkPayload, PaymentProvider } from "./types";

export const mockPaymentProvider: PaymentProvider = {
  async createPaymentLink(payload: PaymentLinkPayload) {
    const externalPaymentId = `mock-pay-${Date.now()}`;
    const paymentUrl = `https://mock-pay.local/pay/${externalPaymentId}?studentId=${payload.studentId}&amount=${payload.amount}&month=${payload.monthKey}`;
    console.log("[MockPaymentLink]", { externalPaymentId, ...payload });
    return { ok: true, paymentUrl, externalPaymentId };
  },
};
