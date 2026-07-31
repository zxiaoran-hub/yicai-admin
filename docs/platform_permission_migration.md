# 异采 RBAC 权限体系 - 平台维度改造完成

## 改造概述

为权限系统增加了**平台维度**（PC / H5）支持，实现同一套权限体系在不同终端展示不同功能。

## 改造内容

### 1. 数据库层

**新增字段：**
- `permissions` 表增加 `platform` 字段（TEXT 类型）
  - 取值：`'all'`（全平台）、`'pc'`（仅PC端）、`'h5'`（仅H5端）
  - 默认值：`'all'`

**RPC 函数更新：**
- `get_user_permissions()` 函数返回值增加 `platform` 字段
- 前端可根据此字段过滤权限

**迁移脚本：**
- 文件：`yicai-admin/db/permissions_platform_migration.sql`
- ⚠️ **需要手动在 Supabase SQL Editor 中执行**

### 2. 管理后台（Admin Panel）

**权限配置页面改造：**
- ✅ 权限树增加**平台筛选器**（全部 / PC / H5）
- ✅ 每个权限项显示**平台标签**（彩色徽章）
  - 全平台：绿色
  - PC：橙色
  - H5：紫色
- ✅ 创建/编辑角色时可按平台筛选权限
- ✅ 权限配置弹窗支持平台过滤

**文件变更：**
- `js/roles.js` - 权限树渲染逻辑
- `css/style.css` - 平台标签样式

### 3. 供应商端（Supplier App）

**平台检测与过滤：**
- ✅ 自动检测设备类型（User-Agent + 屏幕宽度）
- ✅ 加载权限时根据平台过滤
- ✅ 只展示当前平台可用的菜单和按钮

**文件变更：**
- `js/app.js` - permissionManager 增加 `detectPlatform()` 和过滤逻辑

### 4. 品牌方端（Buyer App）

**平台检测与过滤：**
- ✅ 自动检测设备类型
- ✅ 加载权限时根据平台过滤
- ✅ 只展示当前平台可用的功能

**文件变更：**
- `js/app.js` - 增加 `detectPlatform()` 和过滤逻辑

## 部署状态

| 应用 | GitHub Pages | 状态 |
|------|-------------|------|
| 管理后台 | https://zxiaoran-hub.github.io/yicai-admin/ | ✅ 已部署 |
| 供应商端 | https://zxiaoran-hub.github.io/yicai-supplier/ | ✅ 已部署 |
| 品牌方端 | https://zxiaoran-hub.github.io/yicai-buyer/ | ✅ 已部署 |

## 待执行操作

### ⚠️ 必须：执行数据库迁移

1. 打开 Supabase Dashboard：https://app.supabase.com
2. 进入项目：`spb-m06skr4cysol4lwz`
3. 打开 SQL Editor
4. 复制 `yicai-admin/db/permissions_platform_migration.sql` 的内容
5. 粘贴并执行
6. 确认无报错

### 可选：添加平台专有权限

执行完迁移后，可以按需添加 PC 或 H5 专有权限：

```sql
-- 示例：添加 PC 端专有权限（批量导出）
INSERT INTO permissions (resource, action, effect, display_name, menu_path, platform, sort_order)
VALUES ('report', 'export_batch', 'allow', '批量导出报表', 'page-reports', 'pc', 100);

-- 示例：添加 H5 端专有权限（扫码）
INSERT INTO permissions (resource, action, effect, display_name, menu_path, platform, sort_order)
VALUES ('location', 'scan_qr', 'allow', '扫码功能', 'page-scan', 'h5', 200);
```

## 使用说明

### 管理员配置权限

1. 登录管理后台
2. 进入「角色管理」或「用户权限」
3. 点击「配置权限」
4. 使用**平台筛选器**选择要配置的平台（全部 / PC / H5）
5. 勾选对应权限
6. 保存

### 前端自动适配

- **PC 端访问**：自动检测为 PC，只显示 `platform='all'` 和 `platform='pc'` 的权限
- **移动端访问**：自动检测为 H5，只显示 `platform='all'` 和 `platform='h5'` 的权限

### 平台检测逻辑

```javascript
function detectPlatform() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = window.innerWidth < 768;
  return (isMobile || isSmallScreen) ? 'h5' : 'pc';
}
```

## 技术细节

### 权限过滤流程

1. 用户登录
2. 调用 `get_user_permissions` RPC 获取所有权限
3. 前端调用 `detectPlatform()` 检测当前平台
4. 过滤权限列表：`perm.platform === 'all' || perm.platform === currentPlatform`
5. 根据过滤后的权限渲染 UI

### 向后兼容

- 现有权限默认 `platform='all'`，无需修改
- 未执行迁移前，系统正常工作（platform 字段为 NULL 时视为 'all'）
- 迁移后所有现有权限自动标记为全平台可用

## 后续建议

1. **按需添加平台专有功能**：
   - PC 端：批量操作、高级报表、数据导出
   - H5 端：扫码、定位、拍照上传

2. **优化移动端体验**：
   - H5 端可精简菜单，只保留核心功能
   - 优化触摸交互

3. **权限审计**：
   - 定期检查各平台权限分配情况
   - 确保权限粒度合理

---

**改造完成时间**：2026-07-31  
**改造人**：产品规划总监
