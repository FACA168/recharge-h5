-- ============================================================
--  创建管理员账号（在 Supabase SQL Editor 执行）
--  账号: admin
--  密码: admin123
-- ============================================================

-- 方式1: 使用 Supabase Auth API 创建用户（推荐）
-- 在 Supabase 控制台 → Authentication → Users → New User
-- 邮箱: admin@admin.local
-- 密码: admin123

-- 方式2: 直接插入 users 表（如果方式1不行）
-- 注意：这需要 Supabase 版本支持，且密码需要加密存储