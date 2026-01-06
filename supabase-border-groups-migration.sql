-- Maze Generator - Border Groups Migration
-- Run this to add group-based border assignment system

-- ============================================
-- BORDER GROUPS TABLE
-- ============================================

-- Border groups table (many per project)
CREATE TABLE IF NOT EXISTS maze_border_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES maze_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    border_ids UUID[] DEFAULT '{}',
    map_ids UUID[] DEFAULT '{}',
    assignments JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE maze_border_groups ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage all border groups
CREATE POLICY "Authenticated users can read border groups"
    ON maze_border_groups FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert border groups"
    ON maze_border_groups FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update border groups"
    ON maze_border_groups FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete border groups"
    ON maze_border_groups FOR DELETE
    TO authenticated
    USING (true);

-- Index for efficient project lookups
CREATE INDEX IF NOT EXISTS idx_border_groups_project ON maze_border_groups(project_id);
