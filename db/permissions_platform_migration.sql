-- 异采 RBAC 权限体系 - 平台维度改造
-- 为 permissions 表增加 platform 字段，支持 PC/H5 平台区分

-- 1. 添加 platform 字段
ALTER TABLE permissions 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'all' 
CHECK (platform IN ('all', 'pc', 'h5'));

-- 2. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_permissions_platform ON permissions(platform);

-- 3. 更新 get_user_permissions 函数，返回 platform 信息
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_company_id BIGINT;
  v_is_platform_admin BOOLEAN;
  v_result JSONB;
BEGIN
  -- 获取当前用户
  IF p_user_id IS NOT NULL THEN
    v_user_id := p_user_id;
  ELSE
    v_user_id := auth.uid();
  END IF;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', '未登录');
  END IF;
  
  -- 检查是否平台管理员
  v_is_platform_admin := EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
    AND r.data_scope = 'platform'
  );
  
  -- 获取用户公司ID
  IF v_is_platform_admin THEN
    v_company_id := NULL;
  ELSE
    v_company_id := get_user_company_id();
  END IF;
  
  -- 构建权限列表
  IF v_is_platform_admin THEN
    -- 平台管理员拥有所有权限
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'resource', p.resource,
        'action', p.action,
        'effect', p.effect,
        'display_name', p.display_name,
        'description', p.description,
        'menu_path', p.menu_path,
        'button_key', p.button_key,
        'platform', p.platform,
        'sort_order', p.sort_order
      )
    )
    INTO v_result
    FROM permissions p
    WHERE p.effect = 'allow';
  ELSE
    -- 普通用户根据公司角色获取权限
    SELECT jsonb_agg(DISTINCT
      jsonb_build_object(
        'id', p.id,
        'resource', p.resource,
        'action', p.action,
        'effect', p.effect,
        'display_name', p.display_name,
        'description', p.description,
        'menu_path', p.menu_path,
        'button_key', p.button_key,
        'platform', p.platform,
        'sort_order', p.sort_order
      )
    )
    INTO v_result
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = v_user_id
    AND (r.company_id = v_company_id OR r.data_scope = 'platform')
    AND p.effect = 'allow'
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
  END IF;
  
  -- 返回完整信息
  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'company_id', v_company_id,
    'company_name', (SELECT short_name FROM companies WHERE id = v_company_id),
    'is_platform_admin', v_is_platform_admin,
    'permissions', COALESCE(v_result, '[]'::jsonb),
    'roles', (
      SELECT jsonb_agg(r.name)
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = v_user_id
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    )
  );
END;
$$;

-- 4. 为现有权限设置默认平台（all）
UPDATE permissions SET platform = 'all' WHERE platform IS NULL;

-- 5. 示例：为PC端添加专有权限（可选，后续按需添加）
-- INSERT INTO permissions (resource, action, effect, display_name, menu_path, platform, sort_order)
-- VALUES 
--   ('report', 'export', 'allow', '导出报表', 'page-reports', 'pc', 100),
--   ('data', 'batch_import', 'allow', '批量导入', 'page-data', 'pc', 101);

-- 6. 示例：为H5端添加专有权限（可选，后续按需添加）
-- INSERT INTO permissions (resource, action, effect, display_name, menu_path, platform, sort_order)
-- VALUES 
--   ('location', 'scan', 'allow', '扫码功能', 'page-scan', 'h5', 200);

COMMENT ON COLUMN permissions.platform IS '权限适用平台：all=所有平台, pc=仅PC端, h5=仅H5端';
