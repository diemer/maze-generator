-- Maze Generator - Border Settings Migration
-- Run this to add per-project border settings storage

-- ============================================
-- PROJECT BORDER SETTINGS TABLE
-- ============================================

-- Border settings table (one row per project)
CREATE TABLE IF NOT EXISTS maze_project_border_settings (
    project_id UUID PRIMARY KEY REFERENCES maze_projects(id) ON DELETE CASCADE,
    margin_sixteenths INTEGER DEFAULT 8, -- Margin in 1/16" increments (8 = 1/2")
    assignment_mode TEXT DEFAULT 'random', -- 'random' or 'single'
    single_border_id UUID REFERENCES maze_borders(id) ON DELETE SET NULL,
    selected_border_ids UUID[] DEFAULT '{}', -- Array of selected border IDs for random mode
    assignments JSONB DEFAULT '{}', -- Map of { mapId: borderId }
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE maze_project_border_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can access all border settings
CREATE POLICY "Authenticated users can read border settings"
    ON maze_project_border_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert border settings"
    ON maze_project_border_settings FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update border settings"
    ON maze_project_border_settings FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete border settings"
    ON maze_project_border_settings FOR DELETE
    TO authenticated
    USING (true);

-- Function to update timestamp on change
CREATE OR REPLACE FUNCTION update_border_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS border_settings_updated_at ON maze_project_border_settings;
CREATE TRIGGER border_settings_updated_at
    BEFORE UPDATE ON maze_project_border_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_border_settings_timestamp();
