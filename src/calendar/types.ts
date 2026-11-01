export type NormalisedEvent = {
  eventId: string;
  name: string;
  country: string | null;
  currency: string | null;
  impact: string | null;
  eventTime: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  sourceUrl: string | null;
};

export type ChangeType = "new_event" | "event_updated";
export type IngestStatus = "new" | "updated" | "unchanged";
export type NotificationStatus = "pending" | "sent" | "failed" | "dead";

export type NotificationPayload = {
  type: ChangeType;
  source: string;
  /** "demo" data must never be presented as live market data. */
  data_status: "demo" | "live";
  detected_at: string;
  event: NormalisedEvent;
  changes: Record<string, { from: string | null; to: string | null }>;
};

export type StoredEvent = NormalisedEvent & {
  id: string;
  source: string;
  isDemo: boolean;
  fingerprint: string;
  firstSeenAt: string;
  updatedAt: string;
};

export type NotificationRecord = {
  id: string;
  marketEventId: string;
  fingerprint: string;
  changeType: ChangeType;
  payload: NotificationPayload;
  status: NotificationStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type ProviderStatus = {
  source: string;
  isDemo: boolean;
  eventsReceived: number;
  lastReceivedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type IngestResult = { id: string; status: IngestStatus };
