// ========== 供应商管理 ==========
let suppliersPage = 1;
let suppliersFilter = { status: '', industry: '', search: '', featured: '' };
const suppliersPageSize = 20;

async function renderSuppliers() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const allSuppliersRaw = await supabase.query('suppliers', {
      select: '*',
      order: 'created_at.desc'
    });

    // 映射数据库字段到UI字段名（兼容历史代码）
    const allSuppliers = (allSuppliersRaw || []).map(s => ({
      ...s,
      auth_id: s.user_id || s.auth_id,
      verification_status: s.is_verified === true ? 'verified' : (s.is_verified === false ? 'pending' : 'pending'),
      industry: Array.isArray(s.category) ? s.category.join('、') : (s.category || s.industry || '')
    }));

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
          <button class="btn btn-outline" onclick="openBatchImport()">📥 批量导入</button>
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
        await supabase.update('suppliers', updateData, { user_id: authId });
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
      filter: { user_id: authId }
    });
    if (!suppliers.length) return showToast('供应商不存在', true);
    const raw = suppliers[0];
    // 映射字段名以兼容UI
    const s = {
      ...raw,
      verification_status: raw.is_verified === true ? 'verified' : 'pending',
      industry: Array.isArray(raw.category) ? raw.category.join('、') : (raw.category || raw.industry || ''),
      auth_id: raw.user_id || raw.auth_id
    };

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
        await supabase.update('suppliers', updateData, { user_id: authId });
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

// ==================== 批量导入供应商 ====================
let batchImportData = [];

function openBatchImport() {
  const content = `
    <div id="batch-import-step1">
      <div style="margin-bottom:16px;padding:16px;background:var(--primary-bg);border-radius:8px;border:1px solid var(--primary-light);">
        <div style="font-weight:500;color:var(--primary);margin-bottom:8px;">📥 Excel批量导入供应商</div>
        <div style="font-size:13px;color:var(--gray-600);line-height:1.6;">
          请上传Excel文件（.xlsx/.xls），必须包含以下列：<br>
          <strong>必填：</strong>公司名称、联系人、邮箱、行业<br>
          <strong>选填：</strong>联系电话、地区、公司简介、简称<br>
          <br>
          系统会自动为每个供应商创建登录账号（默认密码：yicai123）
        </div>
      </div>
      <div style="text-align:center;padding:24px 0;">
        <div style="border:2px dashed var(--gray-300);border-radius:12px;padding:40px 20px;cursor:pointer;transition:all 0.2s;" id="drop-zone" onclick="document.getElementById('batch-excel-file').click()" ondragover="event.preventDefault();this.style.borderColor='var(--primary)';this.style.background='var(--primary-bg)'" ondragleave="this.style.borderColor='var(--gray-300)';this.style.background=''" ondrop="event.preventDefault();this.style.borderColor='var(--gray-300)';this.style.background='';handleExcelFile(event.dataTransfer.files[0])">
          <div style="font-size:48px;margin-bottom:12px;">📄</div>
          <div style="color:var(--gray-600);margin-bottom:8px;">点击选择或拖拽Excel文件到此处</div>
          <div style="font-size:12px;color:var(--gray-400);">支持 .xlsx / .xls 格式</div>
        </div>
        <input type="file" id="batch-excel-file" accept=".xlsx,.xls" style="display:none" onchange="handleExcelFile(this.files[0])">
      </div>
      <div style="text-align:center;">
        <button class="btn btn-outline btn-sm" onclick="downloadImportTemplate()">📋 下载导入模板</button>
      </div>
    </div>
    <div id="batch-import-step2" style="display:none;">
      <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:500;color:var(--gray-800);">数据预览 <span id="batch-import-count" style="color:var(--primary);"></span></div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('batch-import-step2').style.display='none';document.getElementById('batch-import-step1').style.display='';">重新选择</button>
      </div>
      <div style="max-height:320px;overflow:auto;border:1px solid var(--gray-200);border-radius:8px;">
        <table style="width:100%;font-size:12px;">
          <thead style="position:sticky;top:0;background:var(--gray-50);z-index:1;">
            <tr>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--gray-200);">#</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--gray-200);">公司名称</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--gray-200);">联系人</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--gray-200);">邮箱</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--gray-200);">行业</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--gray-200);">状态</th>
            </tr>
          </thead>
          <tbody id="batch-import-preview-body"></tbody>
        </table>
      </div>
      <div id="batch-import-errors" style="display:none;margin-top:12px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" id="batch-import-btn" onclick="executeBatchImport()" style="display:none;">确认导入</button>
  `;

  showModal('批量导入供应商', content, footer);
}

