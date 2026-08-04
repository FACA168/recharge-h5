-- ============================================================
-- 在线客服系统 - Supabase RLS修复脚本
-- 使用方法：登录 Supabase 控制台 → SQL Editor → New Query → 粘贴执行
-- ============================================================

-- ============================================================
-- 1. 开启行级安全（RLS）
-- ============================================================
alter table settings enable row level security;

-- ============================================================
-- 2. 创建匿名访问策略（允许所有操作）
-- ============================================================

-- 允许读取
create policy "settings_anon_select" on settings
  for select to anon using (true);

-- 允许插入
create policy "settings_anon_insert" on settings
  for insert to anon with check (true);

-- 允许更新
create policy "settings_anon_update" on settings
  for update to anon using (true) with check (true);

-- 允许删除
create policy "settings_anon_delete" on settings
  for delete to anon using (true);

-- ============================================================
-- 3. 验证策略（可选）
-- ============================================================
-- 执行后可以看到策略列表：
-- select * from pg_policies where tablename = 'settings';
