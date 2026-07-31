# 异采 YiCai - 多租户RBAC权限体系设计方案

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     平台管理后台 (yicai-admin)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 公司管理     │  │ 系统角色     │  │ 默认注册角色配置     │  │
│  │ • 创建公司   │  │ • 全局权限   │  │ • 采购个人用户      │  │
│  │ • 创建管理员 │  │ • 内置角色   │  │ • 权限: 查看/发布询价│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  供应商端        │ │  品牌方端        │ │  个人用户        │
│  (yicai-supplier)│ │  (yicai-buyer)  │ │  (自助注册)      │
│                 │ │                 │ │                 │
│ • 公司管理员:   │ │ • 公司管理员:   │ │ • 个人注册:     │
│   - 管理角色    │ │   - 管理角色    │ │   - 查看公开询价 │
│   - 管理员工    │ │   - 管理员工    │ │   - 发布询价     │
│ • 员工:         │ │ • 采购人员:     │ │   - 查看订单     │
│   - 按权限操作  │ │   - 按权限操作  │ │   - 查看供应商报价│
│   - 只看本公司  │ │   - 只看本公司  │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 2. 数据模型设计

### 2.1 核心表关系（已存在，需增强）

```
companies (公司表)
├── id
├── name
├── type: 'platform' | 'supplier' | 'buyer'
└── status

roles (角色表)
├── id
├── company_id ← NULL表示平台级角色
├── name
├── is_system
├── data_scope: 'all' | 'company' | 'designated' | 'own'
└── ...

user_roles (用户角色关联)
├── user_id (UUID)
├── role_id
├── company_id ← NULL表示个人用户(无公司归属)
├── user_email
└── ...

permissions (权限表)
├── id
├── resource
├── action
├── menu_path
├── display_name
├── button_key
└── ...
```

### 2.2 新增默认注册角色

```sql
-- 采购个人用户角色（平台级，company_id = NULL）
INSERT INTO roles (company_id, name, description, is_system, data_scope)
VALUES (NULL, '采购个人用户', '个人注册用户的默认角色，可使用平台公共服务', true, 'own');

-- 关联权限：查看公开询价、发布询价、查看订单、查看供应商报价
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = '采购个人用户'
AND p.button_key IN (
  'btn:inquiry:view',      -- 查看公开询价
  'btn:inquiry:create',    -- 发布询价
  'btn:order:view',        -- 查看订单
  'btn:quote:view'         -- 查看供应商报价
);
```

### 2.3 RLS策略增强（公司级隔离）

```sql
-- 公司管理员只能管理本公司的角色
CREATE POLICY "roles_company_isolation" ON roles
FOR ALL
USING (
  -- 平台管理员可操作所有
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.data_scope = 'all'
    AND r.is_system = true
  )
  OR
  -- 公司管理员只能操作本公司的
  company_id IN (
    SELECT ur.company_id FROM user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

-- 用户角色只能操作本公司的
CREATE POLICY "user_roles_company_isolation" ON user_roles
FOR ALL
USING (
  -- 个人用户只能看自己的
  user_id = auth.uid()
  OR
  -- 公司管理员可操作本公司员工
  company_id IN (
    SELECT ur.company_id FROM user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);
```

## 3. 功能设计

### 3.1 管理后台增强

| 功能 | 说明 |
|------|------|
| 创建公司管理员 | 公司管理页增加"创建管理员"按钮，填写邮箱+密码，自动关联company_admin角色 |
| 默认注册角色配置 | 系统设置中显示当前默认注册角色，可调整关联的权限 |
| 全局数据隔离 | 管理后台只看平台级数据，不显示供应商/品牌方的内部数据 |

### 3.2 供应商端 (yicai-supplier) 接入RBAC

**登录后流程：**
1. 从 `user_roles` + `role_permissions` + `permissions` 加载用户权限
2. 根据权限显示/隐藏菜单项
3. 根据权限启用/禁用按钮

**新增页面（仅公司管理员可见）：**
- 角色管理：创建/编辑本公司角色
- 员工管理：创建员工账号、分配角色

**数据隔离：**
- 所有数据查询自动加 `company_id` 过滤
- 供应商只能看自己的产品、报价、订单

