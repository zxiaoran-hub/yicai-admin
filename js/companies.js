// ========== 公司管理模块 ==========
let companiesData = [];
let companiesPage = 1;
const companiesPageSize = 20;

// 公司类型映射
const COMPANY_TYPE_MAP = {
  'platform': '平台',
  'buyer': '采购方',
  'supplier': '供应商',
  'parent': '母公司',
  'subsidiary': '子公司',
  'partner': '合作伙伴',
  'independent': '独立公司'
};

async function renderCompanies() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const companies = await supabase.query('companies', {
      select: '*',
      order: 'created_at.desc'
    });

    companiesData = companies || [];

    const totalPages = Math.ceil(companiesData.length / companiesPageSize) || 1;
    if (companiesPage > totalPages) companiesPage = totalPages;
    const start = (companiesPage - 1) * companiesPageSize;
    const pageData = companiesData.slice(start, start + companiesPageSize);

    const typeBadge = (type) => {
      const map = {
        'platform': '<span class="badge badge-primary">平台</span>',
        'buyer': '<span class="badge badge-info">采购方</span>',
        'supplier': '<span class="badge badge-warning">供应商</span>',
        'parent': '<span class="badge badge-primary">母公司</span>',
        'subsidiary': '<span class="badge badge-info">子公司</span>',
        'partner': '<span class="badge badge-warning">合作伙伴</span>',
        'independent': '<span class="badge badge-gray">独立公司</span>',
      };
      return map[type] || `<span class="badge badge-gray">${type || '未知'}</span>`;
    };

    const statusBadge = (status) => {
      if (status === 'active') return '<span class="badge badge-success">启用</span>';
      if (status === 'inactive') return '<span class="badge badge-gray">停用</span>';
      if (status === 'pending') return '<span class="badge badge-warning">待审核</span>';
      return `<span class="badge badge-gray">${status || '未知'}</span>`;
    };

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索公司名称..." oninput="filterCompanies(this.value)">
          <select onchange="filterCompanyType(this.value)">
            <option value="">全部类型</option>
            <option value="platform">平台</option>
            <option value="buyer">采购方</option>
            <option value="supplier">供应商</option>
            <option value="parent">母公司</option>
            <option value="subsidiary">子公司</option>
            <option value="partner">合作伙伴</option>
            <option value="independent">独立公司</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="openCreateCompany()">+ 新建公司</button>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${companiesData.length} 家</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>公司名称</th>
              <th>公司类型</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">暂无公司数据，点击「新建公司」创建</td></tr>' : ''}
            ${pageData.map(c => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(c.name || '-'}</td>
                <td>${typeBadge(c.type || c.company_type)}</td>
                <td>${statusBadge(c.status)}</td>
                <td>${formatDate(c.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="openEditCompany('${c.id}')">编辑</button>
                  ${c.type !== 'platform' ? `<button class="btn btn-sm btn-primary" onclick="openCreateCompanyAdmin('${c.id}')">创建管理员</button>` : ''}
                  <button class="btn btn-sm btn-danger" onclick="deleteCompany('${c.id}','${(c.name || '').replace(/'/g, "\\'")}')">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="companies-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('companies-pagination'),
      companiesPage,
      totalPages,
      'companiesGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🏢</div><p>加载公司数据失败：${err.message}</p></div>`;
  }
}

window.companiesGoToPage = function(page) {
  companiesPage = page;
  renderCompanies();
};

let companiesSearchTimer;
function filterCompanies(val) {
  clearTimeout(companiesSearchTimer);
  companiesSearchTimer = setTimeout(() => {
    const q = val.toLowerCase();
    const filtered = companiesData.filter(c =>
      (c.name || '').toLowerCase().includes(q)
    );
    renderCompaniesTable(filtered);
  }, 300);
}

function filterCompanyType(val) {
  const filtered = val ? companiesData.filter(c => (c.type || c.company_type) === val) : companiesData;
  renderCompaniesTable(filtered);
}

function renderCompaniesTable(data) {
  const tbody = document.querySelector('.table-container tbody');
  if (!tbody) return;
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">未找到匹配的公司</td></tr>';
    return;
  }
  const typeBadge = (type) => {
    const map = {
      'platform': '<span class="badge badge-primary">平台</span>',
      'buyer': '<span class="badge badge-info">采购方</span>',
      'supplier': '<span class="badge badge-warning">供应商</span>',
      'parent': '<span class="badge badge-primary">母公司</span>',
      'subsidiary': '<span class="badge badge-info">子公司</span>',
      'partner': '<span class="badge badge-warning">合作伙伴</span>',
      'independent': '<span class="badge badge-gray">独立公司</span>',
    };
    return map[type] || `<span class="badge badge-gray">${type || '未知'}</span>`;
  };
  const statusBadge = (status) => {
    if (status === 'active') return '<span class="badge badge-success">启用</span>';
    if (status === 'inactive') return '<span class="badge badge-gray">停用</span>';
    if (status === 'pending') return '<span class="badge badge-warning">待审核</span>';
    return `<span class="badge badge-gray">${status || '未知'}</span>`;
  };
  tbody.innerHTML = data.slice(0, companiesPageSize).map(c => `
    <tr>
      <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(c.name || '-')}</td>
      <td>${typeBadge(c.type || c.company_type)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openEditCompany('${c.id}')">编辑</button>
        ${c.type !== 'platform' ? `<button class="btn btn-sm btn-primary" onclick="openCreateCompanyAdmin('${c.id}')">创建管理员</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteCompany('${c.id}','${escapeHtml(c.name || '').replace(/'/g, "\\'")}')">删除</button>
      </td>
    </tr>
  `).join('');
}

// ========== 创建公司（真实写入数据库） ==========
function openCreateCompany() {
  const content = `
    <div class="form-group">
      <label>公司名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="company-name" placeholder="输入公司全称" maxlength="100">
    </div>
    <div class="form-group">
      <label>公司类型</label>
      <select id="company-type">
        <option value="buyer">采购方</option>
        <option value="supplier">供应商</option>
        <option value="platform">平台</option>
      </select>
    </div>
    <div class="form-group">
      <label>状态</label>
      <select id="company-status">
        <option value="active">启用</option>
        <option value="pending">待审核</option>
        <option value="inactive">停用</option>
      </select>
    </div>
    <div class="form-group">
      <label>备注</label>
      <textarea id="company-remark" placeholder="备注信息..." rows="3"></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveCompany()">保存</button>
  `;

  showModal('新建公司', content, footer);
}

async function saveCompany() {
  const name = document.getElementById('company-name').value.trim();
  const type = document.getElementById('company-type').value;
  const status = document.getElementById('company-status').value;
  const remark = document.getElementById('company-remark').value.trim();

  if (!name) return showToast('请输入公司名称', true);

  try {
    const companyData = {
      name,
      type,
      status
    };

    // 真实写入数据库
    await dbInsert('companies', companyData);

    // 审计日志
    if (typeof writeAuditLog === 'function') {
      await writeAuditLog('company:create', `公司：${name}`, `创建公司「${name}」，类型：${COMPANY_TYPE_MAP[type] || type}`, null, null, companyData);
    }

    closeModal();
    showToast('公司创建成功');
    renderCompanies();
  } catch (err) {
    showToast('创建失败: ' + err.message, true);
  }
}

// ========== 编辑公司 ==========
function openEditCompany(companyId) {
  const company = companiesData.find(c => c.id === companyId);
  if (!company) return showToast('公司不存在', true);

  const currentType = company.type || company.company_type || 'buyer';
  const currentStatus = company.status || 'active';

  const content = `
    <div class="form-group">
      <label>公司名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="company-name" value="${company.name || ''}" maxlength="100">
    </div>
    <div class="form-group">
      <label>公司类型</label>
      <select id="company-type">
        <option value="buyer" ${currentType === 'buyer' ? 'selected' : ''}>采购方</option>
        <option value="supplier" ${currentType === 'supplier' ? 'selected' : ''}>供应商</option>
        <option value="platform" ${currentType === 'platform' ? 'selected' : ''}>平台</option>
        <option value="parent" ${currentType === 'parent' ? 'selected' : ''}>母公司</option>
        <option value="subsidiary" ${currentType === 'subsidiary' ? 'selected' : ''}>子公司</option>
        <option value="partner" ${currentType === 'partner' ? 'selected' : ''}>合作伙伴</option>
        <option value="independent" ${currentType === 'independent' ? 'selected' : ''}>独立公司</option>
      </select>
    </div>
    <div class="form-group">
      <label>状态</label>
      <select id="company-status">
        <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>启用</option>
        <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>待审核</option>
        <option value="inactive" ${currentStatus === 'inactive' ? 'selected' : ''}>停用</option>
      </select>
    </div>
    <div class="form-group">
      <label>备注</label>
      <textarea id="company-remark" rows="3">${company.remark || ''}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="updateCompany('${companyId}')">更新</button>
  `;

  showModal('编辑公司 - ' + company.name, content, footer);
}

async function updateCompany(companyId) {
  const name = document.getElementById('company-name').value.trim();
  const type = document.getElementById('company-type').value;
  const status = document.getElementById('company-status').value;
  const remark = document.getElementById('company-remark').value.trim();

  if (!name) return showToast('请输入公司名称', true);

  try {
    const oldData = companiesData.find(c => c.id === companyId);
    await supabase.update('companies', {
      name,
      type,
      status
    }, { id: companyId });

    // 审计日志
    if (typeof writeAuditLog === 'function') {
      await writeAuditLog('company:edit', `公司：${name}`, `编辑公司「${name}」`, companyId, oldData, { name, type, status, remark });
    }

    closeModal();
    showToast('公司更新成功');
    renderCompanies();
  } catch (err) {
    showToast('更新失败: ' + err.message, true);
  }
}

// ========== 创建公司管理员 ==========
function openCreateCompanyAdmin(companyId) {
  const company = companiesData.find(c => c.id == companyId);
  if (!company) return showToast('公司不存在', true);
  if (company.type === 'platform') return showToast('平台公司不需要创建管理员', true);

  const typeName = company.type === 'supplier' ? '供应商' : '品牌方';
  const content = `
    <div style="margin-bottom:16px;padding:12px;background:var(--gray-50);border-radius:8px;">
      <div style="font-weight:500;color:var(--gray-700);">为「${company.name}」创建${typeName}公司管理员</div>
      <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">管理员将拥有本公司角色管理和员工管理权限</div>
    </div>
    <div class="form-group">
      <label>管理员邮箱 <span style="color:var(--danger)">*</span></label>
      <input type="email" id="admin-email" placeholder="输入管理员邮箱">
    </div>
    <div class="form-group">
      <label>初始密码 <span style="color:var(--danger)">*</span></label>
      <input type="password" id="admin-password" placeholder="至少6位" minlength="6">
    </div>
    <div class="form-group">
      <label>姓名</label>
      <input type="text" id="admin-name" placeholder="管理员姓名">
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveCompanyAdmin('${companyId}', '${company.type}')">创建管理员</button>
  `;

  showModal('创建公司管理员', content, footer);
}

async function saveCompanyAdmin(companyId, companyType) {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const name = document.getElementById('admin-name').value.trim();

  if (!email) return showToast('请输入邮箱', true);
  if (!password || password.length < 6) return showToast('密码至少6位', true);

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '创建中...';

  try {
    // 1. 创建认证账号
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
      throw new Error(errData.error_description || errData.msg || `创建账号失败(${signUpResp.status})`);
    }

    const signUpResult = await signUpResp.json();
    const userId = signUpResult.user?.id;
    if (!userId) throw new Error('创建账号成功但未返回用户ID');

    // 2. 查找或创建公司管理员角色
    let adminRole = await supabase.query('roles', {
      select: '*',
      filter: { company_id: companyId, name: `${companyType === 'supplier' ? '供应商' : '品牌方'}公司管理员` }
    });

    let roleId;
    if (adminRole && adminRole.length > 0) {
      roleId = adminRole[0].id;
    } else {
      // 创建公司管理员角色
      const newRole = await dbInsert('roles', {
        company_id: parseInt(companyId),
        name: `${companyType === 'supplier' ? '供应商' : '品牌方'}公司管理员`,
        description: `${companyType === 'supplier' ? '供应商' : '品牌方'}公司管理员，拥有本公司管理权限`,
        is_system: true,
        data_scope: 'company'
      });
      roleId = newRole[0]?.id;
      if (!roleId) throw new Error('创建管理员角色失败');

      // 关联公司管理权限
      const permKeys = ['menu:product', 'btn:product:create', 'btn:product:edit', 'btn:product:delete', 'btn:product:publish',
        'menu:inquiry', 'btn:inquiry:create', 'btn:inquiry:edit', 'btn:inquiry:delete',
        'menu:quote', 'btn:quote:create', 'btn:quote:edit', 'btn:quote:accept',
        'menu:order', 'btn:order:create', 'btn:order:edit', 'btn:order:confirm', 'btn:order:cancel',
        'menu:supplier', 'btn:supplier:view',
        'menu:role', 'btn:role:create', 'btn:role:edit', 'btn:role:delete', 'btn:role:assign',
        'menu:user', 'btn:user:create', 'btn:user:edit', 'btn:user:delete', 'btn:user:assign_role',
        'menu:dashboard', 'menu:audit_log'];
      for (const key of permKeys) {
        const perm = await supabase.query('permissions', { select: 'id', filter: { button_key: key } });
        if (perm && perm.length > 0) {
          await dbInsert('role_permissions', { role_id: roleId, permission_id: perm[0].id });
        }
      }
    }

    // 3. 关联用户角色
    await dbInsert('user_roles', {
      user_id: userId,
      role_id: roleId,
      company_id: parseInt(companyId),
      user_email: email
    });

    // 审计日志
    if (typeof writeAuditLog === 'function') {
      await writeAuditLog('user:create', `管理员：${email}`, `为公司创建管理员「${email}」`, userId);
    }

    closeModal();
    showToast('公司管理员创建成功！' + (signUpResult.user?.confirmation_sent_at ? '（需要邮箱验证）' : ''));
  } catch (err) {
    showToast('创建失败: ' + err.message, true);
    btn.disabled = false;
    btn.textContent = '创建管理员';
  }
}

// ========== 删除公司（真实删除） ==========
function deleteCompany(companyId, companyName) {
  showConfirm(
    '删除公司',
    `确定要删除公司「${companyName}」吗？`,
    async () => {
      try {
        await dbDelete('companies', { id: companyId });

        if (typeof writeAuditLog === 'function') {
          await writeAuditLog('company:edit', `公司：${companyName}`, `删除公司「${companyName}」`, companyId);
        }

        showToast('公司已删除');
        renderCompanies();
      } catch (err) {
        showToast('删除失败: ' + err.message, true);
      }
    }
  );
}
