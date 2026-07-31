-- ============================================
-- 异采 RBAC 补丁 - 修复字段缺失问题
-- ============================================

-- 1. user_roles 表添加 user_email 列（方便按邮箱查询和管理用户）
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. 创建通过邮箱查找用户UUID的函数（供前端分配角色时使用）
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  RETURN v_user_id;
END;
$$;

-- 授权 anon 和 authenticated 角色调用此函数
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;
