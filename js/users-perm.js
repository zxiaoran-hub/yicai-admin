// ========== 用户权限管理模块 ==========
let usersPermData = [];
let usersPermPage = 1;
const usersPermPageSize = 20;

async function renderUsersPerm() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    // 尝试带 join 的查询，获取角色名和公司信息
    let userRoles = await supabase.query('user_roles', {
      select: '*,roles(name,data_scope),companies(name)',
      order: 'granted_at.desc'
    });

    // 如果 join 查询失败，回退到简单查询
    if (!userRoles || userRoles.length === 0) {
      const simpleRoles = await supabase.query('user_roles', {
        select: '*',
        order: 'granted_at.desc'
      });
      userRoles = simpleRoles || [];
    }

    // 确保每条记录都有展示所需的字段
    usersPermData = (userRoles || []).map(ur => ({
      ...ur,
      _role_name: ur.roles?.name || ur.role_name || ur.role_id || '',
      _data_scope: ur.roles?.data_scope || ur.data_scope || '',
      _company_name: ur.companies?.name || ur.company_name || ur.company_id || '',
      _user_email: ur.user_email || ur.user_id || ''
    }));

    const totalPages = Math.ceil(usersPermData.length / usersPermPageSize) || 1;
    if (usersPermPage > totalPages) usersPermPage = totalPages;
    const start = (usersPermPage - 1) * usersPermPageSize;
    const pageData = usersPermData.slice(start, start + usersPermPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索用户邮箱..." oninput="filterUsersPerm(this.value)">
          <select onchange="filterUsersPermCompany(this.value)" id="users-perm-company-filter">
            <option value="">全部公司</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="openCreateUser()">+ 新增用户</button>
          <button class="btn btn-sm btn-outline" onclick="openAssignRole()" style="margin-left:4px;">分配角色</button>
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
                : '<span class="badge badge-success">生效中</span>';
              const expiryDisplay = u.expires_at ? formatDate(u.expires_at) : '永久';
              const roleDisplay = u._role_name || '-';
              const scopeDisplay = SCOPE_MAP[u._data_scope] || u._data_scope || '-';
              return `
                <tr>
                  <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(u._user_email || '-')}</td>
                  <td><span class="badge badge-primary">${escapeHtml(roleDisplay)}</span></td>
                  <td>${escapeHtml(u._company_name || '-')}</td>
                  <td><span class="badge badge-info">${escapeHtml(scopeDisplay)}</span></td>
                  <td>${expiryDisplay}</td>
                  <td>${statusBadge}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="viewUserPerms('${escapeHtml(u._user_email || u.user_id)}')">权限</button>
                    <button class="btn btn-sm btn-outline" onclick="editUserRole('${u.id}')">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="removeUserRole('${u.id}','${(u._user_email || u.user_id || '').replace(/'/g, "\\'")}')">移除</button>
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
    populateCompanyFilter();
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>加载用户权限数据失败：${err.message}</p></div>`;
  }
}

window.usersPermGoToPage = function(page) {
  usersPermPage = page;
  renderUsersPerm();
};

let usersPermCompanyFilter = '';

async function populateCompanyFilter() {
  try {
    const companies = await supabase.query('companies', { select: 'id,name', order: 'name.asc' });
    const select = document.getElementById('users-perm-company-filter');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">全部公司</option>' +
      (companies || []).map(c => `<option value="${c.id}">${escapeHtml(c.name || '-')}</option>`).join('');
    if (current) select.value = current;
  } catch (e) { /* ignore */ }
}

function filterUsersPermCompany(val) {
  usersPermCompanyFilter = val;
  usersPermPage = 1;
  renderUsersPermFiltered();
}

