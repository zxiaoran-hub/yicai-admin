// ========== 供应商管理 ==========
let suppliersPage = 1;
let suppliersFilter = { status: '', industry: '', search: '' };
const suppliersPageSize = 20;

async function renderSuppliers() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const allSuppliers = await supabase.query('suppliers', {
      select: '*',
      order: 'created_at.desc'
    });

    // 获取所有行业
    const industries = [...new Set(allSuppliers.map(s => s.industry).filter(Boolean))];

    // 应用筛选
    let filtered = allSuppliers;
    if (suppliersFilter.status) {
      filtered = filtered.filter(s => s.verification_status === suppliersFilter.status);
    }
    if (suppliersFilter.industry) {
      filtered = filtered.filter(s => s.industry === suppliersFilter.industry);
    }
    if (suppliersFilter.search) {
      const q = suppliersFilter.search.toLowerCase();
      filtered = filtered.filter(s =>
        (s.company_name || '').toLowerCase().includes(q) ||
        (s.contact_name || '').toLowerCase().includes(q) ||
        (s.contact_email || '').toLowerCase().includes(q)
      );
    }

    const totalPages = Math.ceil(filtered.length / suppliersPageSize) || 1;
    if (suppliersPage > totalPages) suppliersPage = totalPages;
    const start = (suppliersPage - 1) * suppliersPageSize;
    const pageData = filtered.slice(start, start + suppliersPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索公司名称/联系人/邮箱..." value="${suppliersFilter.search}" oninput="supplierSearch(this.value)">
          <select onchange="supplierFilterStatus(this.value)">
            <option value="">全部状态</option>
            <option value="pending" ${suppliersFilter.status === 'pending' ? 'selected' : ''}>待审核</option>
            <option value="verified" ${suppliersFilter.status === 'verified' ? 'selected' : ''}>已认证</option>
            <option value="rejected" ${suppliersFilter.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
          </select>
          <select onchange="supplierFilterIndustry(this.value)">
            <option value="">全部行业</option>
            ${industries.map(i => `<option value="${i}" ${suppliersFilter.industry === i ? 'selected' : ''}>${i}</option>`).join('')}
          </select>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 条</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>公司名称</th>
              <th>联系人</th>
              <th>行业</th>
              <th>认证状态</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>` : ''}
            ${pageData.map(s => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${s.company_name || '-'}</td>
                <td>${s.contact_name || '-'}</td>
                <td>${s.industry || '-'}</td>
                <td>${getStatusBadge(s.verification_status)}</td>
                <td>${formatDate(s.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="viewSupplierDetail('${s.auth_id}')">详情</button>
                  ${s.verification_status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="verifySupplier('${s.auth_id}', 'verified')">通过</button>
                    <button class="btn btn-sm btn-danger" onclick="verifySupplier('${s.auth_id}', 'rejected')">拒绝</button>
                  ` : ''}
                  ${s.verification_status === 'rejected' ? `
                    <button class="btn btn-sm btn-success" onclick="verifySupplier('${s.auth_id}', 'verified')">重新认证</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="suppliers-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('suppliers-pagination'),
      suppliersPage,
      totalPages,
      'suppliersGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败：${err.message}</p></div>`;
  }
}

let supplierSearchTimer;
function supplierSearch(val) {
  clearTimeout(supplierSearchTimer);
  supplierSearchTimer = setTimeout(() => {
    suppliersFilter.search = val;
    suppliersPage = 1;
    renderSuppliers();
  }, 300);
}

function supplierFilterStatus(val) {
  suppliersFilter.status = val;
  suppliersPage = 1;
  renderSuppliers();
}

function supplierFilterIndustry(val) {
  suppliersFilter.industry = val;
  suppliersPage = 1;
  renderSuppliers();
}

window.suppliersGoToPage = function(page) {
  suppliersPage = page;
  renderSuppliers();
};

async function viewSupplierDetail(authId) {
  try {
    const suppliers = await supabase.query('suppliers', {
      select: '*',
      filter: { auth_id: authId }
    });
    if (!suppliers.length) return showToast('供应商不存在', true);
    const s = suppliers[0];

    // 获取该供应商的报价历史
    let quotes = [];
    try {
      quotes = await supabase.query('inquiry_quotes', {
        select: '*',
        filter: { supplier_id: authId },
        order: 'created_at.desc'
      });
    } catch (e) { /* ignore */ }

    const content = `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">公司名称</span>
          <span class="detail-value">${s.company_name || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">认证状态</span>
          <span class="detail-value">${getStatusBadge(s.verification_status)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">联系人</span>
          <span class="detail-value">${s.contact_name || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">联系电话</span>
          <span class="detail-value">${s.contact_phone || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">邮箱</span>
          <span class="detail-value">${s.contact_email || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">行业</span>
          <span class="detail-value">${s.industry || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">公司规模</span>
          <span class="detail-value">${s.company_size || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">年采购量</span>
          <span class="detail-value">${s.annual_volume || '-'}</span>
        </div>
        <div class="detail-item full">
          <span class="detail-label">采购品类</span>
          <span class="detail-value">${(s.procurement_categories || []).join('、') || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">注册时间</span>
          <span class="detail-value">${formatDateTime(s.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">认证时间</span>
          <span class="detail-value">${formatDateTime(s.verified_at)}</span>
        </div>
      </div>
      ${quotes.length > 0 ? `
        <div class="sub-table-container">
          <h4>报价历史（${quotes.length}条）</h4>
          <table class="sub-table">
            <thead>
              <tr>
                <th>询价ID</th>
                <th>单价</th>
                <th>起订量</th>
                <th>交期</th>
                <th>状态</th>
                <th>报价时间</th>
              </tr>
            </thead>
            <tbody>
              ${quotes.map(q => `
                <tr>
                  <td>${q.inquiry_id ? q.inquiry_id.substring(0, 8) + '...' : '-'}</td>
                  <td>${q.price || '-'} ${q.currency || ''}</td>
                  <td>${q.moq || '-'}</td>
                  <td>${q.lead_time || '-'}</td>
                  <td>${getStatusBadge(q.status)}</td>
                  <td>${formatDate(q.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="sub-table-container"><h4>报价历史</h4><p style="color:var(--gray-400);font-size:13px;padding:12px 0;">暂无报价记录</p></div>'}
    `;

    let footer = '';
    if (s.verification_status === 'pending') {
      footer = `
        <button class="btn btn-outline" onclick="closeModal()">关闭</button>
        <button class="btn btn-danger" onclick="closeModal();verifySupplier('${s.auth_id}','rejected')">拒绝</button>
        <button class="btn btn-success" onclick="closeModal();verifySupplier('${s.auth_id}','verified')">通过认证</button>
      `;
    }

    showModal(`${s.company_name} - 供应商详情`, content, footer);
  } catch (err) {
    showToast('加载详情失败: ' + err.message, true);
  }
}

async function verifySupplier(authId, status) {
  const action = status === 'verified' ? '通过认证' : '拒绝';
  showConfirm(
    `确认${action}`,
    `确定要${action}该供应商吗？`,
    async () => {
      try {
        const updateData = {
          verification_status: status,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await supabase.update('suppliers', updateData, { auth_id: authId });
        showToast(`${action}成功`);
        renderSuppliers();
      } catch (err) {
        showToast(`${action}失败: ${err.message}`, true);
      }
    }
  );
}
