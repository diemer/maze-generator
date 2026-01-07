-- Maze Generator Supabase Setup
-- Run this in the Supabase SQL Editor (Database > SQL Editor)

-- ============================================
-- TABLES (namespaced with maze_ prefix)
-- ============================================

-- Projects table
CREATE TABLE IF NOT EXISTS maze_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maps table (belongs to a project)
CREATE TABLE IF NOT EXISTS maze_maps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES maze_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    maze_json JSONB NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Borders table (reusable border images)
CREATE TABLE IF NOT EXISTS maze_borders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom decorations table (user-uploaded decoration images)
CREATE TABLE IF NOT EXISTS maze_decorations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project-Border association (many-to-many)
CREATE TABLE IF NOT EXISTS maze_project_borders (
    project_id UUID REFERENCES maze_projects(id) ON DELETE CASCADE,
    border_id UUID REFERENCES maze_borders(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, border_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_maze_maps_project_id ON maze_maps(project_id);
CREATE INDEX IF NOT EXISTS idx_maze_project_borders_project_id ON maze_project_borders(project_id);
CREATE INDEX IF NOT EXISTS idx_maze_project_borders_border_id ON maze_project_borders(border_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- For anonymous access (single user, no auth required)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE maze_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE maze_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE maze_borders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maze_decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maze_project_borders ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access to all tables (single user app)
-- Projects
CREATE POLICY "Allow anonymous access to maze_projects" ON maze_projects
    FOR ALL USING (true) WITH CHECK (true);

-- Maps
CREATE POLICY "Allow anonymous access to maze_maps" ON maze_maps
    FOR ALL USING (true) WITH CHECK (true);

-- Borders
CREATE POLICY "Allow anonymous access to maze_borders" ON maze_borders
    FOR ALL USING (true) WITH CHECK (true);

-- Decorations
CREATE POLICY "Allow anonymous access to maze_decorations" ON maze_decorations
    FOR ALL USING (true) WITH CHECK (true);

-- Project Borders
CREATE POLICY "Allow anonymous access to maze_project_borders" ON maze_project_borders
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard > Storage
-- ============================================
--
-- 1. Create bucket: "maze-borders" (public)
-- 2. Create bucket: "maze-decorations" (public)
-- 3. Create bucket: "maze-thumbnails" (public)
--
-- For each bucket, add this storage policy via SQL or dashboard:

-- Storage policies for maze-borders bucket
-- INSERT INTO storage.buckets (id, name, public) VALUES ('maze-borders', 'maze-borders', true);
-- CREATE POLICY "Allow public read access on maze-borders" ON storage.objects FOR SELECT USING (bucket_id = 'maze-borders');
-- CREATE POLICY "Allow anonymous upload to maze-borders" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'maze-borders');
-- CREATE POLICY "Allow anonymous delete from maze-borders" ON storage.objects FOR DELETE USING (bucket_id = 'maze-borders');

-- Storage policies for maze-decorations bucket
-- INSERT INTO storage.buckets (id, name, public) VALUES ('maze-decorations', 'maze-decorations', true);
-- CREATE POLICY "Allow public read access on maze-decorations" ON storage.objects FOR SELECT USING (bucket_id = 'maze-decorations');
-- CREATE POLICY "Allow anonymous upload to maze-decorations" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'maze-decorations');
-- CREATE POLICY "Allow anonymous delete from maze-decorations" ON storage.objects FOR DELETE USING (bucket_id = 'maze-decorations');

-- Storage policies for maze-thumbnails bucket
-- INSERT INTO storage.buckets (id, name, public) VALUES ('maze-thumbnails', 'maze-thumbnails', true);
-- CREATE POLICY "Allow public read access on maze-thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'maze-thumbnails');
-- CREATE POLICY "Allow anonymous upload to maze-thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'maze-thumbnails');
-- CREATE POLICY "Allow anonymous delete from maze-thumbnails" ON storage.objects FOR DELETE USING (bucket_id = 'maze-thumbnails');
