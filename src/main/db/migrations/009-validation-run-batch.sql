ALTER TABLE validation_runs ADD COLUMN batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_validation_runs_batch_id ON validation_runs(batch_id);
