-- ============================================
-- 异采管理后台 - 管理员相关SQL
-- ============================================

-- 注意：管理员账号需要通过 Supabase Dashboard 手动创建
-- 邮箱: admin@yicai.app
-- 位置: Authentication > Users > Add User

-- ============================================
-- 如果需要 RLS（Row Level Security）策略，可参考以下：
-- ============================================

-- 允许管理员查看所有供应商
-- CREATE POLICY "Admin can view all suppliers"
-- ON suppliers FOR SELECT
-- USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'admin@yicai.app'));

-- 允许管理员更新供应商认证状态
-- CREATE POLICY "Admin can update suppliers"
-- ON suppliers FOR UPDATE
-- USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'admin@yicai.app'));

-- ============================================
-- 创建管理员用户的 SQL（可选，通过 Supabase SQL Editor 执行）
-- ============================================
-- 注意：这需要通过 Supabase Auth API 创建，而非直接操作 auth.users
-- 建议在 Supabase Dashboard 中手动创建管理员账号

-- ============================================
-- 创建统计数据视图（可选优化）
-- ============================================

-- 供应商统计视图
CREATE OR REPLACE VIEW admin_supplier_stats AS
SELECT 
  verification_status,
  COUNT(*) as count
FROM suppliers
GROUP BY verification_status;

-- 询价统计视图
CREATE OR REPLACE VIEW admin_inquiry_stats AS
SELECT 
  status,
  COUNT(*) as count
FROM inquiries
GROUP BY status;

-- 订单统计视图
CREATE OR REPLACE VIEW admin_order_stats AS
SELECT 
  status,
  COUNT(*) as count,
  COALESCE(SUM(total_amount), 0) as total_amount
FROM orders
GROUP BY status;

-- 最近7天每日统计
CREATE OR REPLACE VIEW admin_daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_suppliers,
  COUNT(*) as total_suppliers
FROM suppliers
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
