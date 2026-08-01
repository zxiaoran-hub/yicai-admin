// ========== 供应商管理 ==========
let suppliersPage = 1;
let suppliersFilter = { status: '', industry: '', search: '', featured: '' };
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
    if (suppliersFilter.featured === 'yes') {
      filtered = filtered.filter(s => s.is_featured === true);
    } else if (suppliersFilter.featured === 'no') {
      filtered = filtered.filter(s => s.is_featured !== true);
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
          <select onchange="supplierFilterFeatured(this.value)">
            <option value="">全部</option>
            <option value="yes" ${suppliersFilter.featured === 'yes' ? 'selected' : ''}>⭐ 精选</option>
            <option value="no" ${suppliersFilter.featured === 'no' ? 'selected' : ''}>非精选</option>
          </select>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 条</span>
          <button class="btn btn-primary" onclick="showAddSupplierForm()">+ 新增供应商</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>公司名称</th>
              <th>联系人</th>
              <th>行业</th>
              <th>认证状态</th>
              <th>精选</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>` : ''}
            ${pageData.map(s => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(s.company_name) || '-'}</td>
                <td>${escapeHtml(s.contact_name) || '-'}</td>
                <td>${escapeHtml(s.industry) || '-'}</td>
                <td>${getStatusBadge(s.verification_status)}</td>
                <td>${s.is_featured ? '<span style="color:#f59e0b;font-weight:500;">⭐ 精选</span>' : '<span style="color:var(--gray-400);">-</span>'}</td>
                <td>${formatDate(s.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="viewSupplierDetail('${escapeHtml(s.auth_id)}')">详情</button>
                  ${s.verification_status === 'verified' ? `
                    <button class="btn btn-sm ${s.is_featured ? 'btn-outline' : 'btn-warning'}" onclick="toggleFeatured('${escapeHtml(s.auth_id)}', ${!s.is_featured})" style="${s.is_featured ? '' : 'background:#f59e0b;color:white;border:none;'}">${s.is_featured ? '取消精选' : '设为精选'}</button>
                  ` : ''}
                  ${s.verification_status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="verifySupplier('${escapeHtml(s.auth_id)}', 'verified')">通过</button>
                    <button class="btn btn-sm btn-danger" onclick="verifySupplier('${escapeHtml(s.auth_id)}', 'rejected')">拒绝</button>
                  ` : ''}
                  ${s.verification_status === 'rejected' ? `
                    <button class="btn btn-sm btn-success" onclick="verifySupplier('${escapeHtml(s.auth_id)}', 'verified')">重新认证</button>
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

function supplierFilterFeatured(val) {
  suppliersFilter.featured = val;
  suppliersPage = 1;
  renderSuppliers();
}

// ==================== 精选供应商 ====================
async function toggleFeatured(authId, setFeatured) {
  const action = setFeatured ? '设为精选' : '取消精选';
  showConfirm(
    `确认${action}`,
    `确定要${action}该供应商吗？`,
    async () => {
      try {
        const updateData = {
          is_featured: setFeatured,
          featured_at: setFeatured ? new Date().toISOString() : null,
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
                  <td>${escapeHtml(q.price || '-')} ${escapeHtml(q.currency || '')}</td>
                  <td>${escapeHtml(q.moq || '-')}</td>
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

// ==================== 新增供应商 ====================
function showAddSupplierForm() {
  const content = `
    <form id="add-supplier-form" onsubmit="handleAddSupplier(event)" style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">公司名称 <span style="color:red;">*</span></label>
          <input type="text" id="supplier-company-name" required placeholder="如：广州XX化妆品有限公司" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">简称</label>
          <input type="text" id="supplier-short-name" placeholder="如：广州XX" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">联系人 <span style="color:red;">*</span></label>
          <input type="text" id="supplier-contact-name" required placeholder="联系人姓名" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">联系电话</label>
          <input type="text" id="supplier-contact-phone" placeholder="手机/座机" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">邮箱 <span style="color:red;">*</span></label>
          <input type="email" id="supplier-contact-email" required placeholder="用于登录账号" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">初始密码 <span style="color:red;">*</span></label>
          <input type="text" id="supplier-initial-password" required placeholder="至少6位" value="yicai123" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">行业/类目 <span style="color:red;">*</span></label>
          <select id="supplier-industry" required style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <option value="">请选择</option>
            <option value="护肤品">护肤品</option>
            <option value="彩妆">彩妆</option>
            <option value="香水">香水</option>
            <option value="洗护">洗护</option>
            <option value="包材">包材</option>
            <option value="原料">原料</option>
            <option value="OEM/ODM">OEM/ODM</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">所在地区</label>
          <input type="text" id="supplier-region" placeholder="如：广东广州" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;">
        </div>
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:500;color:var(--gray-700);margin-bottom:4px;">公司简介</label>
        <textarea id="supplier-description" rows="3" placeholder="简要介绍公司业务范围、优势等" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;resize:vertical;"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">创建供应商</button>
      </div>
    </form>
  `;
  showModal('新增供应商', content, '');
}

async function handleAddSupplier(event) {
  event.preventDefault();
  
  const companyName = document.getElementById('supplier-company-name')?.value?.trim();
  const shortName = document.getElementById('supplier-short-name')?.value?.trim();
  const contactName = document.getElementById('supplier-contact-name')?.value?.trim();
  const contactPhone = document.getElementById('supplier-contact-phone')?.value?.trim();
  const contactEmail = document.getElementById('supplier-contact-email')?.value?.trim();
  const initialPassword = document.getElementById('supplier-initial-password')?.value;
  const industry = document.getElementById('supplier-industry')?.value;
  const region = document.getElementById('supplier-region')?.value?.trim();
  const description = document.getElementById('supplier-description')?.value?.trim();

  if (!companyName || !contactName || !contactEmail || !initialPassword || !industry) {
    showToast('请填写所有必填字段');
    return;
  }

  if (initialPassword.length < 6) {
    showToast('初始密码至少6位');
    return;
  }

  try {
    // 第一步：创建或查找 Supabase Auth 账号
    let authUserId = null;
    let isNewAccount = true;

    try {
      console.log('[AddSupplier] Creating auth user for:', contactEmail);
      const signUpResult = await supabase.authSignUp(contactEmail, initialPassword);
      console.log('[AddSupplier] signUp result:', signUpResult);

      if (!signUpResult.user) {
        showToast('创建账号失败');
        return;
      }
      authUserId = signUpResult.user.id;
    } catch (signUpErr) {
      // 用户已存在，尝试查找现有账号
      if (signUpErr.message && signUpErr.message.includes('already registered')) {
        console.log('[AddSupplier] User already exists, looking up by email...');
        isNewAccount = false;

        // 通过 admin API 查找用户
        const headers = await getAuthHeaders();
        const listUrl = `${supabase.url}/admin/users?filter=${encodeURIComponent(contactEmail)}`;
        const listResp = await fetch(listUrl, { method: 'GET', headers });

        if (!listResp.ok) {
          showToast('该邮箱已注册，但无法查询现有账号，请换用其他邮箱');
          return;
        }

        const listData = await listResp.json();
        const existingUser = listData.users?.find(u => u.email.toLowerCase() === contactEmail.toLowerCase());

        if (!existingUser) {
          showToast('该邮箱已注册，但无法找到对应账号');
          return;
        }

        // 检查是否已是供应商
        const existingSupplier = await supabase.query('suppliers', { user_id: `eq.${existingUser.id}` });
        if (existingSupplier && existingSupplier.length > 0) {
          showToast('该邮箱已是供应商');
          return;
        }

        authUserId = existingUser.id;
        console.log('[AddSupplier] Using existing auth user:', authUserId);
      } else {
        throw signUpErr;
      }
    }

    // 第二步：在 companies 表创建公司记录（type='supplier'）
    const companyData = {
      name: companyName,
      type: 'supplier',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[AddSupplier] Creating company record:', companyData);
    const companyResult = await supabase.insert('companies', companyData);
    const companyId = companyResult[0]?.id;

    if (!companyId) {
      showToast('创建公司记录失败');
      return;
    }

    // 第三步：插入 suppliers 表，关联 company_id
    const supplierData = {
      user_id: authUserId,
      company_id: companyId,
      company_name: companyName,
      short_name: shortName || null,
      category: [industry],
      region: region || '',
      description: description || '',
      contact_name: contactName,
      contact_phone: contactPhone || '',
      contact_email: contactEmail,
      is_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[AddSupplier] Inserting supplier:', supplierData);
    const insertResult = await supabase.insert('suppliers', supplierData);
    console.log('[AddSupplier] Insert result:', insertResult);

    const msg = isNewAccount
      ? `供应商创建成功！账号：${contactEmail}，密码：${initialPassword}`
      : `供应商创建成功！已关联现有账号：${contactEmail}`;
    showToast(msg);
    closeModal();
    renderSuppliers();
  } catch (err) {
    console.error('[AddSupplier] Error:', err);
    showToast('创建失败：' + (err.message || '请稍后重试'));
  }
}
