-- ============================================
-- 异采平台 RBAC 权限管理体系 - 数据库迁移脚本
-- ============================================

-- 1. companies（公司表）
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('platform', 'buyer', 'supplier')),
  parent_company_id BIGINT REFERENCES companies(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. teams（团队/组织单元）
CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  parent_team_id BIGINT REFERENCES teams(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. permissions（权限注册表）
CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  display_name TEXT NOT NULL,
  description TEXT,
  menu_path TEXT,
  button_key TEXT,
  is_system BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource, action, effect)
);

-- 4. roles（角色表）
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  data_scope TEXT NOT NULL DEFAULT 'self' CHECK (data_scope IN ('self', 'team', 'company', 'designated', 'platform')),
  parent_role_id BIGINT REFERENCES roles(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. role_permissions（角色-权限映射）
CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 6. user_roles（用户-角色映射）
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id, company_id)
);

-- 7. user_teams（用户-团队映射）
CREATE TABLE IF NOT EXISTS user_teams (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE(user_id, team_id)
);

-- 8. role_designated_companies（角色-指定公司）
CREATE TABLE IF NOT EXISTS role_designated_companies (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(role_id, company_id)
);

-- 9. company_associations（公司关联）
CREATE TABLE IF NOT EXISTS company_associations (
  id BIGSERIAL PRIMARY KEY,
  parent_company_id BIGINT NOT NULL REFERENCES companies(id),
  child_company_id BIGINT NOT NULL REFERENCES companies(id),
  association_type TEXT NOT NULL DEFAULT 'subsidiary' CHECK (association_type IN ('subsidiary', 'agent', 'partner')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_company_id, child_company_id, association_type)
);

