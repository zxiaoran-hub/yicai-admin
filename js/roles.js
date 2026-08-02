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

// ========== 通用数据库操作辅助 ==========
async function dbInsert(table, data) {
  const headers = await getAuthHeaders();
  headers['Prefer'] = 'return=representation';
  const response = await fetch(`${supabase.url}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`插入失败(${response.status}): ${errText}`);
  }
  return response.json();
}

async function dbDelete(table, match) {
  let url = `${supabase.url}/rest/v1/${table}?`;
  const queryParams = [];
  for (const [key, value] of Object.entries(match)) {
    queryParams.push(`${key}=eq.${value}`);
  }
  url += queryParams.join('&');
  const headers = await getAuthHeaders();
  headers['Prefer'] = 'return=representation';
  const response = await fetch(url, {
    method: 'DELETE',
    headers: headers
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`删除失败(${response.status}): ${errText}`);
  }
  const deleted = await response.json();
  if (!deleted || deleted.length === 0) {
    throw new Error('未找到匹配记录，删除未生效（可能是权限不足）');
  }
  return true;
}

// 写入审计日志（匹配 permission_audit_log 实际表结构）
async function writeAuditLog(action, targetType, detail, targetId, beforeData, afterData) {
  try {
    const details = {};
    if (detail) details.detail = detail;
    if (beforeData) details.before = beforeData;
    if (afterData) details.after = afterData;
    if (currentUser?.email) details.operator_email = currentUser.email;

    await dbInsert('permission_audit_log', {
      actor_id: currentUser?.id || null,
      action: action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : '',
      details: Object.keys(details).length > 0 ? details : null
    });
  } catch (e) {
    console.warn('审计日志写入失败:', e.message);
  }
}

// ========== 角色列表渲染 ==========
async function renderRoles() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const [roles, perms] = await Promise.all([
      supabase.query('roles', { select: '*', order: 'created_at.desc' }),
      supabase.query('permissions', { select: '*', order: 'menu_path.asc,sort_order.asc' })
    ]);

    rolesData = roles || [];
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
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">暂无角色，点击「新建角色」创建</td></tr>' : ''}
            ${pageData.map(r => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(r.name || '-')}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.description || '')}">${escapeHtml(r.description || '-')}</td>
                <td><span class="badge badge-info">${SCOPE_MAP[r.data_scope] || r.data_scope || '-'}</span></td>
                <td>${typeBadge(r.is_system ? 'builtin' : 'custom')}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="openEditRole('${r.id}')">编辑</button>
                  <button class="btn btn-sm btn-outline" onclick="openPermConfig('${r.id}')">权限</button>
                  ${!r.is_system ? `<button class="btn btn-sm btn-danger" onclick="deleteRole('${r.id}','${escapeHtml(r.name || '').replace(/'/g, "\\'")}')">删除</button>` : ''}
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
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🔑</div><p>加载角色数据失败：${err.message}</p></div>`;
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
    const tbody = document.querySelector('.table-container tbody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">未找到匹配的角色</td></tr>';
      return;
    }
    const typeBadge = (type) => {
      if (type === 'builtin') return '<span class="badge badge-primary">内置</span>';
      if (type === 'custom') return '<span class="badge badge-info">自定义</span>';
      return '<span class="badge badge-gray">' + (type || '自定义') + '</span>';
    };
    tbody.innerHTML = filtered.slice(0, rolesPageSize).map(r => `
      <tr>
        <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(r.name || '-')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.description || '')}">${escapeHtml(r.description || '-')}</td>
        <td><span class="badge badge-info">${SCOPE_MAP[r.data_scope] || r.data_scope || '-'}</span></td>
        <td>${typeBadge(r.is_system ? 'builtin' : 'custom')}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openEditRole('${r.id}')">编辑</button>
          <button class="btn btn-sm btn-outline" onclick="openPermConfig('${r.id}')">权限</button>
          ${!r.is_system ? `<button class="btn btn-sm btn-danger" onclick="deleteRole('${r.id}','${escapeHtml(r.name || '').replace(/'/g, "\\'")}')">删除</button>` : ''}
        </td>
      </tr>
    `).join('');
  }, 300);
}

// ========== 创建角色 ==========
function openCreateRole() {
  const scopeOptions = Object.entries(SCOPE_MAP).map(([k, v]) =>
    `<option value="${k}">${v}</option>`
  ).join('');

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
      <select id="role-scope" onchange="toggleDesignatedSelector()">
        ${scopeOptions}
      </select>
      <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">控制该角色可查看的数据范围</div>
    </div>
    <div class="form-group" id="designated-companies-box" style="display:none;">
      <label>指定公司 <span style="color:var(--danger)">*</span></label>
      <div id="designated-companies-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius);padding:8px;">
        <div style="color:var(--gray-400);font-size:13px;">加载中...</div>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">勾选该角色可以访问的公司</div>
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

// ========== 编辑角色 ==========
async function openEditRole(roleId) {
  // 重新从数据库查询确保数据最新
  const roles = await supabase.query('roles', { select: '*', filter: { id: roleId } });
  const role = roles && roles.length > 0 ? roles[0] : null;
  if (!role) return showToast('角色不存在', true);

  // 更新本地缓存
  const localIdx = rolesData.findIndex(r => r.id === roleId);
  if (localIdx >= 0) {
    rolesData[localIdx] = role;
  }

  const scopeOptions = Object.entries(SCOPE_MAP).map(([k, v]) =>
    `<option value="${k}" ${role.data_scope === k ? 'selected' : ''}>${v}</option>`
  ).join('');

  // 查询角色已有的权限
  const rolePerms = await supabase.query('role_permissions', {
    select: 'permission_id',
    filter: { role_id: roleId }
  });
  const checkedPerms = (rolePerms || []).map(rp => rp.permission_id);

  const designatedVisible = role.data_scope === 'designated' ? '' : 'none';

  const content = `
    <div class="form-group">
      <label>角色名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="role-name" value="${escapeHtml(role.name || '')}" maxlength="50">
    </div>
    <div class="form-group">
      <label>角色描述</label>
      <textarea id="role-desc" rows="3">${escapeHtml(role.description || '')}</textarea>
    </div>
    <div class="form-group">
      <label>数据权限范围</label>
      <select id="role-scope" onchange="toggleDesignatedSelector()">
        ${scopeOptions}
      </select>
    </div>
    <div class="form-group" id="designated-companies-box" style="display:${designatedVisible};">
      <label>指定公司 <span style="color:var(--danger)">*</span></label>
      <div id="designated-companies-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius);padding:8px;">
        <div style="color:var(--gray-400);font-size:13px;">加载中...</div>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">勾选该角色可以访问的公司</div>
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

  // 加载指定公司列表
  if (role.data_scope === 'designated') {
    await loadDesignatedCompanies(roleId);
  }
}

