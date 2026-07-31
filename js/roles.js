// ========== 角色管理模块 ==========
let rolesData = [];
let permissionsData = [];
let rolesPage = 1;
const rolesPageSize = 20;

// 数据权限范围映射
const SCOPE_MAP = {
  self: '本人',
  team: '本团队',
  company: '本公司',
  designated: '指定公司',
  platform: '全平台'
};

// 权限分组结构（默认，当数据库无数据时使用）
const DEFAULT_PERMISSION_TREE = [
  {
    group: '供应商管理',
    icon: '🏭',
    permissions: [
      { id: 'supplier:view', label: '查看供应商', type: 'menu' },
      { id: 'supplier:create', label: '创建供应商', type: 'button' },
      { id: 'supplier:edit', label: '编辑供应商', type: 'button' },
      { id: 'supplier:verify', label: '审核认证', type: 'button' },
      { id: 'supplier:delete', label: '删除供应商', type: 'button' },
    ]
  },
  {
    group: '采购方管理',
    icon: '🛒',
    permissions: [
      { id: 'buyer:view', label: '查看采购方', type: 'menu' },
      { id: 'buyer:create', label: '创建采购方', type: 'button' },
      { id: 'buyer:edit', label: '编辑采购方', type: 'button' },
      { id: 'buyer:delete', label: '删除采购方', type: 'button' },
    ]
  },
  {
    group: '询价管理',
    icon: '📋',
    permissions: [
      { id: 'inquiry:view', label: '查看询价', type: 'menu' },
      { id: 'inquiry:create', label: '发布询价', type: 'button' },
      { id: 'inquiry:manage', label: '管理询价', type: 'button' },
      { id: 'inquiry:close', label: '关闭询价', type: 'button' },
    ]
  },
  {
    group: '订单管理',
    icon: '📦',
    permissions: [
      { id: 'order:view', label: '查看订单', type: 'menu' },
      { id: 'order:create', label: '创建订单', type: 'button' },
      { id: 'order:edit', label: '编辑订单', type: 'button' },
      { id: 'order:confirm', label: '确认订单', type: 'button' },
      { id: 'order:cancel', label: '取消订单', type: 'button' },
    ]
  },
  {
    group: '权限管理',
    icon: '🔑',
    permissions: [
      { id: 'rbac:role_view', label: '查看角色', type: 'menu' },
      { id: 'rbac:role_create', label: '创建角色', type: 'button' },
      { id: 'rbac:role_edit', label: '编辑角色', type: 'button' },
      { id: 'rbac:role_delete', label: '删除角色', type: 'button' },
      { id: 'rbac:user_perm', label: '分配用户权限', type: 'button' },
      { id: 'rbac:audit_view', label: '查看审计日志', type: 'menu' },
    ]
  },
  {
    group: '公司管理',
    icon: '🏢',
    permissions: [
      { id: 'company:view', label: '查看公司', type: 'menu' },
      { id: 'company:create', label: '创建公司', type: 'button' },
      { id: 'company:edit', label: '编辑公司', type: 'button' },
      { id: 'company:team_manage', label: '管理团队', type: 'button' },
    ]
  },
  {
    group: '系统设置',
    icon: '⚙️',
    permissions: [
      { id: 'system:settings', label: '平台设置', type: 'menu' },
      { id: 'system:data_export', label: '数据导出', type: 'button' },
    ]
  }
];

