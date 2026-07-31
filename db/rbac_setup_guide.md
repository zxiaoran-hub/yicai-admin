# 异采平台 RBAC 权限体系 - 部署指南

## 前置条件

| 项目 | 说明 |
|------|------|
| Supabase 实例 | `https://spb-m06skr4cysol4lwz.supabase.opentrust.net` |
| 权限 | 需要 Supabase 项目 Owner 或 Admin 角色 |
| 已有表 | suppliers, buyers, inquiries, inquiry_quotes, orders |

## 部署步骤

### 第一步：执行数据库迁移

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard/project/spb-m06skr4cysol4lwz)
2. 进入 **SQL Editor**（左侧导航栏）
3. 点击 **New Query**
4. 将 `rbac_migration.sql` 的全部内容粘贴进去
5. 点击 **Run** 执行

> 脚本使用 `IF NOT EXISTS` 和 `ON CONFLICT DO NOTHING`，可安全重复执行。

### 第二步：验证执行结果

执行以下查询确认表已创建：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'companies', 'teams', 'permissions', 'roles', 
  'role_permissions', 'user_roles', 'user_teams',
  'role_designated_companies', 'company_associations',
  'permission_audit_log'
)
ORDER BY table_name;
```

预期返回 10 张表。

验证权限初始化：

```sql
SELECT COUNT(*) as permission_count FROM permissions;
-- 预期: 55条

SELECT COUNT(*) as rp_count FROM role_permissions;
-- 预期: 55条（系统管理员拥有全部权限）
```

验证函数：

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_user_effective_permissions',
  'check_user_permission',
  'get_user_max_data_scope',
  'get_user_roles_with_inheritance',
  'log_permission_change'
);
```

预期返回 5 个函数。

### 第三步：创建管理员账号

1. 进入 **Authentication → Users**
2. 点击 **Add user → Create new user**
3. 填写：
   - Email: `admin@yicai.app`
   - Password: 设置强密码
   - 勾选 **Auto Confirm User**
4. 创建完成后，记录该用户的 **UID**
5. 回到 SQL Editor 执行：

```sql
INSERT INTO user_roles (user_id, role_id, company_id)
SELECT u.id, r.id, 1
FROM auth.users u, roles r
WHERE u.email = 'admin@yicai.app' 
  AND r.name = '系统管理员' 
  AND r.is_system = true
ON CONFLICT DO NOTHING;
```

> 注意：company_id = 1 为默认平台公司，如有变化请调整。如果 companies 表中还没有平台公司记录，需先插入：
> ```sql
> INSERT INTO companies (name, type, status) 
> VALUES ('异采平台', 'platform', 'active');
> ```

### 第四步：创建示例数据（可选）

```sql
-- 创建示例采购方公司
INSERT INTO companies (name, type, status, contact_name, contact_email, industry)
VALUES ('示例化妆品公司', 'buyer', 'active', '张三', 'zhangsan@example.com', '化妆品');

-- 创建示例供应商公司
INSERT INTO companies (name, type, status, contact_name, contact_email, industry)
VALUES ('示例原料供应商', 'supplier', 'active', '李四', 'lisi@example.com', '化妆品原料');

-- 创建示例团队
INSERT INTO teams (company_id, name, status)
VALUES (2, '采购部', 'active');

-- 创建示例角色：采购经理
INSERT INTO roles (name, description, company_id, data_scope)
VALUES ('采购经理', '负责采购部门日常管理', 2, 'team');

-- 为采购经理分配部分权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.name = '采购经理' 
AND p.resource IN ('inquiry', 'quote', 'order')
AND p.action IN ('read', 'create', 'update')
ON CONFLICT DO NOTHING;
```

## 核心架构说明

### 数据模型

```
users (auth.users)
  ├── user_roles ──── roles ──── role_permissions ──── permissions
  │                    │
  │                    ├── parent_role_id (角色继承)
  │                    ├── data_scope (数据范围: self/team/company/designated/platform)
  │                    └── role_designated_companies (指定公司范围)
  │
  └── user_teams ──── teams ──── companies
                                      │
                                      ├── parent_company_id (公司层级)
                                      └── company_associations (公司关联)
```

### 权限检查流程

1. **获取用户所有角色**（含继承角色）
2. **合并所有角色的权限**（并集）
3. **deny 优先**：如果同一 resource+action 同时存在 allow 和 deny，deny 生效
4. **数据范围过滤**：根据角色的 data_scope 限制可见数据范围

### 数据范围（data_scope）说明

| 级别 | 说明 |
|------|------|
| `self` | 只能查看自己创建的数据 |
| `team` | 可查看本团队数据 |
| `company` | 可查看本公司数据 |
| `designated` | 可查看指定的关联公司数据 |
| `platform` | 可查看全平台数据 |

### API 调用示例

#### 检查用户权限（通过 RPC）

```bash
curl -X POST "https://spb-m06skr4cysol4lwz.supabase.opentrust.net/rest/v1/rpc/check_user_permission" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id": "user-uuid-here", "p_resource": "inquiry", "p_action": "create"}'
```

#### 获取用户权限列表

```bash
curl -X POST "https://spb-m06skr4cysol4lwz.supabase.opentrust.net/rest/v1/rpc/get_user_effective_permissions" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id": "user-uuid-here"}'
```

## 注意事项

1. **服务密钥安全**：`check_user_permission` 等函数使用 `SECURITY DEFINER`，会以函数所有者权限执行，确保不会泄露 service_role key 给前端
2. **RLS 策略**：当前 RLS 策略为基础版（认证用户可读写），生产环境建议根据业务需求细化数据范围过滤
3. **角色继承**：通过 `parent_role_id` 实现，子角色自动继承父角色的权限
4. **权限过期**：`user_roles.expires_at` 支持临时权限，过期后自动失效
5. **审计追踪**：所有权限变更应通过 `log_permission_change` 函数记录
