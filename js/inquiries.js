// ========== 询价管理 ==========
let inquiriesPage = 1;
let inquiriesFilter = { status: '', search: '' };
const inquiriesPageSize = 20;

async function renderInquiries() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const allInquiries = await supabase.query('inquiries', {
      select: '*',
      order: 'created_at.desc'
    });

    let filtered = allInquiries;
    if (inquiriesFilter.status) {
      filtered = filtered.filter(i => i.status === inquiriesFilter.status);
    }
    if (inquiriesFilter.search) {
      const q = inquiriesFilter.search.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }

    const totalPages = Math.ceil(filtered.length / inquiriesPageSize) || 1;
    if (inquiriesPage > totalPages) inquiriesPage = totalPages;
    const start = (inquiriesPage - 1) * inquiriesPageSize;
    const pageData = filtered.slice(start, start + inquiriesPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索标题/品类/描述..." value="${inquiriesFilter.search}" oninput="inquirySearch(this.value)">
          <select onchange="inquiryFilterStatus(this.value)">
            <option value="">全部状态</option>
            <option value="active" ${inquiriesFilter.status === 'active' ? 'selected' : ''}>进行中</option>
            <option value="closed" ${inquiriesFilter.status === 'closed' ? 'selected' : ''}>已关闭</option>
            <option value="completed" ${inquiriesFilter.status === 'completed' ? 'selected' : ''}>已完成</option>
            <option value="cancelled" ${inquiriesFilter.status === 'cancelled' ? 'selected' : ''}>已取消</option>
          </select>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 条</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>品类</th>
              <th>数量</th>
              <th>预算</th>
              <th>交期</th>
              <th>状态</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>` : ''}
            ${pageData.map(i => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.title || '-'}</td>
                <td>${i.category || '-'}</td>
                <td>${i.quantity || '-'} ${i.unit || ''}</td>
                <td>${formatBudget(i.budget_min, i.budget_max)}</td>
                <td>${formatDate(i.delivery_date)}</td>
                <td>${getStatusBadge(i.status)}</td>
                <td>${formatDate(i.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="viewInquiryDetail('${i.id}')">详情</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="inquiries-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('inquiries-pagination'),
      inquiriesPage,
      totalPages,
      'inquiriesGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败：${err.message}</p></div>`;
  }
}

function formatBudget(min, max) {
  if (!min && !max) return '-';
  if (min && max) return `¥${Number(min).toLocaleString()} - ¥${Number(max).toLocaleString()}`;
  if (min) return `¥${Number(min).toLocaleString()}+`;
  return `≤¥${Number(max).toLocaleString()}`;
}

let inquirySearchTimer;
function inquirySearch(val) {
  clearTimeout(inquirySearchTimer);
  inquirySearchTimer = setTimeout(() => {
    inquiriesFilter.search = val;
    inquiriesPage = 1;
    renderInquiries();
  }, 300);
}

function inquiryFilterStatus(val) {
  inquiriesFilter.status = val;
  inquiriesPage = 1;
  renderInquiries();
}

window.inquiriesGoToPage = function(page) {
  inquiriesPage = page;
  renderInquiries();
};

async function viewInquiryDetail(inquiryId) {
  try {
    const inquiries = await supabase.query('inquiries', {
      select: '*',
      filter: { id: inquiryId }
    });
    if (!inquiries.length) return showToast('询价不存在', true);
    const i = inquiries[0];

    // 获取关联报价
    let quotes = [];
    try {
      quotes = await supabase.query('inquiry_quotes', {
        select: '*',
        filter: { inquiry_id: inquiryId },
        order: 'created_at.desc'
      });
    } catch (e) { /* ignore */ }

    const content = `
      <div class="detail-grid">
        <div class="detail-item full">
          <span class="detail-label">标题</span>
          <span class="detail-value">${i.title || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">品类</span>
          <span class="detail-value">${i.category || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value">${getStatusBadge(i.status)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">数量</span>
          <span class="detail-value">${i.quantity || '-'} ${i.unit || ''}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">预算范围</span>
          <span class="detail-value">${formatBudget(i.budget_min, i.budget_max)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">期望交期</span>
          <span class="detail-value">${formatDate(i.delivery_date)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">交货地点</span>
          <span class="detail-value">${i.delivery_location || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">匿名发布</span>
          <span class="detail-value">${i.is_anonymous ? '是' : '否'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">需要NDA</span>
          <span class="detail-value">${i.nda_required ? '是' : '否'}</span>
        </div>
        <div class="detail-item full">
          <span class="detail-label">描述</span>
          <span class="detail-value">${i.description || '-'}</span>
        </div>
        <div class="detail-item full">
          <span class="detail-label">偏好认证</span>
          <span class="detail-value">${(i.preferred_certifications || []).join('、') || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">发布时间</span>
          <span class="detail-value">${formatDateTime(i.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">采购方</span>
          <span class="detail-value">${i.buyer_display_name || i.buyer_id || '-'}</span>
        </div>
      </div>
      ${quotes.length > 0 ? `
        <div class="sub-table-container">
          <h4>收到的报价（${quotes.length}条）</h4>
          <table class="sub-table">
            <thead>
              <tr>
                <th>供应商</th>
                <th>公司</th>
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
                  <td>${q.supplier_name || '-'}</td>
                  <td>${q.supplier_company || '-'}</td>
                  <td>${q.price || '-'}</td>
                  <td>${q.moq || '-'}</td>
                  <td>${q.lead_time || '-'}</td>
                  <td>${getStatusBadge(q.status)}</td>
                  <td>${formatDate(q.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="sub-table-container"><h4>收到的报价</h4><p style="color:var(--gray-400);font-size:13px;padding:12px 0;">暂无报价</p></div>'}
    `;

    showModal('询价详情', content);
  } catch (err) {
    showToast('加载详情失败: ' + err.message, true);
  }
}
