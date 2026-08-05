-- ============================================================
-- 创建代金券表（coupons）
-- ============================================================

-- 创建表
CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  phone VARCHAR(20) NOT NULL,
  coupon_code VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 开启RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- 创建匿名访问策略
CREATE POLICY "coupons_anon_all" ON coupons
  FOR ALL TO anon USING (true) WITH CHECK (true);
