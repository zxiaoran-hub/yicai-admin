// ========== 采购方管理 ==========
let buyersPage = 1;
let buyersFilter = { search: '' };
const buyersPageSize = 20;
let buyersData = [];

async function renderBuyers() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    // 从 companies 表查询 type='buyer' 的记录
    const allCompanies = await supabase.query('companies', {
      select: '*',
      order: 'created_at.desc'
    });

    // 过滤采购方
    buyersData = (allCompanies || []).filter(c => c.type === 'buyer');

    // 获取每个采购方的管理员信息
    const buyersWithAdmin = await Promise.all(
      buyersData.map(async (c) => {
        try {
          const roles = await supabase.query('user_roles', {
            select: 'user_id,user_email',
            filter: { company_id: c.id }
          });
          return { ...c, admin_email: roles?.[0]?.user_email || '', admin_id: roles?.[0]?.user_id || '' };
        } catch (e) {
          return { ...c, admin_email: '', admin_id: '' };
        }
      })
    );
    buyersData = buyersWithAdmin;

    let filtered = buyersData;
    if (buyersFilter.search) {
      const q = buyersFilter.search.toLowerCase();
      filtered = filtered.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.admin_email || '').toLowerCase().includes(q)
      );
    }

    const totalPages = Math.ceil(filtered.length / buyersPageSize) || 1;
    if (buyersPage > totalPages) buyersPage = totalPages;
    const start = (buyersPage - 1) * buyersPageSize;
    const pageData = filtered.slice(start, start + buyersPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <button class="btn btn-primary" onclick="showAddBuyerForm()">+ 新增企业采购方</button>
          <input class="search-input" type="text" placeholder="搜索公司名/管理员邮箱..." value="${buyersFilter.search}" oninput="buyerSearch(this.value)">
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 家</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>公司名称</th>
              <th>管理员邮箱</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>` : ''}
            ${pageData.map(b => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${b.name || '-'}</td>
                <td>${b.admin_email || '-'}</td>
                <td>${getStatusBadge(b.status || 'active')}</td>
                <td>${formatDate(b.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="viewBuyerDetail('${b.id}')">详情</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="buyers-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('buyers-pagination'),
      buyersPage,
      totalPages,
      'buyersGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败：${err.message}</p></div>`;
  }
}

let buyerSearchTimer;
function buyerSearch(val) {
  clearTimeout(buyerSearchTimer);
  buyerSearchTimer = setTimeout(() => {
    buyersFilter.search = val;
    buyersPage = 1;
    renderBuyers();
  }, 300);
}

window.buyersGoToPage = function(page) {
  buyersPage = page;
  renderBuyers();
};

// ==================== 新增企业采购方 ====================
window.showAddBuyerForm = function() {
  const content = `
    <form id="add-buyer-form" onsubmit="handleAddBuyer(event)" style="display:flex;flex-direction:column;gap:16px;">
      <div>
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">公司名称 <span style="color:#ef4444">*</span></label>
        <input type="text" id="buyer-company-name" class="form-input" placeholder="公司全称" required>
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">管理员姓名 <span style="color:#ef4444">*</span></label>
        <input type="text" id="buyer-admin-name" class="form-input" placeholder="管理员真实姓名" required>
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">管理员邮箱 <span style="color:#ef4444">*</span></label>
        <input type="email" id="buyer-admin-email" class="form-input" placeholder="登录账号" required>
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;">初始密码 <span style="color:#ef4444">*</span></label>
        <input type="text" id="buyer-initial-password" class="form-input" placeholder="至少6位" required>
      </div>
      <div style="padding:12px;background:var(--gray-50);border-radius:8px;font-size:12px;color:var(--gray-500);">
        💡 创建后将自动：创建登录账号 → 创建公司记录 → 分配企业采购管理员角色
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">创建</button>
      </div>
    </form>
  `;
  showModal('新增企业采购方', content);
};

