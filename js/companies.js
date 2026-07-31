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
                <td style="font-weight:500;color:var(--gray-900)">${c.name || '-'}</td>
                <td>${typeBadge(c.type || c.company_type)}</td>
                <td>${statusBadge(c.status)}</td>
                <td>${formatDate(c.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="openEditCompany('${c.id}')">编辑</button>
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
      <td style="font-weight:500;color:var(--gray-900)">${c.name || '-'}</td>
      <td>${typeBadge(c.type || c.company_type)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openEditCompany('${c.id}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCompany('${c.id}','${(c.name || '').replace(/'/g, "\\'")}')">删除</button>
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
      status,
      remark: remark || null
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
      status,
      remark: remark || null
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
