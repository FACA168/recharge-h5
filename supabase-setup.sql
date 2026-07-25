-- ============================================================
--  H5充值平台 - Supabase 初始化脚本
--  使用方法：登录 Supabase 控制台 → SQL Editor → New Query
--  粘贴本文件全部内容 → 点击 Run 执行
-- ============================================================

-- ============================================================
--  1. 创建订单表 orders
-- ============================================================
create table if not exists orders (
  id            bigint generated always as identity primary key,
  order_id      text unique not null,        -- 订单编号（如 ORD20260101...）
  phone         text,                         -- 用户手机号
  coupon_code   text,                         -- 电子代金券编号
  recharge      integer,                      -- 充值档位金额（如 200）
  coupon_deduct integer,                      -- 代金券抵扣额度（如 28）
  amount        integer,                      -- 实付金额（元）
  pay_method    text,                         -- wechat / alipay
  screenshot_url text,                        -- 付款截图在 Storage 中的公开 URL
  status        text default 'pending',       -- pending 待审核 / approved 已通过 / rejected 已拒绝
  created_at    timestamptz default now()     -- 创建时间
);

-- ============================================================
--  2. 创建设置表 settings（key-value 结构）
--     存储：网站名称 / 公告 / Banner / 客服名称 / 客服链接 / 微信收款码 / 支付宝收款码
-- ============================================================
create table if not exists settings (
  key   text primary key,
  value text
);

-- ============================================================
--  3. 开启行级安全（RLS）并配置匿名访问策略
--     说明：本方案为"前台模拟登录 + anon 直连"的简单模式，
--     允许匿名读写。适合内测/个人使用。
--     正式商用前请升级为 Supabase Auth 或自建后端鉴权！
-- ============================================================
alter table orders enable row level security;
create policy "orders_anon_all" on orders
  for all to anon using (true) with check (true);

alter table settings enable row level security;
create policy "settings_anon_all" on settings
  for all to anon using (true) with check (true);

-- ============================================================
--  4. 创建 Storage Bucket（存放付款截图与收款码）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

-- 允许匿名向 screenshots bucket 上传文件
create policy "screenshots_anon_upload" on storage.objects
  for insert to anon with check (bucket_id = 'screenshots');

-- 允许匿名读取 screenshots bucket 的文件（后台查看截图用）
create policy "screenshots_anon_read" on storage.objects
  for select to anon using (bucket_id = 'screenshots');

-- ============================================================
--  执行完成后，请到 Project Settings → API 复制：
--  1) Project URL
--  2) anon public key
--  填到 index.html / admin.html 顶部的配置区即可。
-- ============================================================

-- ============================================================
--  追加说明：如果 orders 表已经创建（升级时），
--  执行下面两条语句补加新字段即可，无需重建表：
-- ============================================================
-- alter table orders add column if not exists recharge integer;
-- alter table orders add column if not exists coupon_deduct integer;
