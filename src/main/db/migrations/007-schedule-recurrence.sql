ALTER TABLE validation_schedules ADD COLUMN recurrence_type TEXT NOT NULL DEFAULT 'once';
ALTER TABLE validation_schedules ADD COLUMN recurrence_ends_at TEXT;
