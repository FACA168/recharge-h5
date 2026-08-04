-- ============================================================
-- 油卡充值系统 - Supabase RLS修复脚本
-- 使用方法：登录 Supabase 控制台 → SQL Editor → New Query → 粘贴执行
-- ============================================================

-- ============================================================
-- 1. 开启行级安全（RLS）
-- ============================================================
alter table orders enable row level security;
alter table settings enable row level security;

-- ============================================================
-- 2. 创建订单表匿名访问策略
-- ============================================================
create policy "orders_anon_all" on orders
  for all to anon using (true) with check (true);

-- ============================================================
-- 3. 创建设置表匿名访问策略
-- ============================================================
create policy "settings_anon_all" on settings
  for all to anon using (true) with check (true);

-- ============================================================
-- 4. 创建 Storage Bucket（存放付款截图与收款码）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

-- ============================================================
-- 5. 创建 Storage 策略
-- ============================================================
-- 允许匿名向 screenshots bucket 上传文件
create policy "screenshots_anon_upload" on storage.objects
  for insert to anon with check (bucket_id = 'screenshots');

-- 允许匿名读取 screenshots bucket 的文件
create policy "screenshots_anon_read" on storage.objects
  for select to anon using (bucket_id = 'screenshots');

-- ============================================================
-- 执行完成后，请确保 API Key 正确配置在 admin.html 中
-- ============================================================