**权限矩阵示例：**
| 功能 | 供应商管理员 | 供应商业务员 | 供应商查看员 |
|------|-------------|-------------|-------------|
| 产品管理 | ✅ 全部 | ✅ 发布/编辑 | ❌ |
| 报价管理 | ✅ 全部 | ✅ 报价 | ❌ |
| 订单管理 | ✅ 全部 | ✅ 查看 | ✅ 查看 |
| 角色管理 | ✅ | ❌ | ❌ |
| 员工管理 | ✅ | ❌ | ❌ |

### 3.3 品牌方端 (yicai-buyer) 新建

**与供应商端类似的RBAC架构，但功能不同：**

**公司用户功能：**
| 功能 | 采购经理 | 采购员 |
|------|---------|--------|
| 发布询价 | ✅ | ✅ |
| 查看报价 | ✅ | ✅ |
| 创建订单 | ✅ | ✅ |
| 审批订单 | ✅ | ❌ |
| 角色管理 | ✅ | ❌ |
| 员工管理 | ✅ | ❌ |

**个人注册功能：**
- 首页有"个人注册"入口
- 注册后自动分配"采购个人用户"角色
- 可访问：查看公开询价、发布询价、查看订单、查看供应商报价
- 个人用户没有公司归属，数据隔离通过 user_id 实现

### 3.4 个人注册流程

```
用户浏览平台 → 点击"注册"
     ↓
填写邮箱+密码+姓名
     ↓
创建 Supabase Auth 账号
     ↓
自动创建 user_roles 记录
  - role_id = "采购个人用户"角色ID
  - company_id = NULL (个人用户)
     ↓
登录后进入品牌方端(个人版)
```

## 4. 实施计划

### Phase 1: 数据库增强 ⏱️
- [ ] 创建"采购个人用户"默认角色及权限关联
- [ ] 增强RLS策略：公司级数据隔离
- [ ] 创建个人注册函数 (register_individual_buyer)
- [ ] 测试：确保平台管理员不受影响

### Phase 2: 供应商端接入RBAC ⏱️
- [ ] 登录后加载用户权限
- [ ] 菜单/按钮权限控制
- [ ] 新增角色管理页面（公司管理员）
- [ ] 新增员工管理页面（公司管理员）
- [ ] 数据查询加 company_id 过滤

### Phase 3: 品牌方端创建 ⏱️
- [ ] 基础框架（复用供应商端结构）
- [ ] RBAC权限控制
- [ ] 个人注册功能
- [ ] 询价/报价/订单业务页面

### Phase 4: 管理后台增强 ⏱️
- [ ] 公司管理增加"创建管理员"功能
- [ ] 默认注册角色配置界面

## 5. 技术要点

### 5.1 权限加载函数
```javascript
// 登录后调用，返回用户权限集合
async function loadUserPermissions() {
  const session = await supabase.auth.getSession();
  const userId = session.user.id;
  
  // 查询用户角色和权限
  const { data } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles(name, data_scope, company_id),
      role_permissions(permission_id, permissions(button_key, menu_path))
    `)
    .eq('user_id', userId);
  
  // 扁平化为权限集合
  const permissions = new Set();
  data.forEach(ur => {
    ur.role_permissions.forEach(rp => {
      permissions.add(rp.permissions.button_key || rp.permissions.menu_path);
    });
  });
  
  return {
    permissions,  // Set<string>
    roles: data.map(ur => ur.roles),
    companyId: data[0]?.roles?.company_id
  };
}
```

### 5.2 权限检查
```javascript
function hasPermission(required) {
  return window.userPermissions?.permissions?.has(required);
}

// 菜单渲染
const menuItems = [
  { key: 'products', label: '产品管理', permission: 'menu:products' },
  { key: 'quotes', label: '报价管理', permission: 'menu:quotes' },
  ...
].filter(item => !item.permission || hasPermission(item.permission));
```

### 5.3 数据隔离
```javascript
// 所有查询自动加公司过滤
async function queryWithCompanyFilter(table, params = {}) {
  const companyId = window.userCompanyId;
  if (companyId) {
    params.filter = { ...params.filter, company_id: companyId };
  }
  return supabase.query(table, params);
}
```
