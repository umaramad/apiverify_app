CREATE TABLE IF NOT EXISTS validation_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  spec_id TEXT NOT NULL,
  name TEXT NOT NULL,
  endpoint_ids TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  executed_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE,
  FOREIGN KEY (spec_id) REFERENCES api_specs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_validation_schedules_status ON validation_schedules(status);
CREATE INDEX IF NOT EXISTS idx_validation_schedules_scheduled_at ON validation_schedules(scheduled_at);
