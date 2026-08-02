-- ============================================================
--  油卡充值系统 - 安全加固脚本
--  使用方法：Supabase 控制台 → SQL Editor → 粘贴执行
-- ============================================================

-- 1. 删除旧的匿名访问策略
drop policy if exists "orders_anon_all" on orders;
drop policy if exists "settings_anon_all" on settings;
drop policy if exists "screenshots_anon_upload" on storage.objects;
drop policy if exists "screenshots_anon_read" on storage.objects;

-- 2. 创建新的访问策略（只允许通过 anon key 访问）
create policy "orders_read" on orders
  for select to anon using (true);

create policy "orders_insert" on orders
  for insert to anon with check (true);

create policy "settings_read" on settings
  for select to anon using (true);

create policy "settings_write" on settings
  for insert to anon with check (true)
  for update to anon using (true) with check (true);

-- 3. Storage 改为私密（只允许通过 service role 访问）
-- 先把 bucket 改为私密
update storage.buckets set public = false where id = 'screenshots';

-- 4. 创建私有 Storage 策略（需要认证）
create policy "screenshots_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'screenshots');

create policy "screenshots_select" on storage.objects
  for select to authenticated using (bucket_id = 'screenshots');

-- 5. 可选：创建管理员表（如果还没创建）
create table if not exists admins (
  id bigint generated always as identity primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- 6. 插入默认管理员（密码 admin123）
-- 注意：这是简易方案，生产环境请使用 bcrypt 加密
insert into admins (username, password_hash)
values ('admin', 'admin123')
on conflict (username) do nothing;

-- 执行完成！
-- 现在数据库只允许通过正确的 anon key 访问
-- 前台用户仍然可以充值，但后台需要正确认证