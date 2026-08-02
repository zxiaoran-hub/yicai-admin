-- ============================================================
-- 异采 YiCai - 批量导入修复补丁
-- 修复: 1) get_user_id_by_email RPC 缺失  2) suppliers 表 INSERT RLS 策略缺失
-- 执行环境: Supabase SQL Editor
-- ============================================================

-- 1. 创建通过邮箱查找 auth user_id 的函数
-- 用于批量导入时关联已存在的用户
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO anon;

-- 2. 为 suppliers 表添加 INSERT RLS 策略
-- 先确保 RLS 已启用
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）避免冲突
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_auth" ON suppliers;

-- 允许已认证用户插入供应商记录
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 确保 SELECT 策略存在（供页面加载供应商列表使用）
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
USING (true);

-- 确保 UPDATE 策略存在
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 验证:
-- SELECT get_user_id_by_email('zxiaoran@hotmail.com');
-- SELECT * FROM suppliers LIMIT 1;
-- ============================================================
