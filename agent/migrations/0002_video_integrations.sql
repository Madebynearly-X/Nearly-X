CREATE TABLE canva_oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE integration_connections (
  provider TEXT PRIMARY KEY CHECK (provider IN ('canva')),
  owner_email TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE canva_video_jobs (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  autofill_job_id TEXT NOT NULL UNIQUE,
  design_id TEXT,
  export_job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'ready', 'exporting', 'complete', 'failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX canva_video_jobs_owner_created_idx ON canva_video_jobs(owner_email, created_at DESC);