async function renderRoles() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    // 并行加载角色和权限
    const [roles, perms] = await Promise.all([
      supabase.query('roles', { select: '*', order: 'created_at.desc' }),
      supabase.query('permissions', { select: '*', order: 'group_name.asc,sort_order.asc' })
    ]);

    rolesData = roles || [];
    // 如果数据库有权限数据，则按组构建树
    if (perms && perms.length > 0) {
      permissionsData = buildPermTree(perms);
    } else {
      permissionsData = DEFAULT_PERMISSION_TREE;
    }

    const totalPages = Math.ceil(rolesData.length / rolesPageSize) || 1;
    if (rolesPage > totalPages) rolesPage = totalPages;
    const start = (rolesPage - 1) * rolesPageSize;
    const pageData = rolesData.slice(start, start + rolesPageSize);

    const typeBadge = (type) => {
      if (type === 'builtin') return '<span class="badge badge-primary">内置</span>';
      if (type === 'custom') return '<span class="badge badge-info">自定义</span>';
      return '<span class="badge badge-gray">' + (type || '自定义') + '</span>';
    };

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索角色名称..." oninput="filterRoles(this.value)">
          <button class="btn btn-primary btn-sm" onclick="openCreateRole()">+ 新建角色</button>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${rolesData.length} 个角色</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>角色名称</th>
              <th>描述</th>
              <th>数据权限范围</th>
              <th>角色类型</th>
              <th>用户数</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">暂无角色，点击「新建角色」创建</td></tr>' : ''}
            ${pageData.map(r => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${r.name || '-'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.description || ''}">${r.description || '-'}</td>
                <td><span class="badge badge-info">${SCOPE_MAP[r.data_scope] || r.data_scope || '-'}</span></td>
                <td>${typeBadge(r.role_type)}</td>
                <td><span style="color:var(--primary);font-weight:500;">${r.user_count || 0}</span></td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="openEditRole('${r.id}')">编辑</button>
                  <button class="btn btn-sm btn-outline" onclick="openPermConfig('${r.id}')">权限</button>
                  ${r.role_type !== 'builtin' ? `<button class="btn btn-sm btn-danger" onclick="deleteRole('${r.id}','${r.name}')">删除</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="roles-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('roles-pagination'),
      rolesPage,
      totalPages,
      'rolesGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🔑</div><p>加载角色数据失败，请稍后重试</p></div>`;
  }
}

window.rolesGoToPage = function(page) {
  rolesPage = page;
  renderRoles();
};

let rolesSearchTimer;
function filterRoles(val) {
  clearTimeout(rolesSearchTimer);
  rolesSearchTimer = setTimeout(() => {
    const q = val.toLowerCase();
    const filtered = rolesData.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
    // 重新渲染表格部分
    const tbody = document.querySelector('.table-container tbody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">未找到匹配的角色</td></tr>';
      return;
    }
    const typeBadge = (type) => {
      if (type === 'builtin') return '<span class="badge badge-primary">内置</span>';
      if (type === 'custom') return '<span class="badge badge-info">自定义</span>';
      return '<span class="badge badge-gray">' + (type || '自定义') + '</span>';
    };
    tbody.innerHTML = filtered.slice(0, rolesPageSize).map(r => `
      <tr>
        <td style="font-weight:500;color:var(--gray-900)">${r.name || '-'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.description || ''}">${r.description || '-'}</td>
        <td><span class="badge badge-info">${SCOPE_MAP[r.data_scope] || r.data_scope || '-'}</span></td>
        <td>${typeBadge(r.role_type)}</td>
        <td><span style="color:var(--primary);font-weight:500;">${r.user_count || 0}</span></td>
        <td>${formatDate(r.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openEditRole('${r.id}')">编辑</button>
          <button class="btn btn-sm btn-outline" onclick="openPermConfig('${r.id}')">权限</button>
          ${r.role_type !== 'builtin' ? `<button class="btn btn-sm btn-danger" onclick="deleteRole('${r.id}','${r.name}')">删除</button>` : ''}
        </td>
      </tr>
    `).join('');
  }, 300);
}

// ========== 创建/编辑角色弹窗 ==========
function openCreateRole() {
  const scopeOptions = Object.entries(SCOPE_MAP).map(([k, v]) =>
    `<option value="${k}">${v}</option>`
  ).join('');

  const parentOptions = rolesData
    .filter(r => r.role_type !== 'builtin' || true)
    .map(r => `<option value="${r.id}">${r.name}</option>`)
    .join('');

  const content = `
    <div class="form-group">
      <label>角色名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="role-name" placeholder="如：采购经理" maxlength="50">
    </div>
    <div class="form-group">
      <label>角色描述</label>
      <textarea id="role-desc" placeholder="描述该角色的职责范围..." rows="3"></textarea>
    </div>
    <div class="form-group">
      <label>数据权限范围</label>
      <select id="role-scope">
        ${scopeOptions}
      </select>
      <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">控制该角色可查看的数据范围</div>
    </div>
    <div class="form-group">
      <label>父角色（可选，继承其权限）</label>
      <select id="role-parent">
        <option value="">无（不继承）</option>
        ${parentOptions}
      </select>
    </div>
    <div class="form-group">
      <label>权限配置</label>
      <div class="perm-tree-container" id="role-perm-tree">
        ${renderPermTreeForForm(permissionsData, [])}
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveRole()">保存角色</button>
  `;

  showModal('新建角色', content, footer);
}

function openEditRole(roleId) {
  const role = rolesData.find(r => r.id === roleId);
  if (!role) return showToast('角色不存在', true);

  const scopeOptions = Object.entries(SCOPE_MAP).map(([k, v]) =>
    `<option value="${k}" ${role.data_scope === k ? 'selected' : ''}>${v}</option>`
  ).join('');

  const parentOptions = rolesData
    .filter(r => r.id !== roleId)
    .map(r => `<option value="${r.id}" ${role.parent_role_id === r.id ? 'selected' : ''}>${r.name}</option>`)
    .join('');

  // 获取角色已有的权限
  const checkedPerms = role.permissions || [];

  const content = `
    <div class="form-group">
      <label>角色名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="role-name" value="${role.name || ''}" maxlength="50">
    </div>
    <div class="form-group">
      <label>角色描述</label>
      <textarea id="role-desc" rows="3">${role.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label>数据权限范围</label>
      <select id="role-scope">
        ${scopeOptions}
      </select>
    </div>
    <div class="form-group">
      <label>父角色（可选）</label>
      <select id="role-parent">
        <option value="">无（不继承）</option>
        ${parentOptions}
      </select>
    </div>
    <div class="form-group">
      <label>权限配置</label>
      <div class="perm-tree-container" id="role-perm-tree">
        ${renderPermTreeForForm(permissionsData, checkedPerms)}
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="updateRole('${roleId}')">更新角色</button>
  `;

  showModal('编辑角色 - ' + role.name, content, footer);
}

function renderPermTreeForForm(treeData, checkedPerms) {
  return treeData.map(group => {
    const groupPerms = group.permissions || [];
    const allChecked = groupPerms.every(p => checkedPerms.includes(p.id));
    const someChecked = groupPerms.some(p => checkedPerms.includes(p.id));

    return `
      <div class="perm-tree-group">
        <div class="perm-tree-group-header" onclick="togglePermGroup(this)">
          <span class="perm-tree-arrow">▶</span>
          <label class="perm-tree-checkbox" onclick="event.stopPropagation()">
            <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleGroupPerm(this, '${group.group}')">
            <span class="perm-group-icon">${group.icon || '📁'}</span>
            <span class="perm-group-name">${group.group}</span>
            <span class="perm-group-count">${groupPerms.length}项</span>
          </label>
        </div>
        <div class="perm-tree-children" style="display:none;">
          ${groupPerms.map(p => `
            <label class="perm-tree-item">
              <input type="checkbox" value="${p.id}" ${checkedPerms.includes(p.id) ? 'checked' : ''} onchange="updateGroupCheckbox(this)">
              <span class="perm-item-label">${p.label}</span>
              <span class="perm-item-type ${p.type === 'menu' ? 'type-menu' : 'type-button'}">${p.type === 'menu' ? '菜单' : '按钮'}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function togglePermGroup(header) {
  const children = header.nextElementSibling;
  const arrow = header.querySelector('.perm-tree-arrow');
  if (children.style.display === 'none') {
    children.style.display = 'block';
    arrow.textContent = '▼';
  } else {
    children.style.display = 'none';
    arrow.textContent = '▶';
  }
}

function toggleGroupPerm(checkbox, groupName) {
  const group = checkbox.closest('.perm-tree-group');
  const children = group.querySelectorAll('.perm-tree-children input[type="checkbox"]');
  children.forEach(cb => cb.checked = checkbox.checked);
}

function updateGroupCheckbox(checkbox) {
  const group = checkbox.closest('.perm-tree-group');
  const children = group.querySelectorAll('.perm-tree-children input[type="checkbox"]');
  const total = children.length;
  const checked = Array.from(children).filter(c => c.checked).length;
  const groupCb = group.querySelector('.perm-tree-group-header input[type="checkbox"]');
  if (groupCb) {
    groupCb.checked = checked === total;
    groupCb.indeterminate = checked > 0 && checked < total;
  }
}

async function saveRole() {
  const name = document.getElementById('role-name').value.trim();
  const desc = document.getElementById('role-desc').value.trim();
  const scope = document.getElementById('role-scope').value;
  const parent = document.getElementById('role-parent').value;

  if (!name) return showToast('请输入角色名称', true);

  // 收集选中的权限
  const permTree = document.getElementById('role-perm-tree');
  const checkedPerms = Array.from(permTree.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  try {
    // 模拟保存（实际场景调用 supabase RPC 或 insert）
    const newRole = {
      id: 'role_' + Date.now(),
      name,
      description: desc,
      data_scope: scope,
      parent_role_id: parent || null,
      permissions: checkedPerms,
      role_type: 'custom',
      user_count: 0,
      created_at: new Date().toISOString()
    };
    rolesData.unshift(newRole);
    closeModal();
    showToast('角色创建成功');
    renderRoles();
  } catch (err) {
    showToast('保存失败: ' + err.message, true);
  }
}

async function updateRole(roleId) {
  const name = document.getElementById('role-name').value.trim();
  const desc = document.getElementById('role-desc').value.trim();
  const scope = document.getElementById('role-scope').value;
  const parent = document.getElementById('role-parent').value;

  if (!name) return showToast('请输入角色名称', true);

  const permTree = document.getElementById('role-perm-tree');
  const checkedPerms = Array.from(permTree.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  try {
    const idx = rolesData.findIndex(r => r.id === roleId);
    if (idx >= 0) {
      rolesData[idx] = { ...rolesData[idx], name, description: desc, data_scope: scope, parent_role_id: parent || null, permissions: checkedPerms };
    }
    closeModal();
    showToast('角色更新成功');
    renderRoles();
  } catch (err) {
    showToast('更新失败: ' + err.message, true);
  }
}

function deleteRole(roleId, roleName) {
  showConfirm(
    '删除角色',
    `确定要删除角色「${roleName}」吗？删除后该角色下的用户将失去对应权限。`,
    async () => {
      try {
        rolesData = rolesData.filter(r => r.id !== roleId);
        showToast('角色已删除');
        renderRoles();
      } catch (err) {
        showToast('删除失败: ' + err.message, true);
      }
    }
  );
}

// ========== 权限配置面板 ==========
function openPermConfig(roleId) {
  const role = rolesData.find(r => r.id === roleId);
  if (!role) return showToast('角色不存在', true);

  const checkedPerms = role.permissions || [];
  // 权限委托约束：模拟一些不可选权限（当角色是custom类型时，不能授予超过自己的权限）
  const disabledPerms = role.role_type === 'custom' ? ['rbac:role_delete', 'system:settings'] : [];

  const content = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;color:var(--gray-500);">为「${role.name}」配置权限</span>
        <div>
          <button class="btn btn-sm btn-outline" onclick="expandAllPermGroups()">全部展开</button>
          <button class="btn btn-sm btn-outline" onclick="collapseAllPermGroups()">全部收起</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-bottom:12px;">
        💡 灰色项表示当前角色无权授予（权限委托约束）
      </div>
    </div>
    <div class="perm-tree-container" id="config-perm-tree">
      ${renderPermTreeConfig(permissionsData, checkedPerms, disabledPerms)}
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="savePermConfig('${roleId}')">保存权限</button>
  `;

  showModal('权限配置 - ' + role.name, content, footer);
}

function renderPermTreeConfig(treeData, checkedPerms, disabledPerms) {
  return treeData.map(group => {
    const groupPerms = group.permissions || [];
    const enabledPerms = groupPerms.filter(p => !disabledPerms.includes(p.id));
    const allChecked = enabledPerms.length > 0 && enabledPerms.every(p => checkedPerms.includes(p.id));

    return `
      <div class="perm-tree-group">
        <div class="perm-tree-group-header" onclick="togglePermGroup(this)">
          <span class="perm-tree-arrow">▶</span>
          <label class="perm-tree-checkbox" onclick="event.stopPropagation()">
            <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleGroupPerm(this, '${group.group}')">
            <span class="perm-group-icon">${group.icon || '📁'}</span>
            <span class="perm-group-name">${group.group}</span>
          </label>
        </div>
        <div class="perm-tree-children" style="display:none;">
          ${groupPerms.map(p => {
            const disabled = disabledPerms.includes(p.id);
            const checked = checkedPerms.includes(p.id);
            return `
              <label class="perm-tree-item ${disabled ? 'perm-disabled' : ''}">
                <input type="checkbox" value="${p.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="updateGroupCheckbox(this)">
                <span class="perm-item-label">${p.label}</span>
                <span class="perm-item-type ${p.type === 'menu' ? 'type-menu' : 'type-button'}">${p.type === 'menu' ? '菜单' : '按钮'}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function expandAllPermGroups() {
  document.querySelectorAll('#config-perm-tree .perm-tree-children').forEach(el => el.style.display = 'block');
  document.querySelectorAll('#config-perm-tree .perm-tree-arrow').forEach(el => el.textContent = '▼');
}

function collapseAllPermGroups() {
  document.querySelectorAll('#config-perm-tree .perm-tree-children').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#config-perm-tree .perm-tree-arrow').forEach(el => el.textContent = '▶');
}

async function savePermConfig(roleId) {
  const permTree = document.getElementById('config-perm-tree');
  const checkedPerms = Array.from(permTree.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  try {
    const idx = rolesData.findIndex(r => r.id === roleId);
    if (idx >= 0) {
      rolesData[idx].permissions = checkedPerms;
    }
    closeModal();
    showToast('权限配置已保存');
    renderRoles();
  } catch (err) {
    showToast('保存失败: ' + err.message, true);
  }
}

// 工具：从数据库权限记录构建树
function buildPermTree(permRecords) {
  const groups = {};
  permRecords.forEach(p => {
    const gn = p.group_name || '其他';
    if (!groups[gn]) {
      groups[gn] = { group: gn, icon: p.group_icon || '📁', permissions: [] };
    }
    groups[gn].permissions.push({
      id: p.permission_key || p.id,
      label: p.label || p.permission_key,
      type: p.perm_type || 'button'
    });
  });
  return Object.values(groups);
}
