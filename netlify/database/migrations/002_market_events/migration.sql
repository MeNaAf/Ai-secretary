CREATE TABLE IF NOT EXISTS market_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  country TEXT,
  currency TEXT,
  impact TEXT,
  event_time TIMESTAMPTZ,
  forecast TEXT,
  previous TEXT,
  actual TEXT,
  source_url TEXT,
  fingerprint TEXT NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_event_id)
);
CREATE INDEX IF NOT EXISTS market_events_time_idx ON market_events(event_time);
CREATE INDEX IF NOT EXISTS market_events_updated_idx ON market_events(updated_at DESC);

-- Notification outbox. UNIQUE (market_event_id, fingerprint) guarantees one alert per distinct event state.
CREATE TABLE IF NOT EXISTS market_event_notifications (
  id TEXT PRIMARY KEY,
  market_event_id TEXT NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  change_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (market_event_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS market_event_notifications_due_idx ON market_event_notifications(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS calendar_provider_status (
  source TEXT PRIMARY KEY,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  events_received BIGINT NOT NULL DEFAULT 0,
  last_received_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ
);
