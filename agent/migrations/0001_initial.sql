CREATE TABLE brand_profiles (
  version INTEGER PRIMARY KEY,
  profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
  needs_owner_input_json TEXT NOT NULL CHECK (json_valid(needs_owner_input_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  operating_mode TEXT NOT NULL DEFAULT 'SUPERVISED'
    CHECK (operating_mode IN ('SAFE', 'SUPERVISED', 'AUTONOMOUS')),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  platform_approval_overrides TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(platform_approval_overrides)),
  category_approval_overrides TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(category_approval_overrides)),
  authorized_promotional_claims TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(authorized_promotional_claims)),
  daily_spend_cap_usd REAL NOT NULL DEFAULT 1 CHECK (daily_spend_cap_usd >= 0),
  monthly_spend_cap_usd REAL NOT NULL DEFAULT 10 CHECK (monthly_spend_cap_usd >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  pillar_id TEXT,
  target_audience TEXT,
  objective TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok')),
  format TEXT NOT NULL,
  hook TEXT NOT NULL,
  message TEXT NOT NULL,
  caption_or_script TEXT NOT NULL,
  call_to_action TEXT NOT NULL,
  keywords_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(keywords_json)),
  visual_direction TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  source_references_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_references_json)),
  planned_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'exported', 'published', 'cancelled')),
  measurement_plan_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(measurement_plan_json)),
  destination_url TEXT NOT NULL,
  quality_flags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(quality_flags_json)),
  live_post_url TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX content_items_status_planned_idx ON content_items(status, planned_at);
CREATE INDEX content_items_platform_created_idx ON content_items(platform, created_at);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  owner_email TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX approvals_content_created_idx ON approvals(content_id, created_at);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX jobs_ready_idx ON jobs(status, available_at, lease_until);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  error_message TEXT
);
CREATE INDEX agent_runs_started_idx ON agent_runs(started_at DESC);

CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX activity_log_created_idx ON activity_log(created_at DESC);

CREATE TABLE provider_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_usd REAL NOT NULL CHECK (estimated_cost_usd >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX provider_usage_created_idx ON provider_usage(created_at DESC);

INSERT INTO settings (id) VALUES (1);
INSERT INTO brand_profiles (version, profile_json, needs_owner_input_json)
VALUES (
  1,
  '{"businessName":"NEARLY Studio","website":"https://nearly-x.pages.dev/","location":"Pretoria, South Africa","serviceArea":"South Africa and worldwide","services":["Landing page design","Business website design","Website care"],"positioning":"Premium, thoughtful and modern web design; clear scope and no surprise invoices.","voice":"Professional, warm, clear and low-pressure.","visual":{"background":"#f5f5f7","paper":"#ffffff","ink":"#1d1d1f","muted":"#6e6e73","line":"#d2d2d7","accent":"#0066cc","bodyFont":"DM Sans","headingFont":"Manrope","mark":"N."},"contact":{"email":"madebynearly@gmail.com","phone":"+27 78 394 0421"}}',
  '["Approved social account handles","Owner-approved promotional categories","Preferred publishing cadence"]'
);