function renderUsersPermFiltered() {
  const q = (document.querySelector('.search-input')?.value || '').toLowerCase();
  const filtered = usersPermData.filter(u => {
    const matchSearch = !q || (u._user_email || '').toLowerCase().includes(q) ||
      (u._role_name || '').toLowerCase().includes(q) ||
      (u._company_name || '').toLowerCase().includes(q);
    const matchCompany = !usersPermCompanyFilter || String(u.company_id) === String(usersPermCompanyFilter);
    return matchSearch && matchCompany;
  });
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
      : '<span class="badge badge-success">生效中</span>';
    const expiryDisplay = u.expires_at ? formatDate(u.expires_at) : '永久';
    const roleDisplay = u._role_name || '-';
    const scopeDisplay = SCOPE_MAP[u._data_scope] || u._data_scope || '-';
    return `
      <tr>
        <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(u._user_email || '-')}</td>
        <td><span class="badge badge-primary">${escapeHtml(roleDisplay)}</span></td>
        <td>${escapeHtml(u._company_name || '-')}</td>
        <td><span class="badge badge-info">${escapeHtml(scopeDisplay)}</span></td>
        <td>${expiryDisplay}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewUserPerms('${escapeHtml(u._user_email || u.user_id)}')">权限</button>
          <button class="btn btn-sm btn-outline" onclick="editUserRole('${u.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="removeUserRole('${u.id}','${(u._user_email || u.user_id || '').replace(/'/g, "\\'")}')">移除</button>
        </td>
      </tr>
    `;
  }).join('');
}

let usersPermSearchTimer;
function filterUsersPerm(val) {
  clearTimeout(usersPermSearchTimer);
  usersPermSearchTimer = setTimeout(() => {
    const q = val.toLowerCase();
    const filtered = usersPermData.filter(u =>
      (u._user_email || '').toLowerCase().includes(q) ||
      (u._role_name || '').toLowerCase().includes(q) ||
      (u._company_name || '').toLowerCase().includes(q)
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
        : '<span class="badge badge-success">生效中</span>';
      const expiryDisplay = u.expires_at ? formatDate(u.expires_at) : '永久';
      const roleDisplay = u._role_name || '-';
      const scopeDisplay = SCOPE_MAP[u._data_scope] || u._data_scope || '-';
      return `
        <tr>
          <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(u._user_email || '-')}</td>
          <td><span class="badge badge-primary">${escapeHtml(roleDisplay)}</span></td>
          <td>${escapeHtml(u._company_name || '-')}</td>
          <td><span class="badge badge-info">${escapeHtml(scopeDisplay)}</span></td>
          <td>${expiryDisplay}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="viewUserPerms('${escapeHtml(u._user_email || u.user_id)}')">权限</button>
            <button class="btn btn-sm btn-outline" onclick="editUserRole('${u.id}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="removeUserRole('${u.id}','${(u._user_email || u.user_id || '').replace(/'/g, "\\'")}')">移除</button>
          </td>
        </tr>
      `;
    }).join('');
  }, 300);
}

// ========== 新增用户（真实创建账号） ==========
async function openCreateUser() {
  // 加载公司和角色选项
  const [companies, roles] = await Promise.all([
    supabase.query('companies', { select: 'id,name', order: 'name.asc' }),
    supabase.query('roles', { select: 'id,name,data_scope', order: 'name.asc' })
  ]);

  const companyOptions = (companies || []).map(c =>
    `<option value="${c.id}">${escapeHtml(c.name || c.id)}</option>`
  ).join('');

  const roleOptions = (roles || []).map(r =>
    `<option value="${r.id}">${escapeHtml(r.name)} (${SCOPE_MAP[r.data_scope] || r.data_scope})</option>`
  ).join('');

  const content = `
    <div class="form-group">
      <label>用户邮箱 <span style="color:var(--danger)">*</span></label>
      <input type="email" id="new-user-email" placeholder="user@example.com">
    </div>
    <div class="form-group">
      <label>密码 <span style="color:var(--danger)">*</span></label>
      <input type="password" id="new-user-password" placeholder="至少6位密码">
    </div>
    <div class="form-group">
      <label>用户姓名</label>
      <input type="text" id="new-user-name" placeholder="输入姓名（可选）">
    </div>
    <div class="form-group">
      <label>选择公司</label>
      <select id="new-user-company">
        <option value="">请选择公司</option>
        ${companyOptions}
      </select>
    </div>
    <div class="form-group">
      <label>选择角色 <span style="color:var(--danger)">*</span></label>
      <select id="new-user-role">
        <option value="">请选择角色</option>
        ${roleOptions}
      </select>
    </div>
    <div class="form-group">
      <label>有效期（留空表示永久）</label>
      <input type="datetime-local" id="new-user-expires">
      <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">设置临时权限的到期时间</div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" id="new-user-save-btn" onclick="saveCreateUser()">创建用户</button>
  `;

  showModal('新增用户', content, footer);
}

