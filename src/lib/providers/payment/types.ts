export interface PaymentLinkPayload {
  studentId: string;
  amount: number;
  monthKey: string;
}

export interface PaymentProvider {
  createPaymentLink(
    payload: PaymentLinkPayload
  ): Promise<{ ok: boolean; paymentUrl: string; externalPaymentId: string }>;
}