// ========== 指定公司选择器 ==========
window.toggleDesignatedSelector = async function() {
  const scope = document.getElementById('role-scope').value;
  const box = document.getElementById('designated-companies-box');
  if (scope === 'designated') {
    box.style.display = '';
    await loadDesignatedCompanies();
  } else {
    box.style.display = 'none';
  }
};

async function loadDesignatedCompanies(currentRoleId) {
  const listEl = document.getElementById('designated-companies-list');
  if (!listEl) return;

  try {
    // 并行加载所有公司和已选中的指定公司
    const [allCompanies, designated] = await Promise.all([
      supabase.query('companies', { select: 'id,name,type', order: 'name.asc' }),
      currentRoleId ? supabase.query('role_designated_companies', {
        select: 'company_id',
        filter: { role_id: currentRoleId }
      }) : Promise.resolve([])
    ]);

    const designatedIds = new Set((designated || []).map(d => d.company_id));
    const companies = allCompanies || [];

    if (companies.length === 0) {
      listEl.innerHTML = '<div style="color:var(--gray-400);font-size:13px;">暂无公司数据，请先在公司管理中添加公司</div>';
      return;
    }

    listEl.innerHTML = companies.map(c => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" name="designated-company" value="${c.id}" ${designatedIds.has(c.id) ? 'checked' : ''}>
        <span style="font-size:13px;color:var(--gray-800);">${escapeHtml(c.name || c.id)}</span>
        <span style="font-size:11px;color:var(--gray-400);margin-left:auto;">${escapeHtml(c.type || '')}</span>
      </label>
    `).join('');
  } catch (e) {
    listEl.innerHTML = `<div style="color:var(--danger);font-size:13px;">加载公司列表失败: ${e.message}</div>`;
  }
}

function getSelectedDesignatedCompanies() {
  return Array.from(document.querySelectorAll('input[name="designated-company"]:checked'))
    .map(cb => cb.value);
}

// ========== 权限树渲染 ==========
function renderPermTreeForForm(treeData, checkedPerms) {
  return `
    <div style="margin-bottom:12px;padding:10px;background:#f5f7fa;border-radius:6px;">
      <label style="font-size:13px;color:#666;margin-right:8px;">平台筛选：</label>
      <select id="perm-platform-filter" onchange="filterPermTreeByPlatform(this.value)" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <option value="all">全部平台</option>
        <option value="pc">仅 PC 端</option>
        <option value="h5">仅 H5 端</option>
      </select>
      <span style="font-size:12px;color:#999;margin-left:8px;">提示：权限可按平台分别配置</span>
    </div>
    <div id="perm-tree-content">
      ${renderPermTreeGroups(treeData, checkedPerms, 'all')}
    </div>
  `;
}

function renderPermTreeGroups(treeData, checkedPerms, platformFilter) {
  return treeData.map(group => {
    let groupPerms = group.permissions || [];
    // 平台过滤
    if (platformFilter && platformFilter !== 'all') {
      groupPerms = groupPerms.filter(p => p.platform === 'all' || p.platform === platformFilter);
    }
    if (groupPerms.length === 0) return '';
    
    const allChecked = groupPerms.length > 0 && groupPerms.every(p => checkedPerms.includes(p.id));
    const someChecked = groupPerms.some(p => checkedPerms.includes(p.id));

    return `
      <div class="perm-tree-group">
        <div class="perm-tree-group-header" onclick="togglePermGroup(this)">
          <span class="perm-tree-arrow">▶</span>
          <label class="perm-tree-checkbox" onclick="event.stopPropagation()">
            <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleGroupPerm(this, '${group.group}')">
            <span class="perm-group-icon">${escapeHtml(group.icon || '📁')}</span>
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
              <span class="perm-item-platform platform-${escapeHtml(p.platform || 'all')}">${getPlatformLabel(p.platform)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function getPlatformLabel(platform) {
  const labels = { all: '全平台', pc: 'PC', h5: 'H5' };
  return labels[platform] || '全平台';
}

function filterPermTreeByPlatform(platform) {
  const contentEl = document.getElementById('perm-tree-content');
  if (contentEl && permissionsData) {
    // 保留当前选中状态
    const currentChecked = Array.from(contentEl.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
      .map(cb => cb.value);
    contentEl.innerHTML = renderPermTreeGroups(permissionsData, currentChecked, platform);
  }
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

// ========== 保存角色（真实写入数据库） ==========
async function saveRole() {
  const name = document.getElementById('role-name').value.trim();
  const desc = document.getElementById('role-desc').value.trim();
  const scope = document.getElementById('role-scope').value;

  if (!name) return showToast('请输入角色名称', true);
  if (scope === 'designated' && getSelectedDesignatedCompanies().length === 0) {
    return showToast('选择「指定公司」权限范围时，请至少选择一个公司', true);
  }

  const permTree = document.getElementById('role-perm-tree');
  const checkedPerms = Array.from(permTree.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  try {
    // 1. 插入角色记录
    const roleData = {
      name,
      description: desc,
      data_scope: scope,
      is_system: false
    };
    const result = await dbInsert('roles', roleData);
    const newRole = result[0] || result;
    const roleId = newRole.id;

    // 2. 插入角色-权限映射
    if (checkedPerms.length > 0) {
      const permRecords = checkedPerms.map(pid => ({ role_id: roleId, permission_id: pid }));
      await dbInsert('role_permissions', permRecords);
    }

    // 3. 如果是designated，插入指定公司
    if (scope === 'designated') {
      const companyIds = getSelectedDesignatedCompanies();
      if (companyIds.length > 0) {
        const designatedRecords = companyIds.map(cid => ({ role_id: roleId, company_id: cid }));
        await dbInsert('role_designated_companies', designatedRecords);
      }
    }

    // 4. 记录审计日志
    await writeAuditLog('role:create', `角色：${name}`, `创建角色「${name}」，权限范围：${SCOPE_MAP[scope]}，权限数：${checkedPerms.length}`, roleId, null, { ...roleData, permissions: checkedPerms });

    closeModal();
    showToast('角色创建成功');
    renderRoles();
  } catch (err) {
    showToast('保存失败: ' + err.message, true);
  }
}

// ========== 更新角色（真实写入数据库） ==========
async function updateRole(roleId) {
  const name = document.getElementById('role-name').value.trim();
  const desc = document.getElementById('role-desc').value.trim();
  const scope = document.getElementById('role-scope').value;

  if (!name) return showToast('请输入角色名称', true);
  if (scope === 'designated' && getSelectedDesignatedCompanies().length === 0) {
    return showToast('选择「指定公司」权限范围时，请至少选择一个公司', true);
  }

  const permTree = document.getElementById('role-perm-tree');
  const checkedPerms = Array.from(permTree.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  try {
    // 1. 更新角色基本信息
    const oldRole = rolesData.find(r => r.id === roleId);
    await supabase.update('roles', {
      name,
      description: desc,
      data_scope: scope
    }, { id: roleId });

    // 2. 删除旧权限映射，重新插入
    await dbDelete('role_permissions', { role_id: roleId });
    if (checkedPerms.length > 0) {
      const permRecords = checkedPerms.map(pid => ({ role_id: roleId, permission_id: pid }));
      await dbInsert('role_permissions', permRecords);
    }

    // 3. 处理指定公司
    await dbDelete('role_designated_companies', { role_id: roleId });
    if (scope === 'designated') {
      const companyIds = getSelectedDesignatedCompanies();
      if (companyIds.length > 0) {
        const designatedRecords = companyIds.map(cid => ({ role_id: roleId, company_id: cid }));
        await dbInsert('role_designated_companies', designatedRecords);
      }
    }

    // 4. 记录审计日志
    await writeAuditLog('role:edit', `角色：${name}`, `编辑角色「${name}」，权限范围：${SCOPE_MAP[scope]}，权限数：${checkedPerms.length}`, roleId, oldRole, { name, description: desc, data_scope: scope, permissions: checkedPerms });

    closeModal();
    showToast('角色更新成功');
    renderRoles();
  } catch (err) {
    showToast('更新失败: ' + err.message, true);
  }
}

// ========== 删除角色（真实删除） ==========
function deleteRole(roleId, roleName) {
  showConfirm(
    '删除角色',
    `确定要删除角色「${roleName}」吗？删除后该角色下的用户将失去对应权限。`,
    async () => {
      try {
        // 删除关联数据
        await dbDelete('role_permissions', { role_id: roleId });
        await dbDelete('role_designated_companies', { role_id: roleId });
        await dbDelete('user_roles', { role_id: roleId });
        // 删除角色本身
        await dbDelete('roles', { id: roleId });

        // 记录审计日志
        await writeAuditLog('role:delete', `角色：${roleName}`, `删除角色「${roleName}」`, roleId);

        showToast('角色已删除');
        renderRoles();
      } catch (err) {
        showToast('删除失败: ' + err.message, true);
      }
    }
  );
}

// ========== 权限配置面板 ==========
async function openPermConfig(roleId) {
  const roles = await supabase.query('roles', { select: '*', filter: { id: roleId } });
  const role = roles && roles.length > 0 ? roles[0] : null;
  if (!role) return showToast('角色不存在', true);

  // 查询已有权限
  const rolePerms = await supabase.query('role_permissions', {
    select: 'permission_id',
    filter: { role_id: roleId }
  });
  const checkedPerms = (rolePerms || []).map(rp => rp.permission_id);

  const disabledPerms = !role.is_system ? ['rbac:role_delete', 'system:settings'] : [];

  const content = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;color:var(--gray-500);">为「${escapeHtml(role.name)}」配置权限</span>
        <div>
          <button class="btn btn-sm btn-outline" onclick="expandAllPermGroups()">全部展开</button>
          <button class="btn btn-sm btn-outline" onclick="collapseAllPermGroups()">全部收起</button>
        </div>
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
  return `
    <div style="margin-bottom:12px;padding:10px;background:#f5f7fa;border-radius:6px;">
      <label style="font-size:13px;color:#666;margin-right:8px;">平台筛选：</label>
      <select id="config-platform-filter" onchange="filterConfigPermTreeByPlatform(this.value)" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
        <option value="all">全部平台</option>
        <option value="pc">仅 PC 端</option>
        <option value="h5">仅 H5 端</option>
      </select>
    </div>
    <div id="config-perm-tree-content">
      ${renderPermTreeConfigGroups(treeData, checkedPerms, disabledPerms, 'all')}
    </div>
  `;
}

function renderPermTreeConfigGroups(treeData, checkedPerms, disabledPerms, platformFilter) {
  return treeData.map(group => {
    let groupPerms = group.permissions || [];
    // 平台过滤
    if (platformFilter && platformFilter !== 'all') {
      groupPerms = groupPerms.filter(p => p.platform === 'all' || p.platform === platformFilter);
    }
    if (groupPerms.length === 0) return '';
    
    const enabledPerms = groupPerms.filter(p => !disabledPerms.includes(p.id));
    const allChecked = enabledPerms.length > 0 && enabledPerms.every(p => checkedPerms.includes(p.id));

    return `
      <div class="perm-tree-group">
        <div class="perm-tree-group-header" onclick="togglePermGroup(this)">
          <span class="perm-tree-arrow">▶</span>
          <label class="perm-tree-checkbox" onclick="event.stopPropagation()">
            <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleGroupPerm(this, '${group.group}')">
            <span class="perm-group-icon">${escapeHtml(group.icon || '📁')}</span>
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
                <span class="perm-item-platform platform-${escapeHtml(p.platform || 'all')}">${getPlatformLabel(p.platform)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function filterConfigPermTreeByPlatform(platform) {
  const contentEl = document.getElementById('config-perm-tree-content');
  if (contentEl && permissionsData) {
    // 获取当前roleId
    const saveBtn = document.querySelector('.modal-footer .btn-primary');
    const roleId = saveBtn ? saveBtn.getAttribute('onclick').match(/'([^']+)'/)[1] : null;
    // 保留当前选中状态和禁用状态
    const currentChecked = Array.from(contentEl.querySelectorAll('.perm-tree-children input[type="checkbox"]:checked'))
      .map(cb => cb.value);
    const currentDisabled = Array.from(contentEl.querySelectorAll('.perm-tree-children input[type="checkbox"]:disabled'))
      .map(cb => cb.value);
    contentEl.innerHTML = renderPermTreeConfigGroups(permissionsData, currentChecked, currentDisabled, platform);
  }
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
    // 删除旧权限，重新插入
    await dbDelete('role_permissions', { role_id: roleId });
    if (checkedPerms.length > 0) {
      const permRecords = checkedPerms.map(pid => ({ role_id: roleId, permission_id: pid }));
      await dbInsert('role_permissions', permRecords);
    }

    // 审计日志
    const role = rolesData.find(r => r.id === roleId);
    await writeAuditLog('role:perm_change', `角色：${role ? role.name : roleId}`, `变更权限配置，当前权限数：${checkedPerms.length}`, roleId, null, { permissions: checkedPerms });

    closeModal();
    showToast('权限配置已保存');
    renderRoles();
  } catch (err) {
    showToast('保存失败: ' + err.message, true);
  }
}

// 工具：从数据库权限记录构建树（使用实际数据库字段）
function buildPermTree(permRecords) {
  const groupIcons = {
    '数据看板': '📊', '供应商管理': '🏭', '采购方管理': '🛒',
    '询价管理': '📋', '订单管理': '📦', '角色管理': '🔑',
    '用户权限管理': '👤', '权限管理': '🔑', '公司管理': '🏢',
    '审计日志': '📜', '系统设置': '⚙️'
  };
  // 按左侧菜单栏顺序排序
  const menuOrder = [
    '数据看板', '供应商管理', '采购方管理', '询价管理', '订单管理',
    '角色管理', '用户权限管理', '权限管理', '公司管理', '审计日志', '系统设置'
  ];
  const groups = {};
  permRecords.forEach(p => {
    const gn = p.menu_path || '其他';
    if (!groups[gn]) {
      groups[gn] = { group: gn, icon: groupIcons[gn] || '📁', permissions: [] };
    }
    // 判断权限类型：button_key 以 'btn:' 开头为按钮权限，否则为菜单权限
    const permType = (p.button_key && p.button_key.startsWith('btn:')) ? 'button' : 'menu';
    groups[gn].permissions.push({
      id: p.id,
      label: p.display_name || p.resource + ':' + p.action,
      type: permType,
      platform: p.platform || 'all'  // 添加平台字段
    });
  });
  // 按菜单顺序排序
  const result = Object.values(groups);
  result.sort((a, b) => {
    const idxA = menuOrder.indexOf(a.group);
    const idxB = menuOrder.indexOf(b.group);
    // 未定义的排到最后
    const orderA = idxA === -1 ? 999 : idxA;
    const orderB = idxB === -1 ? 999 : idxB;
    return orderA - orderB;
  });
  return result;
}
