// ========== 用户权限管理模块 ==========
let usersPermData = [];
let usersPermPage = 1;
const usersPermPageSize = 20;

async function renderUsersPerm() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    // 加载用户角色数据
    const userRoles = await supabase.query('user_roles', {
      select: '*',
      order: 'created_at.desc'
    });

    usersPermData = userRoles || [];

    const totalPages = Math.ceil(usersPermData.length / usersPermPageSize) || 1;
    if (usersPermPage > totalPages) usersPermPage = totalPages;
    const start = (usersPermPage - 1) * usersPermPageSize;
    const pageData = usersPermData.slice(start, start + usersPermPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索用户邮箱..." oninput="filterUsersPerm(this.value)">
          <button class="btn btn-primary btn-sm" onclick="openAssignRole()">+ 分配角色</button>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${usersPermData.length} 条记录</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>用户邮箱</th>
              <th>关联角色</th>
              <th>公司</th>
              <th>数据权限范围</th>
              <th>有效期</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">暂无用户权限记录</td></tr>' : ''}
            ${pageData.map(u => {
              const isExpired = u.expires_at && new Date(u.expires_at) < new Date();
              const statusBadge = isExpired
                ? '<span class="badge badge-gray">已过期</span>'
                : (u.status === 'active' ? '<span class="badge badge-success">生效中</span>' : '<span class="badge badge-warning">待生效</span>');
              const expiryDisplay = u.expires_at ? formatDate(u.expires_at) : '永久';
              const roleDisplay = u.role_name || u.role_id || '-';
              const scopeDisplay = SCOPE_MAP[u.data_scope] || u.data_scope || '-';
              return `
                <tr>
                  <td style="font-weight:500;color:var(--gray-900)">${u.user_email || u.user_id || '-'}</td>
                  <td><span class="badge badge-primary">${roleDisplay}</span></td>
                  <td>${u.company_name || u.company_id || '-'}</td>
                  <td><span class="badge badge-info">${scopeDisplay}</span></td>
                  <td>${expiryDisplay}</td>
                  <td>${statusBadge}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="viewUserPerms('${u.user_id || u.user_email}')">查看权限</button>
                    <button class="btn btn-sm btn-outline" onclick="editUserRole('${u.id}')">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="removeUserRole('${u.id}','${u.user_email || u.user_id}')">移除</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div id="users-perm-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('users-perm-pagination'),
      usersPermPage,
      totalPages,
      'usersPermGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>加载用户权限数据失败，请稍后重试</p></div>`;
  }
}

window.usersPermGoToPage = function(page) {
  usersPermPage = page;
  renderUsersPerm();
};

let usersPermSearchTimer;
function filterUsersPerm(val) {
  clearTimeout(usersPermSearchTimer);
  usersPermSearchTimer = setTimeout(() => {
    const q = val.toLowerCase();
    const filtered = usersPermData.filter(u =>
      (u.user_email || '').toLowerCase().includes(q) ||
      (u.user_id || '').toLowerCase().includes(q) ||
      (u.role_name || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q)
    );
    const tbody = document.querySelector('.table-container tbody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">未找到匹配的用户</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.slice(0, usersPermPageSize).map(u => {
      const isExpired = u.expires_at && new Date(u.expires_at) < new Date();
      const statusBadge = isExpired
        ? '<span class="badge badge-gray">已过期</span>'
        : (u.status === 'active' ? '<span class="badge badge-success">生效中</span>' : '<span class="badge badge-warning">待生效</span>');
      const expiryDisplay = u.expires_at ? formatDate(u.expires_at) : '永久';
      const roleDisplay = u.role_name || u.role_id || '-';
      const scopeDisplay = SCOPE_MAP[u.data_scope] || u.data_scope || '-';
      return `
        <tr>
          <td style="font-weight:500;color:var(--gray-900)">${u.user_email || u.user_id || '-'}</td>
          <td><span class="badge badge-primary">${roleDisplay}</span></td>
          <td>${u.company_name || u.company_id || '-'}</td>
          <td><span class="badge badge-info">${scopeDisplay}</span></td>
          <td>${expiryDisplay}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="viewUserPerms('${u.user_id || u.user_email}')">查看权限</button>
            <button class="btn btn-sm btn-outline" onclick="editUserRole('${u.id}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="removeUserRole('${u.id}','${u.user_email || u.user_id}')">移除</button>
          </td>
        </tr>
      `;
    }).join('');
  }, 300);
}

// ========== 分配角色 ==========
function openAssignRole() {
  const roleOptions = rolesData.map(r =>
    `<option value="${r.id}">${r.name} (${SCOPE_MAP[r.data_scope] || r.data_scope})</option>`
  ).join('');

  const content = `
    <div class="form-group">
      <label>用户邮箱 <span style="color:var(--danger)">*</span></label>
      <input type="email" id="assign-user-email" placeholder="输入用户注册邮箱">
    </div>
    <div class="form-group">
      <label>选择角色 <span style="color:var(--danger)">*</span></label>
      <select id="assign-role-id">
        <option value="">请选择角色</option>
        ${roleOptions}
      </select>
    </div>
    <div class="form-group">
      <label>所属公司（可选）</label>
      <input type="text" id="assign-company" placeholder="用户所属公司">
    </div>
    <div class="form-group">
      <label>有效期（留空表示永久）</label>
      <input type="datetime-local" id="assign-expires">
      <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">设置临时权限的到期时间</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveAssignRole()">确认分配</button>
  `;

  showModal('为用户分配角色', content, footer);
}

async function saveAssignRole() {
  const email = document.getElementById('assign-user-email').value.trim();
  const roleId = document.getElementById('assign-role-id').value;
  const company = document.getElementById('assign-company').value.trim();
  const expires = document.getElementById('assign-expires').value;

  if (!email) return showToast('请输入用户邮箱', true);
  if (!roleId) return showToast('请选择角色', true);

  const role = rolesData.find(r => r.id === roleId);

  try {
    const newRecord = {
      id: 'ur_' + Date.now(),
      user_email: email,
      user_id: email,
      role_id: roleId,
      role_name: role ? role.name : roleId,
      company_name: company || '',
      data_scope: role ? role.data_scope : '',
      expires_at: expires ? new Date(expires).toISOString() : null,
      status: 'active',
      created_at: new Date().toISOString()
    };
    usersPermData.unshift(newRecord);
    closeModal();
    showToast('角色分配成功');
    renderUsersPerm();
  } catch (err) {
    showToast('分配失败: ' + err.message, true);
  }
}

function editUserRole(recordId) {
  const record = usersPermData.find(u => u.id === recordId);
  if (!record) return showToast('记录不存在', true);

  const roleOptions = rolesData.map(r =>
    `<option value="${r.id}" ${record.role_id === r.id ? 'selected' : ''}>${r.name} (${SCOPE_MAP[r.data_scope] || r.data_scope})</option>`
  ).join('');

  const expiresValue = record.expires_at ? record.expires_at.slice(0, 16) : '';

  const content = `
    <div class="form-group">
      <label>用户邮箱</label>
      <input type="email" value="${record.user_email || record.user_id || ''}" disabled>
    </div>
    <div class="form-group">
      <label>选择角色</label>
      <select id="edit-role-id">
        ${roleOptions}
      </select>
    </div>
    <div class="form-group">
      <label>所属公司</label>
      <input type="text" id="edit-company" value="${record.company_name || ''}">
    </div>
    <div class="form-group">
      <label>有效期（留空表示永久）</label>
      <input type="datetime-local" id="edit-expires" value="${expiresValue}">
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="updateUserRole('${recordId}')">更新</button>
  `;

  showModal('编辑用户权限', content, footer);
}

async function updateUserRole(recordId) {
  const roleId = document.getElementById('edit-role-id').value;
  const company = document.getElementById('edit-company').value.trim();
  const expires = document.getElementById('edit-expires').value;

  const role = rolesData.find(r => r.id === roleId);
  const idx = usersPermData.findIndex(u => u.id === recordId);

  if (idx >= 0) {
    usersPermData[idx] = {
      ...usersPermData[idx],
      role_id: roleId,
      role_name: role ? role.name : roleId,
      company_name: company,
      data_scope: role ? role.data_scope : usersPermData[idx].data_scope,
      expires_at: expires ? new Date(expires).toISOString() : null,
    };
  }

  closeModal();
  showToast('权限更新成功');
  renderUsersPerm();
}

function removeUserRole(recordId, userEmail) {
  showConfirm(
    '移除权限',
    `确定要移除用户「${userEmail}」的角色权限吗？`,
    async () => {
      try {
        usersPermData = usersPermData.filter(u => u.id !== recordId);
        showToast('已移除');
        renderUsersPerm();
      } catch (err) {
        showToast('操作失败: ' + err.message, true);
      }
    }
  );
}

// ========== 查看用户有效权限汇总 ==========
async function viewUserPerms(userId) {
  const records = usersPermData.filter(u => (u.user_id || u.user_email) === userId);
  if (records.length === 0) return showToast('未找到该用户的权限记录', true);

  // 汇总所有角色和权限
  const roleNames = records.map(r => r.role_name || r.role_id);
  const allPermIds = new Set();
  records.forEach(r => {
    const role = rolesData.find(rl => rl.id === r.role_id);
    if (role && role.permissions) {
      role.permissions.forEach(p => allPermIds.add(p));
    }
  });

  // 将权限ID映射为名称
  const permLabels = [];
  permissionsData.forEach(group => {
    group.permissions.forEach(p => {
      if (allPermIds.has(p.id)) {
        permLabels.push({ group: group.group, label: p.label, type: p.type });
      }
    });
  });

  const content = `
    <div style="margin-bottom:20px;">
      <h4 style="font-size:15px;color:var(--gray-800);margin-bottom:8px;">基本信息</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">用户</span>
          <span class="detail-value">${userId}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">角色数量</span>
          <span class="detail-value">${records.length} 个</span>
        </div>
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <h4 style="font-size:15px;color:var(--gray-800);margin-bottom:8px;">关联角色</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${roleNames.map(n => `<span class="badge badge-primary">${n}</span>`).join('')}
      </div>
    </div>
    <div>
      <h4 style="font-size:15px;color:var(--gray-800);margin-bottom:8px;">有效权限汇总（${permLabels.length}项）</h4>
      ${permLabels.length === 0 ? '<p style="color:var(--gray-400);font-size:13px;">暂无权限数据（角色可能未配置权限）</p>' : ''}
      <div style="max-height:300px;overflow-y:auto;">
        ${groupBy(permLabels, 'group').map(g => `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">${g.key}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${g.items.map(i => `
                <span class="badge ${i.type === 'menu' ? 'badge-info' : 'badge-gray'}" style="font-size:11px;">${i.label}</span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  showModal('用户权限汇总 - ' + userId, content, '<button class="btn btn-outline" onclick="closeModal()">关闭</button>');
}

function groupBy(arr, key) {
  const map = {};
  arr.forEach(item => {
    const k = item[key];
    if (!map[k]) map[k] = [];
    map[k].push(item);
  });
  return Object.entries(map).map(([k, v]) => ({ key: k, items: v }));
}