function handleExcelFile(file) {
  if (!file) return;
  
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    showToast('请选择 .xlsx 或 .xls 格式的文件', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!jsonData.length) {
        showToast('Excel文件为空', true);
        return;
      }

      // Map columns (support Chinese and English headers)
      const columnMap = {
        '公司名称': ['公司名称', 'company_name', '公司名', 'name'],
        '简称': ['简称', 'short_name'],
        '联系人': ['联系人', 'contact_name', '联系人姓名'],
        '联系电话': ['联系电话', 'contact_phone', '电话', 'phone', '手机'],
        '邮箱': ['邮箱', 'contact_email', 'email', '联系邮箱'],
        '行业': ['行业', 'industry', '类目', 'category'],
        '地区': ['地区', 'region', '所在地区', '地址'],
        '公司简介': ['公司简介', 'description', '描述', '简介']
      };

      // Detect actual headers
      const headers = Object.keys(jsonData[0]);
      const fieldMap = {};
      for (const [field, aliases] of Object.entries(columnMap)) {
        for (const alias of aliases) {
          const found = headers.find(h => h.trim() === alias || h.trim().toLowerCase() === alias.toLowerCase());
          if (found) {
            fieldMap[field] = found;
            break;
          }
        }
      }

      // Validate required fields
      const required = ['公司名称', '联系人', '邮箱', '行业'];
      const missing = required.filter(f => !fieldMap[f]);
      if (missing.length > 0) {
        showToast(`缺少必填列：${missing.join('、')}。请检查Excel表头。`, true);
        return;
      }

      // Parse data
      batchImportData = jsonData.map((row, idx) => ({
        _row: idx + 2,
        _status: 'ready',
        company_name: String(row[fieldMap['公司名称']] || '').trim(),
        short_name: String(row[fieldMap['简称']] || '').trim(),
        contact_name: String(row[fieldMap['联系人']] || '').trim(),
        contact_phone: String(row[fieldMap['联系电话']] || '').trim(),
        contact_email: String(row[fieldMap['邮箱']] || '').trim(),
        industry: String(row[fieldMap['行业']] || '').trim(),
        region: String(row[fieldMap['地区']] || '').trim(),
        description: String(row[fieldMap['公司简介']] || '').trim()
      }));

      // Validate each row
      const errors = [];
      batchImportData.forEach((row, idx) => {
        if (!row.company_name) errors.push(`第${row._row}行：公司名称为空`);
        if (!row.contact_name) errors.push(`第${row._row}行：联系人为空`);
        if (!row.contact_email) errors.push(`第${row._row}行：邮箱为空`);
        else if (!isValidEmail(row.contact_email)) errors.push(`第${row._row}行：邮箱格式错误（${row.contact_email}）`);
        if (!row.industry) errors.push(`第${row._row}行：行业为空`);
      });

      // Render preview
      const tbody = document.getElementById('batch-import-preview-body');
      tbody.innerHTML = batchImportData.map((row, idx) => {
        const hasError = errors.some(e => e.startsWith(`第${row._row}行`));
        const status = hasError ? '<span style="color:#dc2626;">❌ 数据异常</span>' : '<span style="color:#16a34a;">✅ 就绪</span>';
        return `<tr style="background:${idx % 2 === 0 ? '#fff' : 'var(--gray-50)'};">
          <td style="padding:6px 8px;border-bottom:1px solid var(--gray-100);color:var(--gray-400);">${row._row}</td>
          <td style="padding:6px 8px;border-bottom:1px solid var(--gray-100);font-weight:500;">${escapeHtml(row.company_name)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid var(--gray-100);">${escapeHtml(row.contact_name)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid var(--gray-100);">${escapeHtml(row.contact_email)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid var(--gray-100);">${escapeHtml(row.industry)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid var(--gray-100);">${status}</td>
        </tr>`;
      }).join('');

      document.getElementById('batch-import-count').textContent = `（共${batchImportData.length}条）`;
      document.getElementById('batch-import-step1').style.display = 'none';
      document.getElementById('batch-import-step2').style.display = '';
      document.getElementById('batch-import-btn').style.display = '';

      if (errors.length > 0) {
        const errDiv = document.getElementById('batch-import-errors');
        errDiv.style.display = '';
        errDiv.innerHTML = `<strong>发现${errors.length}个问题：</strong><br>` + errors.slice(0, 10).join('<br>') + (errors.length > 10 ? `<br>...还有${errors.length - 10}个问题` : '');
        document.getElementById('batch-import-btn').disabled = true;
      } else {
        document.getElementById('batch-import-btn').disabled = false;
      }

    } catch (err) {
      showToast('解析Excel失败：' + err.message, true);
    }
  };
  reader.readAsArrayBuffer(file);
}

