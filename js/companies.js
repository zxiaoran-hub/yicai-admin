// ========== 公司管理模块 ==========
let companiesData = [];
let companiesPage = 1;
const companiesPageSize = 20;

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
              <th>关联母公司</th>
              <th>团队数</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">暂无公司数据，点击「新建公司」创建</td></tr>' : ''}
            ${pageData.map(c => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${c.name || '-'}</td>
                <td>${typeBadge(c.company_type)}</td>
                <td>${c.parent_company_name || c.parent_company_id || '-'}</td>
                <td><span style="color:var(--primary);font-weight:500;cursor:pointer;" onclick="viewTeams('${c.id}')">${c.team_count || 0} 个团队</span></td>
                <td>${statusBadge(c.status)}</td>
                <td>${formatDate(c.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="openEditCompany('${c.id}')">编辑</button>
                  <button class="btn btn-sm btn-outline" onclick="viewTeams('${c.id}')">团队</button>
                  <button class="btn btn-sm btn-outline" onclick="openCompanyRelation('${c.id}')">关联</button>
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
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🏢</div><p>加载公司数据失败，请稍后重试</p></div>`;
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
      (c.name || '').toLowerCase().includes(q) ||
      (c.parent_company_name || '').toLowerCase().includes(q)
    );
    renderCompaniesTable(filtered);
  }, 300);
}

function filterCompanyType(val) {
  const filtered = val ? companiesData.filter(c => c.company_type === val) : companiesData;
  renderCompaniesTable(filtered);
}

function renderCompaniesTable(data) {
  const tbody = document.querySelector('.table-container tbody');
  if (!tbody) return;
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">未找到匹配的公司</td></tr>';
    return;
  }
  const typeBadge = (type) => {
    const map = {
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
      <td>${typeBadge(c.company_type)}</td>
      <td>${c.parent_company_name || c.parent_company_id || '-'}</td>
      <td><span style="color:var(--primary);font-weight:500;cursor:pointer;" onclick="viewTeams('${c.id}')">${c.team_count || 0} 个团队</span></td>
      <td>${statusBadge(c.status)}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openEditCompany('${c.id}')">编辑</button>
        <button class="btn btn-sm btn-outline" onclick="viewTeams('${c.id}')">团队</button>
        <button class="btn btn-sm btn-outline" onclick="openCompanyRelation('${c.id}')">关联</button>
      </td>
    </tr>
  `).join('');
}

// ========== 创建/编辑公司 ==========
function openCreateCompany() {
  const parentOptions = companiesData
    .filter(c => c.company_type === 'parent' || c.company_type === 'independent')
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join('');

  const content = `
    <div class="form-group">
      <label>公司名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="company-name" placeholder="输入公司全称" maxlength="100">
    </div>
    <div class="form-group">
      <label>公司类型</label>
      <select id="company-type">
        <option value="independent">独立公司</option>
        <option value="parent">母公司</option>
        <option value="subsidiary">子公司</option>
        <option value="partner">合作伙伴</option>
      </select>
    </div>
    <div class="form-group">
      <label>关联母公司（可选）</label>
      <select id="company-parent">
        <option value="">无</option>
        ${parentOptions}
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

function openEditCompany(companyId) {
  const company = companiesData.find(c => c.id === companyId);
  if (!company) return showToast('公司不存在', true);

  const parentOptions = companiesData
    .filter(c => c.id !== companyId && (c.company_type === 'parent' || c.company_type === 'independent'))
    .map(c => `<option value="${c.id}" ${company.parent_company_id === c.id ? 'selected' : ''}>${c.name}</option>`)
    .join('');

  const content = `
    <div class="form-group">
      <label>公司名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="company-name" value="${company.name || ''}" maxlength="100">
    </div>
    <div class="form-group">
      <label>公司类型</label>
      <select id="company-type">
        <option value="independent" ${company.company_type === 'independent' ? 'selected' : ''}>独立公司</option>
        <option value="parent" ${company.company_type === 'parent' ? 'selected' : ''}>母公司</option>
        <option value="subsidiary" ${company.company_type === 'subsidiary' ? 'selected' : ''}>子公司</option>
        <option value="partner" ${company.company_type === 'partner' ? 'selected' : ''}>合作伙伴</option>
      </select>
    </div>
    <div class="form-group">
      <label>关联母公司</label>
      <select id="company-parent">
        <option value="">无</option>
        ${parentOptions}
      </select>
    </div>
    <div class="form-group">
      <label>状态</label>
      <select id="company-status">
        <option value="active" ${company.status === 'active' ? 'selected' : ''}>启用</option>
        <option value="pending" ${company.status === 'pending' ? 'selected' : ''}>待审核</option>
        <option value="inactive" ${company.status === 'inactive' ? 'selected' : ''}>停用</option>
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

async function saveCompany() {
  const name = document.getElementById('company-name').value.trim();
  const type = document.getElementById('company-type').value;
  const parent = document.getElementById('company-parent').value;
  const status = document.getElementById('company-status').value;
  const remark = document.getElementById('company-remark').value.trim();

  if (!name) return showToast('请输入公司名称', true);

  try {
    const newCompany = {
      id: 'comp_' + Date.now(),
      name,
      company_type: type,
      parent_company_id: parent || null,
      parent_company_name: parent ? (companiesData.find(c => c.id === parent)?.name || '') : null,
      status,
      remark,
      team_count: 0,
      created_at: new Date().toISOString()
    };
    companiesData.unshift(newCompany);
    closeModal();
    showToast('公司创建成功');
    renderCompanies();
  } catch (err) {
    showToast('创建失败: ' + err.message, true);
  }
}

async function updateCompany(companyId) {
  const name = document.getElementById('company-name').value.trim();
  const type = document.getElementById('company-type').value;
  const parent = document.getElementById('company-parent').value;
  const status = document.getElementById('company-status').value;
  const remark = document.getElementById('company-remark').value.trim();

  if (!name) return showToast('请输入公司名称', true);

  const idx = companiesData.findIndex(c => c.id === companyId);
  if (idx >= 0) {
    companiesData[idx] = {
      ...companiesData[idx],
      name,
      company_type: type,
      parent_company_id: parent || null,
      parent_company_name: parent ? (companiesData.find(c => c.id === parent)?.name || '') : null,
      status,
      remark,
    };
  }

  closeModal();
  showToast('公司更新成功');
  renderCompanies();
}

// ========== 公司关联管理 ==========
function openCompanyRelation(companyId) {
  const company = companiesData.find(c => c.id === companyId);
  if (!company) return showToast('公司不存在', true);

  const relatedCompanies = (company.related_companies || []);
  const availableCompanies = companiesData.filter(c => c.id !== companyId);

  const content = `
    <div style="margin-bottom:16px;">
      <h4 style="font-size:15px;color:var(--gray-800);margin-bottom:8px;">关联公司管理</h4>
      <p style="font-size:13px;color:var(--gray-500);">管理「${company.name}」与其他公司的关联关系</p>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:6px;display:block;">添加关联公司</label>
      <div style="display:flex;gap:8px;">
        <select id="relation-company-select" style="flex:1;padding:8px 12px;border:1px solid var(--gray-200);border-radius:var(--radius);font-size:13px;">
          <option value="">选择要关联的公司</option>
          ${availableCompanies.map(c => `<option value="${c.id}">${c.name} (${c.company_type || '未知'})</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="addRelation('${companyId}')">添加</button>
      </div>
    </div>
    <div>
      <h4 style="font-size:14px;color:var(--gray-700);margin-bottom:8px;">已关联公司（${relatedCompanies.length}家）</h4>
      ${relatedCompanies.length === 0 ? '<p style="color:var(--gray-400);font-size:13px;">暂无关联公司</p>' : ''}
      <div id="relation-list">
        ${relatedCompanies.map(rc => `
          <div class="relation-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--gray-100);border-radius:var(--radius);margin-bottom:8px;">
            <div>
              <span style="font-weight:500;color:var(--gray-800);">${rc.name || rc.id}</span>
              <span class="badge badge-gray" style="margin-left:8px;font-size:11px;">${rc.relation_type || '关联'}</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeRelation('${companyId}','${rc.id}')">移除</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const footer = `<button class="btn btn-outline" onclick="closeModal()">关闭</button>`;
  showModal('公司关联 - ' + company.name, content, footer);
}

function addRelation(companyId) {
  const select = document.getElementById('relation-company-select');
  const targetId = select.value;
  if (!targetId) return showToast('请选择要关联的公司', true);

  const company = companiesData.find(c => c.id === companyId);
  const target = companiesData.find(c => c.id === targetId);
  if (!company || !target) return;

  if (!company.related_companies) company.related_companies = [];
  if (!company.related_companies.find(rc => rc.id === targetId)) {
    company.related_companies.push({ id: targetId, name: target.name, relation_type: '关联' });
    showToast('关联成功');
    openCompanyRelation(companyId); // 刷新弹窗内容
  } else {
    showToast('该公司已关联', true);
  }
}

function removeRelation(companyId, targetId) {
  const company = companiesData.find(c => c.id === companyId);
  if (!company) return;
  company.related_companies = (company.related_companies || []).filter(rc => rc.id !== targetId);
  showToast('已移除关联');
  openCompanyRelation(companyId);
}

// ========== 团队管理 ==========
function viewTeams(companyId) {
  const company = companiesData.find(c => c.id === companyId);
  if (!company) return showToast('公司不存在', true);

  const teams = company.teams || [];

  const content = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="font-size:15px;color:var(--gray-800);">「${company.name}」的团队</h4>
        <button class="btn btn-sm btn-primary" onclick="openCreateTeam('${companyId}')">+ 新建团队</button>
      </div>
    </div>
    ${teams.length === 0 ? '<div class="empty-state" style="padding:30px;"><div class="empty-icon">👥</div><p>暂无团队，点击「新建团队」创建</p></div>' : ''}
    <div id="teams-list">
      ${teams.map(t => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid var(--gray-100);border-radius:var(--radius);margin-bottom:8px;">
          <div>
            <div style="font-weight:500;color:var(--gray-800);margin-bottom:4px;">${t.name}</div>
            <div style="font-size:12px;color:var(--gray-400);">${t.description || '无描述'} · ${t.member_count || 0} 名成员</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="editTeam('${companyId}','${t.id}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTeam('${companyId}','${t.id}')">删除</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const footer = `<button class="btn btn-outline" onclick="closeModal()">关闭</button>`;
  showModal('团队管理', content, footer);
}

function openCreateTeam(companyId) {
  const content = `
    <div class="form-group">
      <label>团队名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="team-name" placeholder="如：采购部、华东区团队" maxlength="50">
    </div>
    <div class="form-group">
      <label>团队描述</label>
      <textarea id="team-desc" placeholder="团队职责描述..." rows="3"></textarea>
    </div>
  `;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveTeam('${companyId}')">创建团队</button>
  `;
  showModal('新建团队', content, footer);
}

function saveTeam(companyId) {
  const name = document.getElementById('team-name').value.trim();
  const desc = document.getElementById('team-desc').value.trim();
  if (!name) return showToast('请输入团队名称', true);

  const company = companiesData.find(c => c.id === companyId);
  if (!company) return;
  if (!company.teams) company.teams = [];

  company.teams.push({
    id: 'team_' + Date.now(),
    name,
    description: desc,
    member_count: 0,
    created_at: new Date().toISOString()
  });
  company.team_count = company.teams.length;

  closeModal();
  showToast('团队创建成功');
  viewTeams(companyId); // 刷新团队列表弹窗
}

function editTeam(companyId, teamId) {
  const company = companiesData.find(c => c.id === companyId);
  if (!company) return;
  const team = (company.teams || []).find(t => t.id === teamId);
  if (!team) return;

  const content = `
    <div class="form-group">
      <label>团队名称 <span style="color:var(--danger)">*</span></label>
      <input type="text" id="team-name" value="${team.name || ''}" maxlength="50">
    </div>
    <div class="form-group">
      <label>团队描述</label>
      <textarea id="team-desc" rows="3">${team.description || ''}</textarea>
    </div>
  `;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="updateTeam('${companyId}','${teamId}')">更新</button>
  `;
  showModal('编辑团队', content, footer);
}

function updateTeam(companyId, teamId) {
  const name = document.getElementById('team-name').value.trim();
  const desc = document.getElementById('team-desc').value.trim();
  if (!name) return showToast('请输入团队名称', true);

  const company = companiesData.find(c => c.id === companyId);
  if (!company) return;
  const team = (company.teams || []).find(t => t.id === teamId);
  if (!team) return;

  team.name = name;
  team.description = desc;

  closeModal();
  showToast('团队更新成功');
  viewTeams(companyId);
}

function deleteTeam(companyId, teamId) {
  showConfirm('删除团队', '确定要删除该团队吗？团队成员将失去团队归属。', () => {
    const company = companiesData.find(c => c.id === companyId);
    if (!company) return;
    company.teams = (company.teams || []).filter(t => t.id !== teamId);
    company.team_count = company.teams.length;
    showToast('团队已删除');
    viewTeams(companyId);
  });
}
