-- Maze Generator - Auth Migration
-- Run this to update policies from anonymous to authenticated access
-- Run AFTER setting up users in Supabase Dashboard > Authentication > Users

-- ============================================
-- DROP OLD ANONYMOUS POLICIES
-- ============================================

-- Table policies
DROP POLICY IF EXISTS "Allow anonymous access to maze_projects" ON maze_projects;
DROP POLICY IF EXISTS "Allow anonymous access to maze_maps" ON maze_maps;
DROP POLICY IF EXISTS "Allow anonymous access to maze_borders" ON maze_borders;
DROP POLICY IF EXISTS "Allow anonymous access to maze_decorations" ON maze_decorations;
DROP POLICY IF EXISTS "Allow anonymous access to maze_project_borders" ON maze_project_borders;

-- Storage policies (if they exist)
DROP POLICY IF EXISTS "Allow public read access on maze-borders" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous upload to maze-borders" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous delete from maze-borders" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read access on maze-decorations" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous upload to maze-decorations" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous delete from maze-decorations" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read access on maze-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous upload to maze-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous delete from maze-thumbnails" ON storage.objects;

-- ============================================
-- CREATE NEW AUTHENTICATED POLICIES
-- ============================================

-- Projects - authenticated users only
CREATE POLICY "Authenticated users can read maze_projects"
    ON maze_projects FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert maze_projects"
    ON maze_projects FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update maze_projects"
    ON maze_projects FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maze_projects"
    ON maze_projects FOR DELETE
    TO authenticated
    USING (true);

-- Maps - authenticated users only
CREATE POLICY "Authenticated users can read maze_maps"
    ON maze_maps FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert maze_maps"
    ON maze_maps FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update maze_maps"
    ON maze_maps FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maze_maps"
    ON maze_maps FOR DELETE
    TO authenticated
    USING (true);

-- Borders - authenticated users only
CREATE POLICY "Authenticated users can read maze_borders"
    ON maze_borders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert maze_borders"
    ON maze_borders FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update maze_borders"
    ON maze_borders FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maze_borders"
    ON maze_borders FOR DELETE
    TO authenticated
    USING (true);

-- Decorations - authenticated users only
CREATE POLICY "Authenticated users can read maze_decorations"
    ON maze_decorations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert maze_decorations"
    ON maze_decorations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update maze_decorations"
    ON maze_decorations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maze_decorations"
    ON maze_decorations FOR DELETE
    TO authenticated
    USING (true);

-- Project Borders - authenticated users only
CREATE POLICY "Authenticated users can read maze_project_borders"
    ON maze_project_borders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert maze_project_borders"
    ON maze_project_borders FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maze_project_borders"
    ON maze_project_borders FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- STORAGE POLICIES (Authenticated)
-- ============================================

-- maze-borders bucket
CREATE POLICY "Authenticated read maze-borders"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'maze-borders');

CREATE POLICY "Authenticated upload maze-borders"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'maze-borders');

CREATE POLICY "Authenticated delete maze-borders"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'maze-borders');

-- maze-decorations bucket
CREATE POLICY "Authenticated read maze-decorations"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'maze-decorations');

CREATE POLICY "Authenticated upload maze-decorations"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'maze-decorations');

CREATE POLICY "Authenticated delete maze-decorations"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'maze-decorations');

-- maze-thumbnails bucket
CREATE POLICY "Authenticated read maze-thumbnails"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'maze-thumbnails');

CREATE POLICY "Authenticated upload maze-thumbnails"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'maze-thumbnails');

CREATE POLICY "Authenticated delete maze-thumbnails"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'maze-thumbnails');
