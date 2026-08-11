-- Run this in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  project     TEXT,
  plan        TEXT DEFAULT 'not_sure',
  status      TEXT DEFAULT 'new',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (used by worker)
-- Your dashboard at login.purepulse.one can read via service key
CREATE POLICY "Service role full access" ON leads
  FOR ALL USING (auth.role() = 'service_role');

-- Index for dashboard sorting
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
