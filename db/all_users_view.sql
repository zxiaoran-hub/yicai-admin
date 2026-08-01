-- 全量用户视图：展示所有注册用户及其角色信息
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 解决：供应商端/品牌方端注册用户不显示在管理后台"用户权限"的问题

-- 1. 创建全量用户视图
CREATE OR REPLACE VIEW all_users_with_roles AS
SELECT 
  au.id AS user_id,
  au.email AS user_email,
  au.created_at AS auth_created_at,
  au.last_sign_in_at,
  ur.id AS user_role_id,
  ur.role_id,
  r.name AS role_name,
  r.data_scope,
  ur.company_id,
  c.name AS company_name,
  ur.granted_at,
  ur.expires_at,
  CASE WHEN ur.id IS NULL THEN false ELSE true END AS has_role
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN companies c ON ur.company_id = c.id
ORDER BY au.created_at DESC;

-- 2. 授权访问
GRANT SELECT ON all_users_with_roles TO anon;
GRANT SELECT ON all_users_with_roles TO authenticated;
GRANT SELECT ON all_users_with_roles TO service_role;
