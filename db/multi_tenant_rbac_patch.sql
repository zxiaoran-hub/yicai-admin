-- ============================================
-- 异采平台 多租户RBAC增强补丁
-- 执行环境: Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. 允许个人用户无公司归属（company_id可为NULL）
-- ============================================

-- 先删除约束，再重建为可空
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_company_id_not_null;
ALTER TABLE user_roles ALTER COLUMN company_id DROP NOT NULL;
-- 注意：UNIQUE约束也需要调整以支持NULL company_id
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_company_id_key;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_unique_assignment 
  UNIQUE (user_id, role_id, COALESCE(company_id, 0));

-- ============================================
-- 2. 新增供应商端权限
-- ============================================
INSERT INTO permissions (resource, action, effect, display_name, menu_path, button_key, is_system, sort_order) VALUES
-- 产品管理（供应商端核心功能）
('product', 'create', 'allow', '发布产品', '产品管理', 'btn:product:create', true, 5),
('product', 'read', 'allow', '查看产品', '产品管理', 'menu:product', true, 6),
('product', 'update', 'allow', '编辑产品', '产品管理', 'btn:product:edit', true, 7),
('product', 'delete', 'allow', '删除产品', '产品管理', 'btn:product:delete', true, 8),
('product', 'publish', 'allow', '上架产品', '产品管理', 'btn:product:publish', true, 9),
-- 公司级管理（供应商/品牌方管理员功能）
('company', 'manage_roles', 'allow', '管理公司角色', '公司管理', 'btn:company:manage_roles', true, 85),
('company', 'manage_users', 'allow', '管理公司员工', '公司管理', 'btn:company:manage_users', true, 86),
-- 报价查看（品牌方/个人用户）
('quote', 'view_public', 'allow', '查看公开报价', '报价管理', 'btn:quote:view_public', true, 27)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. 创建公司管理员角色模板
-- ============================================

-- 供应商公司管理员角色（company_id=NULL表示模板角色，创建公司时复制）
INSERT INTO roles (company_id, name, description, is_system, data_scope)
VALUES (NULL, '供应商公司管理员_模板', '供应商公司管理员角色模板', true, 'company')
ON CONFLICT DO NOTHING;

-- 品牌方公司管理员角色模板
INSERT INTO roles (company_id, name, description, is_system, data_scope)
VALUES (NULL, '品牌方公司管理员_模板', '品牌方公司管理员角色模板', true, 'company')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. 创建"采购个人用户"默认注册角色
-- ============================================
INSERT INTO roles (company_id, name, description, is_system, data_scope)
VALUES (NULL, '采购个人用户', '个人注册用户的默认角色，可使用平台公共服务', true, 'own')
ON CONFLICT DO NOTHING;

-- 关联权限：查看公开询价、发布询价、查看订单、查看供应商报价
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = '采购个人用户'
AND p.button_key IN (
  'menu:inquiry',          -- 查看询价（菜单）
  'btn:inquiry:create',    -- 发布询价
  'menu:order',            -- 查看订单（菜单）
  'menu:quote',            -- 查看报价（菜单）
  'btn:quote:view_public'  -- 查看公开报价
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. 公司级RLS策略增强
-- ============================================

-- 辅助函数：判断当前用户是否是平台管理员
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.is_system = true
    AND r.data_scope = 'platform'
  );
END;
$$;

-- 辅助函数：获取当前用户的公司ID
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_company_id BIGINT;
BEGIN
  SELECT ur.company_id INTO v_company_id
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.company_id IS NOT NULL
  LIMIT 1;
  RETURN v_company_id;
END;
$$;

-- 辅助函数：判断当前用户是否是公司管理员
CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.data_scope = 'company'
    AND (r.name LIKE '%管理员%' OR r.is_system = true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_company_id() TO anon;
GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_company_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_company_admin() TO authenticated;

-- ============================================
-- 6. 增强现有RLS策略
-- ============================================

-- roles表：公司管理员只能管理本公司角色
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;

CREATE POLICY "roles_insert" ON roles FOR INSERT
WITH CHECK (
  is_platform_admin()
  OR (is_company_admin() AND company_id = get_user_company_id())
);

CREATE POLICY "roles_update" ON roles FOR UPDATE
USING (
  is_platform_admin()
  OR (company_id = get_user_company_id() AND is_company_admin())
);

-- user_roles表：公司管理员只能管理本公司员工
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
WITH CHECK (
  is_platform_admin()
  OR (company_id = get_user_company_id() AND is_company_admin())
  -- 个人注册允许NULL company_id
  OR (company_id IS NULL AND auth.uid() = user_id)
);

CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
USING (
  is_platform_admin()
  OR (company_id = get_user_company_id() AND is_company_admin())
);

-- ============================================
-- 7. 个人注册函数
-- ============================================
CREATE OR REPLACE FUNCTION register_individual_buyer(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_role_id BIGINT;
  v_result JSONB;
BEGIN
  -- 1. 查找"采购个人用户"角色
  SELECT id INTO v_role_id FROM roles WHERE name = '采购个人用户' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION '系统未配置默认注册角色';
  END IF;

  -- 2. 创建认证账号（通过auth.users）
  -- 注意：实际注册需要通过Supabase Auth API，这里只创建user_roles关联
  -- 前端调用supabase.auth.signUp后，再调用此函数关联角色
  
  -- 查找已存在的用户
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '用户不存在，请先通过注册页面创建账号';
  END IF;

  -- 3. 创建user_roles关联（company_id = NULL 表示个人用户）
  INSERT INTO user_roles (user_id, role_id, company_id, user_email)
  VALUES (v_user_id, v_role_id, NULL, p_email)
  ON CONFLICT DO NOTHING;

  -- 4. 返回结果
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'role_id', v_role_id,
    'role_name', '采购个人用户',
    'success', true
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION register_individual_buyer(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION register_individual_buyer(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- 8. 查询用户权限函数（供前端调用）
-- ============================================
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- 默认查当前登录用户
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', '未登录');
  END IF;

  SELECT jsonb_build_object(
    'user_id', v_user_id,
    'company_id', get_user_company_id(),
    'is_platform_admin', is_platform_admin(),
    'is_company_admin', is_company_admin(),
    'roles', COALESCE(
      (SELECT jsonb_agg(DISTINCT r.name)
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = v_user_id),
      '[]'::jsonb
    ),
    'permissions', COALESCE(
      (SELECT jsonb_agg(DISTINCT p.button_key)
       FROM user_roles ur
       JOIN role_permissions rp ON ur.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE ur.user_id = v_user_id
       AND p.button_key IS NOT NULL),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;

-- ============================================
-- 完成
-- ============================================
-- 执行完成后验证：
-- SELECT * FROM roles WHERE name = '采购个人用户';
-- SELECT * FROM permissions WHERE button_key LIKE 'product%' OR button_key = 'btn:quote:view_public';
