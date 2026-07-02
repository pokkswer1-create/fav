export interface NotificationPayload {
  to: string;
  title: string;
  body: string;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<{ ok: boolean; providerMessageId: string }>;
}
