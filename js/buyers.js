// ========== 采购方管理 ==========
let buyersPage = 1;
let buyersFilter = { search: '' };
const buyersPageSize = 20;

async function renderBuyers() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const allBuyers = await supabase.query('buyers', {
      select: '*',
      order: 'created_at.desc'
    });

    let filtered = allBuyers;
    if (buyersFilter.search) {
      const q = buyersFilter.search.toLowerCase();
      filtered = filtered.filter(b =>
        (b.company_name || '').toLowerCase().includes(q) ||
        (b.contact_name || '').toLowerCase().includes(q) ||
        (b.brand_name || '').toLowerCase().includes(q) ||
        (b.phone || '').includes(q)
      );
    }

    const totalPages = Math.ceil(filtered.length / buyersPageSize) || 1;
    if (buyersPage > totalPages) buyersPage = totalPages;
    const start = (buyersPage - 1) * buyersPageSize;
    const pageData = filtered.slice(start, start + buyersPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索公司名/品牌/联系人/电话..." value="${buyersFilter.search}" oninput="buyerSearch(this.value)">
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 条</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>公司名称</th>
              <th>品牌</th>
              <th>联系人</th>
              <th>行业</th>
              <th>认证状态</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>` : ''}
            ${pageData.map(b => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${b.company_name || '-'}</td>
                <td>${b.brand_name || '-'}</td>
                <td>${b.contact_name || '-'}</td>
                <td>${b.industry || '-'}</td>
                <td>${getStatusBadge(b.verification_status || 'pending')}</td>
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

async function viewBuyerDetail(buyerId) {
  try {
    const buyers = await supabase.query('buyers', {
      select: '*',
      filter: { id: buyerId }
    });
    if (!buyers.length) return showToast('采购方不存在', true);
    const b = buyers[0];

    // 获取该采购方发布的询价
    let inquiries = [];
    try {
      inquiries = await supabase.query('inquiries', {
        select: '*',
        filter: { buyer_id: buyerId },
        order: 'created_at.desc'
      });
    } catch (e) { /* ignore */ }

    const content = `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">公司名称</span>
          <span class="detail-value">${b.company_name || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">品牌名称</span>
          <span class="detail-value">${b.brand_name || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">联系人</span>
          <span class="detail-value">${b.contact_name || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">联系电话</span>
          <span class="detail-value">${b.contact_phone || b.phone || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">邮箱</span>
          <span class="detail-value">${b.contact_email || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">行业</span>
          <span class="detail-value">${b.industry || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">公司规模</span>
          <span class="detail-value">${b.company_size || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">年采购量</span>
          <span class="detail-value">${b.annual_volume || '-'}</span>
        </div>
        <div class="detail-item full">
          <span class="detail-label">采购品类</span>
          <span class="detail-value">${(b.procurement_categories || []).join('、') || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">注册时间</span>
          <span class="detail-value">${formatDateTime(b.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">认证状态</span>
          <span class="detail-value">${getStatusBadge(b.verification_status || 'pending')}</span>
        </div>
      </div>
      ${inquiries.length > 0 ? `
        <div class="sub-table-container">
          <h4>发布的询价（${inquiries.length}条）</h4>
          <table class="sub-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>品类</th>
                <th>数量</th>
                <th>状态</th>
                <th>发布时间</th>
              </tr>
            </thead>
            <tbody>
              ${inquiries.map(i => `
                <tr>
                  <td>${i.title || '-'}</td>
                  <td>${i.category || '-'}</td>
                  <td>${i.quantity || '-'} ${i.unit || ''}</td>
                  <td>${getStatusBadge(i.status)}</td>
                  <td>${formatDate(i.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="sub-table-container"><h4>发布的询价</h4><p style="color:var(--gray-400);font-size:13px;padding:12px 0;">暂无询价记录</p></div>'}
    `;

    showModal(`${b.company_name} - 采购方详情`, content);
  } catch (err) {
    showToast('加载详情失败: ' + err.message, true);
  }
}