-- 10. permission_audit_log（审计日志）
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 初始化系统权限
-- ============================================
INSERT INTO permissions (resource, action, effect, display_name, menu_path, button_key, is_system, sort_order) VALUES
-- 数据看板
('dashboard', 'read', 'allow', '查看数据看板', '数据看板', 'menu:dashboard', true, 1),
-- 询价管理
('inquiry', 'create', 'allow', '创建询价', '询价管理', 'btn:inquiry:create', true, 10),
('inquiry', 'read', 'allow', '查看询价', '询价管理', 'menu:inquiry', true, 11),
('inquiry', 'update', 'allow', '编辑询价', '询价管理', 'btn:inquiry:edit', true, 12),
('inquiry', 'delete', 'allow', '删除询价', '询价管理', 'btn:inquiry:delete', true, 13),
('inquiry', 'close', 'allow', '关闭询价', '询价管理', 'btn:inquiry:close', true, 14),
('inquiry', 'complete', 'allow', '完成询价', '询价管理', 'btn:inquiry:complete', true, 15),
('inquiry', 'cancel', 'allow', '取消询价', '询价管理', 'btn:inquiry:cancel', true, 16),
('inquiry', 'export', 'allow', '导出询价', '询价管理', 'btn:inquiry:export', true, 17),
-- 报价管理
('quote', 'create', 'allow', '创建报价', '报价管理', 'btn:quote:create', true, 20),
('quote', 'read', 'allow', '查看报价', '报价管理', 'menu:quote', true, 21),
('quote', 'update', 'allow', '编辑报价', '报价管理', 'btn:quote:edit', true, 22),
('quote', 'delete', 'allow', '删除报价', '报价管理', 'btn:quote:delete', true, 23),
('quote', 'accept', 'allow', '接受报价', '报价管理', 'btn:quote:accept', true, 24),
('quote', 'reject', 'allow', '拒绝报价', '报价管理', 'btn:quote:reject', true, 25),
('quote', 'withdraw', 'allow', '撤回报价', '报价管理', 'btn:quote:withdraw', true, 26),
-- 订单管理
('order', 'create', 'allow', '创建订单', '订单管理', 'btn:order:create', true, 30),
('order', 'read', 'allow', '查看订单', '订单管理', 'menu:order', true, 31),
('order', 'update', 'allow', '编辑订单', '订单管理', 'btn:order:edit', true, 32),
('order', 'delete', 'allow', '删除订单', '订单管理', 'btn:order:delete', true, 33),
('order', 'confirm', 'allow', '确认订单', '订单管理', 'btn:order:confirm', true, 34),
('order', 'cancel', 'allow', '取消订单', '订单管理', 'btn:order:cancel', true, 35),
('order', 'complete', 'allow', '完成订单', '订单管理', 'btn:order:complete', true, 36),
-- 供应商管理
('supplier', 'create', 'allow', '添加供应商', '供应商管理', 'btn:supplier:create', true, 40),
('supplier', 'read', 'allow', '查看供应商', '供应商管理', 'menu:supplier', true, 41),
('supplier', 'update', 'allow', '编辑供应商', '供应商管理', 'btn:supplier:edit', true, 42),
('supplier', 'delete', 'allow', '删除供应商', '供应商管理', 'btn:supplier:delete', true, 43),
('supplier', 'verify', 'allow', '认证供应商', '供应商管理', 'btn:supplier:verify', true, 44),
('supplier', 'reject', 'allow', '拒绝供应商', '供应商管理', 'btn:supplier:reject', true, 45),
('supplier', 'suspend', 'allow', '暂停供应商', '供应商管理', 'btn:supplier:suspend', true, 46),
('supplier', 'export', 'allow', '导出供应商', '供应商管理', 'btn:supplier:export', true, 47),
-- 采购方管理
('buyer', 'create', 'allow', '添加采购方', '采购方管理', 'btn:buyer:create', true, 50),
('buyer', 'read', 'allow', '查看采购方', '采购方管理', 'menu:buyer', true, 51),
('buyer', 'update', 'allow', '编辑采购方', '采购方管理', 'btn:buyer:edit', true, 52),
('buyer', 'delete', 'allow', '删除采购方', '采购方管理', 'btn:buyer:delete', true, 53),
('buyer', 'suspend', 'allow', '暂停采购方', '采购方管理', 'btn:buyer:suspend', true, 54),
('buyer', 'export', 'allow', '导出采购方', '采购方管理', 'btn:buyer:export', true, 55),
-- 角色管理
('role', 'create', 'allow', '创建角色', '角色管理', 'btn:role:create', true, 60),
('role', 'read', 'allow', '查看角色', '角色管理', 'menu:role', true, 61),
('role', 'update', 'allow', '编辑角色', '角色管理', 'btn:role:edit', true, 62),
('role', 'delete', 'allow', '删除角色', '角色管理', 'btn:role:delete', true, 63),
('role', 'assign', 'allow', '分配角色', '角色管理', 'btn:role:assign', true, 64),
-- 用户管理
('user', 'create', 'allow', '创建用户', '用户管理', 'btn:user:create', true, 70),
('user', 'read', 'allow', '查看用户', '用户管理', 'menu:user', true, 71),
('user', 'update', 'allow', '编辑用户', '用户管理', 'btn:user:edit', true, 72),
('user', 'delete', 'allow', '删除用户', '用户管理', 'btn:user:delete', true, 73),
('user', 'suspend', 'allow', '暂停用户', '用户管理', 'btn:user:suspend', true, 74),
('user', 'assign_role', 'allow', '分配用户角色', '用户管理', 'btn:user:assign_role', true, 75),
-- 公司管理
('company', 'create', 'allow', '创建公司', '公司管理', 'btn:company:create', true, 80),
('company', 'read', 'allow', '查看公司', '公司管理', 'menu:company', true, 81),
('company', 'update', 'allow', '编辑公司', '公司管理', 'btn:company:edit', true, 82),
('company', 'delete', 'allow', '删除公司', '公司管理', 'btn:company:delete', true, 83),
('company', 'associate', 'allow', '关联公司', '公司管理', 'btn:company:associate', true, 84),
-- 团队管理
('team', 'create', 'allow', '创建团队', '团队管理', 'btn:team:create', true, 90),
('team', 'read', 'allow', '查看团队', '团队管理', 'menu:team', true, 91),
('team', 'update', 'allow', '编辑团队', '团队管理', 'btn:team:edit', true, 92),
('team', 'delete', 'allow', '删除团队', '团队管理', 'btn:team:delete', true, 93),
-- 审计日志
('audit_log', 'read', 'allow', '查看审计日志', '审计日志', 'menu:audit_log', true, 100),
('audit_log', 'export', 'allow', '导出审计日志', '审计日志', 'btn:audit_log:export', true, 101),
-- 系统设置
('settings', 'read', 'allow', '查看系统设置', '系统设置', 'menu:settings', true, 110),
('settings', 'update', 'allow', '修改系统设置', '系统设置', 'btn:settings:edit', true, 111),
-- 通知管理
('notification', 'read', 'allow', '查看通知', '通知管理', 'menu:notification', true, 120),
('notification', 'send', 'allow', '发送通知', '通知管理', 'btn:notification:send', true, 121),
('notification', 'manage', 'allow', '管理通知', '通知管理', 'btn:notification:manage', true, 122)
ON CONFLICT DO NOTHING;

