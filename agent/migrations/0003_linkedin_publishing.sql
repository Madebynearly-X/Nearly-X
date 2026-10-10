CREATE TABLE linkedin_oauth_states (
  state_hash TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE linkedin_connections (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner_email TEXT NOT NULL,
  member_id TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE linkedin_publications (
  content_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitting', 'published', 'failed', 'unknown')),
  post_id TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

ALTER TABLE content_items ADD COLUMN linkedin_post_id TEXT;
ALTER TABLE content_items ADD COLUMN linkedin_publish_locked INTEGER NOT NULL DEFAULT 0
  CHECK (linkedin_publish_locked IN (0, 1));
