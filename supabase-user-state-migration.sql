-- Maze Generator - User State Migration
-- Run this to add per-user state storage (current editing map, etc.)

-- ============================================
-- USER STATE TABLE
-- ============================================

-- User state table (one row per user)
CREATE TABLE IF NOT EXISTS maze_user_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_project_id UUID REFERENCES maze_projects(id) ON DELETE SET NULL,
    current_map_id UUID REFERENCES maze_maps(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE maze_user_state ENABLE ROW LEVEL SECURITY;

-- Users can only access their own state
CREATE POLICY "Users can read own state"
    ON maze_user_state FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own state"
    ON maze_user_state FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own state"
    ON maze_user_state FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Function to update timestamp on change
CREATE OR REPLACE FUNCTION update_maze_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS maze_user_state_updated_at ON maze_user_state;
CREATE TRIGGER maze_user_state_updated_at
    BEFORE UPDATE ON maze_user_state
    FOR EACH ROW
    EXECUTE FUNCTION update_maze_user_state_timestamp();