-- ============================================
-- 创建系统管理员角色（拥有全部权限）
-- ============================================
INSERT INTO roles (name, description, is_system, data_scope)
VALUES ('系统管理员', '平台内置管理员角色，拥有全部权限，不可删除', true, 'platform')
ON CONFLICT DO NOTHING;

-- 为系统管理员分配全部权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = '系统管理员' AND r.is_system = true
ON CONFLICT DO NOTHING;

-- ============================================
-- 核心函数
-- ============================================

-- 获取用户有效权限（所有角色的并集，deny优先）
CREATE OR REPLACE FUNCTION get_user_effective_permissions(p_user_id UUID)
RETURNS TABLE(resource TEXT, action TEXT, effect TEXT, permission_id BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_perms AS (
    SELECT DISTINCT p.resource, p.action, p.effect, p.id as permission_id
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    UNION
    -- 继承权限
    SELECT DISTINCT p.resource, p.action, p.effect, p.id as permission_id
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN roles child_r ON child_r.parent_role_id = r.id
    JOIN role_permissions rp ON child_r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  )
  SELECT up.resource, up.action, up.effect, up.permission_id
  FROM user_perms up;
END;
$$;

-- 检查用户是否有某权限
CREATE OR REPLACE FUNCTION check_user_permission(p_user_id UUID, p_resource TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  has_allow BOOLEAN;
  has_deny BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM get_user_effective_permissions(p_user_id)
    WHERE resource = p_resource AND action = p_action AND effect = 'allow'
  ) INTO has_allow;

  SELECT EXISTS(
    SELECT 1 FROM get_user_effective_permissions(p_user_id)
    WHERE resource = p_resource AND action = p_action AND effect = 'deny'
  ) INTO has_deny;

  -- deny优先
  RETURN has_allow AND NOT has_deny;
END;
$$;

-- 获取用户最高数据权限级别
CREATE OR REPLACE FUNCTION get_user_max_data_scope(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  max_scope TEXT;
BEGIN
  SELECT CASE
    WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
                WHERE ur.user_id = p_user_id AND r.data_scope = 'platform'
                AND (ur.expires_at IS NULL OR ur.expires_at > NOW()))
    THEN 'platform'
    WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
                WHERE ur.user_id = p_user_id AND r.data_scope = 'designated'
                AND (ur.expires_at IS NULL OR ur.expires_at > NOW()))
    THEN 'designated'
    WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
                WHERE ur.user_id = p_user_id AND r.data_scope = 'company'
                AND (ur.expires_at IS NULL OR ur.expires_at > NOW()))
    THEN 'company'
    WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
                WHERE ur.user_id = p_user_id AND r.data_scope = 'team'
                AND (ur.expires_at IS NULL OR ur.expires_at > NOW()))
    THEN 'team'
    ELSE 'self'
  END INTO max_scope;
  RETURN max_scope;
