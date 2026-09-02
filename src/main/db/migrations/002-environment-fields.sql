-- Up migration for adding new fields to environments

ALTER TABLE environments ADD COLUMN type TEXT DEFAULT 'Custom';
ALTER TABLE environments ADD COLUMN base_url TEXT DEFAULT '';
ALTER TABLE environments ADD COLUMN default_headers TEXT DEFAULT '[]';
ALTER TABLE environments ADD COLUMN auth_config TEXT DEFAULT '{"type":"none"}';