async function saveCreateUser() {
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const name = document.getElementById('new-user-name').value.trim();
  const companyId = document.getElementById('new-user-company').value;
  const roleId = document.getElementById('new-user-role').value;
  const expires = document.getElementById('new-user-expires').value;

  if (!email) return showToast('请输入用户邮箱', true);
  if (!isValidEmail(email)) return showToast('邮箱格式不正确', true);
  if (!password || password.length < 6) return showToast('密码至少6位', true);
  if (!roleId) return showToast('请选择角色', true);

  const btn = document.getElementById('new-user-save-btn');
  btn.disabled = true;
  btn.textContent = '创建中...';

  try {
    // 1. 创建认证账号（支持"用户已存在"自动关联）
    let userId = null;
    let isNewAccount = true;

    try {
      const signUpUrl = `${supabase.url}/auth/v1/signup`;
      const signUpResp = await fetch(signUpUrl, {
        method: 'POST',
        headers: {
          'apikey': supabase.key,
          'Authorization': `Bearer ${supabase.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          data: name ? { name, full_name: name } : {}
        })
      });

      if (!signUpResp.ok) {
        const errData = await signUpResp.json().catch(() => ({}));
        const errMsg = errData.error_description || errData.msg || '';
        // 用户已存在 → 查找已有用户ID并关联
        if (errMsg.includes('already registered') || signUpResp.status === 400) {
          isNewAccount = false;
          try {
            userId = await supabase.rpc('get_user_id_by_email', { p_email: email });
          } catch (e) {
            console.warn('RPC lookup failed:', e.message);
          }
          if (!userId) {
            throw new Error('该邮箱已注册，但无法查找用户ID。请尝试使用「分配角色」功能。');
          }
        } else {
          throw new Error(errMsg || `创建账号失败(${signUpResp.status})`);
        }
      } else {
        const signUpResult = await signUpResp.json();
        userId = signUpResult.user?.id || null;
        if (!userId) {
          // 返回成功但没有 user.id，尝试查找
          isNewAccount = false;
          try {
            userId = await supabase.rpc('get_user_id_by_email', { p_email: email });
          } catch (e) {
            console.warn('RPC lookup failed:', e.message);
          }
        }
      }
    } catch (signUpErr) {
      if (signUpErr.message && signUpErr.message.includes('无法查找用户ID')) {
        throw signUpErr;
      }
      // 其他 signUp 错误，尝试 fallback
      console.warn('signUp error, trying fallback:', signUpErr.message);
      try {
        userId = await supabase.rpc('get_user_id_by_email', { p_email: email });
        if (userId) isNewAccount = false;
      } catch (e) {
        throw new Error('创建账号失败: ' + signUpErr.message);
      }
    }

    if (!userId) {
      throw new Error('无法获取用户ID，请重试');
    }

    // 2. 检查是否已有该用户的角色关联
    const existingRoles = await supabase.query('user_roles', {
      select: 'id',
      filter: { user_id: userId }
    });

    // 3. 在 user_roles 表中创建关联记录
    const userRoleData = {
      user_id: userId,
      user_email: email,
      role_id: roleId,
      company_id: companyId || null,
      expires_at: expires ? new Date(expires).toISOString() : null
    };

    try {
      await supabase.insert('user_roles', userRoleData);
    } catch (insertErr) {
      // 如果是唯一约束冲突（用户已有相同角色），提示而非报错
      if (insertErr.message && (insertErr.message.includes('duplicate') || insertErr.message.includes('unique'))) {
        throw new Error('该用户已有角色关联记录，请使用「编辑」功能修改');
      }
      throw insertErr;
    }

    // 4. 记录审计日志
    try {
      const allRoles = await supabase.query('roles', { select: 'id,name', order: 'name.asc' });
      const role = (allRoles || []).find(r => r.id === roleId);
      const action = isNewAccount ? '创建用户并分配角色' : '为已有用户分配角色';
      await writeAuditLog('user:assign_role', `用户：${email}`, `${action}「${email}」→「${role ? role.name : roleId}」`, userId);
    } catch (e) {
      console.warn('Audit log failed:', e.message);
    }

    closeModal();
    const msg = isNewAccount ? '用户创建成功！' : '已为用户分配角色！';
    showToast(msg);
    renderUsersPerm();
  } catch (err) {
    showToast('创建失败: ' + err.message, true);
    btn.disabled = false;
    btn.textContent = '创建用户';
  }
}

// ========== 分配角色（给已有用户） ==========
async function openAssignRole() {
  // 加载公司和角色选项
  const [companies, roles] = await Promise.all([
    supabase.query('companies', { select: 'id,name', order: 'name.asc' }),
    supabase.query('roles', { select: 'id,name,data_scope', order: 'name.asc' })
  ]);

  const companyOptions = (companies || []).map(c =>
    `<option value="${c.id}">${escapeHtml(c.name || c.id)}</option>`
  ).join('');

  const roleOptions = (roles || []).map(r =>
    `<option value="${r.id}">${escapeHtml(r.name)} (${SCOPE_MAP[r.data_scope] || r.data_scope})</option>`
  ).join('');

  const content = `
    <div class="form-group">
      <label>用户邮箱 <span style="color:var(--danger)">*</span></label>
      <input type="email" id="assign-user-email" placeholder="输入已注册的用户邮箱">
    </div>
    <div class="form-group">
      <label>选择角色 <span style="color:var(--danger)">*</span></label>
      <select id="assign-role-id">
        <option value="">请选择角色</option>
        ${roleOptions}
      </select>
    </div>
    <div class="form-group">
      <label>所属公司</label>
      <select id="assign-company-id">
        <option value="">请选择公司</option>
        ${companyOptions}
      </select>
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
  const companyId = document.getElementById('assign-company-id').value;
  const expires = document.getElementById('assign-expires').value;

  if (!email) return showToast('请输入用户邮箱', true);
  if (!roleId) return showToast('请选择角色', true);

  try {
    // 先通过 RPC 函数查找用户 UUID
    let userId = null;
    try {
      userId = await supabase.rpc('get_user_id_by_email', { p_email: email });
    } catch (e) {
      console.warn('RPC lookup failed:', e.message);
    }
    if (!userId) {
      return showToast('未找到该邮箱对应的用户账号，请确认用户已注册', true);
    }

    // 真实写入 user_roles 表
    const userRoleData = {
      user_id: userId,
      user_email: email,
      role_id: roleId,
      company_id: companyId || null,
      expires_at: expires ? new Date(expires).toISOString() : null
    };
    await dbInsert('user_roles', userRoleData);

    // 记录审计日志
    const role = rolesData.find(r => r.id === roleId);
    await writeAuditLog('user:assign_role', `用户：${email}`, `为用户「${email}」分配角色「${role ? role.name : roleId}」`, userId);

    closeModal();
    showToast('角色分配成功');
    renderUsersPerm();
  } catch (err) {
    showToast('分配失败: ' + err.message, true);
  }
}

// ========== 编辑用户角色 ==========
async function editUserRole(recordId) {
  console.log('[editUserRole] called with:', recordId, typeof recordId);
  console.log('[editUserRole] usersPermData ids:', usersPermData.map(u => ({ id: u.id, type: typeof u.id })));
  // 先从内存查找，找不到则从数据库查询
  let record = usersPermData.find(u => String(u.id) === String(recordId));
  console.log('[editUserRole] found in memory:', !!record);
  if (!record) {
    const rows = await supabase.query('user_roles', {
      select: '*,roles(name,data_scope),companies(name)',
      filter: { id: recordId }
    });
    if (!rows || rows.length === 0) return showToast('记录不存在', true);
    record = {
      ...rows[0],
      _role_name: rows[0].roles?.name || rows[0].role_name || rows[0].role_id || '',
      _data_scope: rows[0].roles?.data_scope || rows[0].data_scope || '',
      _company_name: rows[0].companies?.name || rows[0].company_name || rows[0].company_id || '',
      _user_email: rows[0].user_email || rows[0].user_id || ''
    };
  }

  // 加载公司和角色选项
  const [companies, roles] = await Promise.all([
    supabase.query('companies', { select: 'id,name', order: 'name.asc' }),
    supabase.query('roles', { select: 'id,name,data_scope', order: 'name.asc' })
  ]);

  const companyOptions = (companies || []).map(c =>
    `<option value="${c.id}" ${record.company_id === c.id ? 'selected' : ''}>${escapeHtml(c.name || c.id)}</option>`
  ).join('');

  const roleOptions = (roles || []).map(r =>
    `<option value="${r.id}" ${record.role_id === r.id ? 'selected' : ''}>${escapeHtml(r.name)} (${SCOPE_MAP[r.data_scope] || r.data_scope})</option>`
  ).join('');

  const expiresValue = record.expires_at ? record.expires_at.slice(0, 16) : '';

  const content = `
    <div class="form-group">
      <label>用户邮箱</label>
      <input type="email" value="${escapeHtml(record._user_email || record.user_id || '')}" disabled>
    </div>
    <div class="form-group">
      <label>选择角色</label>
      <select id="edit-role-id">
        ${roleOptions}
      </select>
    </div>
    <div class="form-group">
      <label>所属公司</label>
      <select id="edit-company-id">
        <option value="">请选择公司</option>
        ${companyOptions}
      </select>
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
  const companyId = document.getElementById('edit-company-id').value;
  const expires = document.getElementById('edit-expires').value;

  try {
    const updateData = {
      role_id: roleId,
      company_id: companyId || null,
      expires_at: expires ? new Date(expires).toISOString() : null
    };
    await supabase.update('user_roles', updateData, { id: recordId });

    // 记录审计日志
    await writeAuditLog('user:assign_role', `用户权限记录#${recordId}`, `编辑用户角色权限`, recordId);

    closeModal();
    showToast('权限更新成功');
    renderUsersPerm();
  } catch (err) {
    showToast('更新失败: ' + err.message, true);
  }
}

// ========== 移除用户角色（真实删除） ==========
function removeUserRole(recordId, userEmail) {
  showConfirm(
    '移除权限',
    `确定要移除用户「${userEmail}」的角色权限吗？`,
    async () => {
      try {
        await dbDelete('user_roles', { id: recordId });

        // 记录审计日志
        await writeAuditLog('user:remove_role', `用户：${userEmail}`, `移除用户「${userEmail}」的角色权限`, recordId);

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
  // 先尝试用 user_email 查询，再尝试 user_id
  let records = await supabase.query('user_roles', {
    select: '*,roles(name,data_scope)',
    filter: { user_email: userId }
  });

  if (!records || records.length === 0) {
    // 回退：用 user_id 查询
    records = await supabase.query('user_roles', {
      select: '*,roles(name,data_scope)',
      filter: { user_id: userId }
    });
  }

  records = records || [];
  if (records.length === 0) {
    const localRecords = usersPermData.filter(u => (u._user_email || u.user_id) === userId);
    if (localRecords.length === 0) return showToast('未找到该用户的权限记录', true);
  }

  const roleNames = records.map(r => r.roles?.name || r._role_name || r.role_id);

  // 查询这些角色的权限
  const roleIds = records.map(r => r.role_id);
  let allPermIds = new Set();
  if (roleIds.length > 0) {
    const rolePerms = await supabase.query('role_permissions', {
      select: 'permission_id',
      in: { role_id: roleIds.join(',') }
    });
    allPermIds = new Set((rolePerms || []).map(rp => rp.permission_id));
  }

  // 将权限ID映射为名称
  const permLabels = [];
  permissionsData.forEach(group => {
    (group.permissions || []).forEach(p => {
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
        ${roleNames.map(n => `<span class="badge badge-primary">${n || '-'}</span>`).join('')}
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