async function executeBatchImport() {
  const btn = document.getElementById('batch-import-btn');
  btn.disabled = true;
  btn.textContent = '导入中...';

  const validData = batchImportData.filter(row => row.company_name && row.contact_name && row.contact_email && row.industry && isValidEmail(row.contact_email));
  
  let success = 0, failed = 0;
  const failDetails = [];

  for (let i = 0; i < validData.length; i++) {
    const row = validData[i];
    btn.textContent = `导入中... (${i + 1}/${validData.length})`;
    
    try {
      // 1. Create auth account
      let authUserId = null;
      let isNewAccount = true;
      const defaultPassword = 'yicai123';

      try {
        const signUpResult = await supabase.authSignUp(row.contact_email, defaultPassword);
        if (signUpResult?.user) {
          authUserId = signUpResult.user.id;
          if (signUpResult.existingUser) isNewAccount = false;
        }
      } catch (signUpErr) {
        const isExisting = signUpErr.message && (
          /already.*registered/i.test(signUpErr.message) ||
          signUpErr.message.includes('422')
        );
        if (isExisting) {
          isNewAccount = false;
          // 尝试通过 RPC 查找已存在用户的 ID
          try {
            authUserId = await supabase.rpc('get_user_id_by_email', { p_email: row.contact_email });
          } catch (e) { /* ignore */ }
          if (!authUserId) {
            failed++;
            failDetails.push(`${row.company_name}：用户已存在但无法关联`);
            continue;
          }
        } else {
          failed++;
          failDetails.push(`${row.company_name}：${signUpErr.message}`);
          continue;
        }
      }

      if (!authUserId) {
        failed++;
        failDetails.push(`${row.company_name}：无法创建账号`);
        continue;
      }

      // 2. Create company record
      const companyResult = await supabase.insert('companies', {
        name: row.company_name,
        type: 'supplier',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      const companyId = companyResult?.[0]?.id;

      if (!companyId) {
        failed++;
        failDetails.push(`${row.company_name}：创建公司记录失败`);
        continue;
      }

      // 3. Insert supplier record
      await supabase.insert('suppliers', {
        user_id: authUserId,
        company_id: companyId,
        company_name: row.company_name,
        short_name: row.short_name || null,
        category: [row.industry],
        region: row.region || '',
        description: row.description || '',
        contact_name: row.contact_name,
        contact_phone: row.contact_phone || '',
        contact_email: row.contact_email,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      success++;
    } catch (err) {
      failed++;
      failDetails.push(`${row.company_name}：${err.message}`);
    }
  }

  // Show result
  let resultMsg = `导入完成！成功${success}条`;
  if (failed > 0) {
    resultMsg += `，失败${failed}条`;
  }
  
  if (failDetails.length > 0) {
    resultMsg += '\n\n失败详情：\n' + failDetails.join('\n');
  }

  closeModal();
  showToast(resultMsg, failed > 0);
  renderSuppliers();
}

function downloadImportTemplate() {
  const headers = ['公司名称', '简称', '联系人', '联系电话', '邮箱', '行业', '地区', '公司简介'];
  const sampleData = [
    ['广州XX化妆品有限公司', '广州XX', '张三', '13800138000', 'zhangsan@example.com', '护肤品', '广东广州', '专注护肤品研发生产'],
    ['上海YY美妆集团', '上海YY', '李四', '13900139000', 'lisi@example.com', '彩妆', '上海', '彩妆品牌运营商']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  // Set column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2, 15) }));
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '供应商导入模板');
  XLSX.writeFile(wb, '异采供应商批量导入模板.xlsx');
}
