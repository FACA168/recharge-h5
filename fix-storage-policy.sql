-- ============================================================
-- Supabase Storage 策略修复脚本
-- ============================================================

-- 1. 创建 screenshots bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 删除旧策略（如果存在）
DROP POLICY IF EXISTS "screenshots_anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "screenshots_anon_read" ON storage.objects;
DROP POLICY IF EXISTS "allow_public_read" ON storage.objects;

-- 3. 创建匿名上传策略
CREATE POLICY "screenshots_anon_upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'screenshots');

-- 4. 创建匿名读取策略
CREATE POLICY "screenshots_anon_read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'screenshots');

-- 5. 创建匿名更新策略（用于覆盖上传）
CREATE POLICY "screenshots_anon_update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'screenshots')
  WITH CHECK (bucket_id = 'screenshots');

-- 6. 创建匿名删除策略
CREATE POLICY "screenshots_anon_delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'screenshots');

-- 7. 允许公开访问（不需要认证即可读取）
UPDATE storage.buckets SET public = true WHERE id = 'screenshots';