window.handleAddBuyer = async function(event) {
  event.preventDefault();

  const companyName = document.getElementById('buyer-company-name')?.value?.trim();
  const adminName = document.getElementById('buyer-admin-name')?.value?.trim();
  const adminEmail = document.getElementById('buyer-admin-email')?.value?.trim();
  const initialPassword = document.getElementById('buyer-initial-password')?.value;

  if (!companyName || !adminName || !adminEmail || !initialPassword) {
    showToast('请填写所有必填字段');
    return;
  }
  if (initialPassword.length < 6) {
    showToast('初始密码至少6位');
    return;
  }

  try {
    // 第一步：创建 Auth 账号
    let authUserId = null;
    let isNewAccount = true;

    try {
      console.log('[AddBuyer] Creating auth user for:', adminEmail);
      const signUpResult = await supabase.authSignUp(adminEmail, initialPassword);
      if (!signUpResult.user) {
        showToast('创建账号失败');
        return;
      }
      authUserId = signUpResult.user.id;
    } catch (signUpErr) {
      if (signUpErr.message && signUpErr.message.includes('already registered')) {
        console.log('[AddBuyer] User already exists, looking up...');
        isNewAccount = false;

        const headers = await getAuthHeaders();
        const listUrl = `${supabase.url}/admin/users?filter=${encodeURIComponent(adminEmail)}`;
        const listResp = await fetch(listUrl, { method: 'GET', headers });

        if (!listResp.ok) {
          showToast('该邮箱已注册，但无法查询现有账号');
          return;
        }

        const listData = await listResp.json();
        const existingUser = listData.users?.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());

        if (!existingUser) {
          showToast('该邮箱已注册，但无法找到对应账号');
          return;
        }

        // 检查是否已有公司
        const existingRoles = await supabase.query('user_roles', { user_id: `eq.${existingUser.id}` });
        if (existingRoles?.some(r => r.company_id)) {
          showToast('该用户已关联企业');
          return;
        }

        authUserId = existingUser.id;
      } else {
        throw signUpErr;
      }
    }

    // 第二步：创建公司记录（type='buyer'）
    const companyData = {
      name: companyName,
      type: 'buyer',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[AddBuyer] Creating company:', companyData);
    const companyResult = await supabase.insert('companies', companyData);
    const companyId = companyResult[0]?.id;

    if (!companyId) {
      showToast('创建公司记录失败');
      return;
    }

    // 第三步：查找企业管理员角色
    const roles = await supabase.query('roles', {
      name: 'ilike.%company%admin%',
      is_system: 'eq.true'
    });

    let roleId = null;
    if (roles && roles.length > 0) {
      roleId = roles[0].id;
    } else {
      // 如果没有找到公司管理员角色，尝试找默认的企业角色
      const defaultRoles = await supabase.query('roles', {
        name: 'ilike.%buyer%',
        is_system: 'eq.true'
      });
      if (defaultRoles && defaultRoles.length > 0) {
        roleId = defaultRoles[0].id;
      }
    }

    // 第四步：创建 user_roles 关联
    const userRoleData = {
      user_id: authUserId,
      role_id: roleId,
      company_id: companyId,
      user_email: adminEmail,
      created_at: new Date().toISOString()
    };

    console.log('[AddBuyer] Creating user_role:', userRoleData);
    await supabase.insert('user_roles', userRoleData);

    const msg = isNewAccount
      ? `企业采购方创建成功！管理员账号：${adminEmail}，密码：${initialPassword}`
      : `企业采购方创建成功！已关联现有账号：${adminEmail}`;
    showToast(msg);
    closeModal();
    renderBuyers();
  } catch (err) {
    console.error('[AddBuyer] Error:', err);
    showToast('创建失败：' + (err.message || '请稍后重试'));
  }
};

// ==================== 查看详情 ====================
async function viewBuyerDetail(companyId) {
  try {
    const buyer = buyersData.find(b => b.id == companyId);
    if (!buyer) return showToast('采购方不存在', true);

    const content = `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">公司名称</span>
          <span class="detail-value">${buyer.name || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">管理员邮箱</span>
          <span class="detail-value">${buyer.admin_email || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value">${getStatusBadge(buyer.status || 'active')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">${formatDateTime(buyer.created_at)}</span>
        </div>
      </div>
    `;

    showModal(`${buyer.name} - 企业采购方详情`, content);
  } catch (err) {
    showToast('加载详情失败: ' + err.message, true);
  }
}