END;
$$;

-- 获取用户角色列表（含继承）
CREATE OR REPLACE FUNCTION get_user_roles_with_inheritance(p_user_id UUID)
RETURNS TABLE(role_id BIGINT, role_name TEXT, data_scope TEXT, is_inherited BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- 直接角色
  SELECT r.id, r.name, r.data_scope, false as is_inherited
  FROM user_roles ur JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  UNION
  -- 继承角色
  SELECT r.id, r.name, r.data_scope, true as is_inherited
  FROM user_roles ur 
  JOIN roles parent_r ON ur.role_id = parent_r.id
  JOIN roles r ON r.parent_role_id = parent_r.id
  WHERE ur.user_id = p_user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$;

-- ============================================
-- RLS 策略（启用所有表的RLS）
-- ============================================

-- permissions 表 - 允许所有认证用户读取
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_select" ON permissions FOR SELECT
USING (true);

-- roles 表 - 允许所有认证用户读取
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select" ON roles FOR SELECT
USING (true);
CREATE POLICY "roles_insert" ON roles FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "roles_update" ON roles FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- role_permissions 表
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT
USING (true);
CREATE POLICY "role_permissions_insert" ON role_permissions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "role_permissions_delete" ON role_permissions FOR DELETE
USING (auth.uid() IS NOT NULL);

-- user_roles 表
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
USING (true);
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
USING (auth.uid() IS NOT NULL);
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
USING (auth.uid() IS NOT NULL);

-- companies 表
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select" ON companies FOR SELECT
USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "companies_update" ON companies FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- teams 表
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select" ON teams FOR SELECT
USING (true);
CREATE POLICY "teams_insert" ON teams FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "teams_update" ON teams FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- user_teams 表
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_teams_select" ON user_teams FOR SELECT
USING (true);
CREATE POLICY "user_teams_insert" ON user_teams FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "user_teams_delete" ON user_teams FOR DELETE
USING (auth.uid() IS NOT NULL);

-- role_designated_companies 表
ALTER TABLE role_designated_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_designated_companies_select" ON role_designated_companies FOR SELECT
USING (true);
CREATE POLICY "role_designated_companies_insert" ON role_designated_companies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "role_designated_companies_delete" ON role_designated_companies FOR DELETE
USING (auth.uid() IS NOT NULL);

-- company_associations 表
ALTER TABLE company_associations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_associations_select" ON company_associations FOR SELECT
USING (true);
CREATE POLICY "company_associations_insert" ON company_associations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "company_associations_delete" ON company_associations FOR DELETE
USING (auth.uid() IS NOT NULL);

-- permission_audit_log 表
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_select" ON permission_audit_log FOR SELECT
USING (true);
CREATE POLICY "audit_log_insert" ON permission_audit_log FOR INSERT
WITH CHECK (true);

-- ============================================
-- 审计日志函数
-- ============================================
CREATE OR REPLACE FUNCTION log_permission_change(
  p_actor_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_details JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO permission_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_actor_id, p_action, p_target_type, p_target_id, p_details);
END;
$$;

-- ============================================
-- 创建管理员账号（如果不存在）
-- ============================================
-- 注意：管理员账号需要在 Supabase Dashboard → Authentication 中手动创建
-- 邮箱: admin@yicai.app
-- 创建后需要执行以下SQL关联角色：
-- INSERT INTO user_roles (user_id, role_id, company_id)
-- SELECT u.id, r.id, 1
-- FROM auth.users u, roles r
-- WHERE u.email = 'admin@yicai.app' AND r.name = '系统管理员' AND r.is_system = true
-- ON CONFLICT DO NOTHING;
