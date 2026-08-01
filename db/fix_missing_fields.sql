-- ============================================
-- 异采平台 - 修复缺失字段补丁
-- 执行环境: Supabase SQL Editor
-- 说明: 确保 user_roles 表有 user_email 字段
-- ============================================

-- 1. user_roles 表添加 user_email 列
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. 创建通过邮箱查找用户UUID的函数（如不存在）
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

GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;

-- 3. 回填已有记录的 user_email
UPDATE user_roles ur
SET user_email = au.email
FROM auth.users au
WHERE ur.user_id = au.id
AND (ur.user_email IS NULL OR ur.user_email = '');

SELECT '✅ 字段修复补丁执行完成' AS result;
