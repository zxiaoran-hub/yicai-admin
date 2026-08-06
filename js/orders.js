// ========== 订单管理（新表 buyer_orders） ==========
let ordersPage = 1;
let ordersFilter = { status: '', search: '' };
const ordersPageSize = 20;

async function renderOrders() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const allOrders = await supabase.query('buyer_orders', {
      select: '*',
      order: 'created_at.desc'
    });

    let filtered = allOrders;
    if (ordersFilter.status) {
      filtered = filtered.filter(o => o.status === ordersFilter.status);
    }
    if (ordersFilter.search) {
      const q = ordersFilter.search.toLowerCase();
      filtered = filtered.filter(o =>
        (o.order_no || '').toLowerCase().includes(q) ||
        (o.supplier_name || '').toLowerCase().includes(q)
      );
    }

    const totalPages = Math.ceil(filtered.length / ordersPageSize) || 1;
    if (ordersPage > totalPages) ordersPage = totalPages;
    const start = (ordersPage - 1) * ordersPageSize;
    const pageData = filtered.slice(start, start + ordersPageSize);

    body.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="搜索订单号/供应商..." value="${ordersFilter.search}" oninput="orderSearch(this.value)">
          <select onchange="orderFilterStatus(this.value)">
            <option value="">全部状态</option>
            <option value="pending" ${ordersFilter.status === 'pending' ? 'selected' : ''}>待处理</option>
            <option value="confirmed" ${ordersFilter.status === 'confirmed' ? 'selected' : ''}>已确认</option>
            <option value="producing" ${ordersFilter.status === 'producing' ? 'selected' : ''}>生产中</option>
            <option value="quality" ${ordersFilter.status === 'quality' ? 'selected' : ''}>质检中</option>
            <option value="completed" ${ordersFilter.status === 'completed' ? 'selected' : ''}>已完成</option>
            <option value="cancelled" ${ordersFilter.status === 'cancelled' ? 'selected' : ''}>已取消</option>
          </select>
          <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 条</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>供应商</th>
              <th>金额</th>
              <th>交期</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">暂无数据</td></tr>` : ''}
            ${pageData.map(o => `
              <tr>
                <td style="font-weight:500;color:var(--gray-900)">${escapeHtml(o.order_no || '-')}</td>
                <td>${escapeHtml(o.supplier_name || '-')}</td>
                <td>${o.total_price ? `¥${Number(o.total_price).toLocaleString()}` : '-'}</td>
                <td>${formatDate(o.delivery_date)}</td>
                <td>${getStatusBadge(o.status)}</td>
                <td>${formatDate(o.created_at)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="viewOrderDetail('${o.id}')">详情</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="orders-pagination"></div>
      </div>
    `;

    renderPagination(
      document.getElementById('orders-pagination'),
      ordersPage,
      totalPages,
      'ordersGoToPage'
    );
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败：${err.message}</p></div>`;
  }
}

let orderSearchTimer;
function orderSearch(val) {
  clearTimeout(orderSearchTimer);
  orderSearchTimer = setTimeout(() => {
    ordersFilter.search = val;
    ordersPage = 1;
    renderOrders();
  }, 300);
}

function orderFilterStatus(val) {
  ordersFilter.status = val;
  ordersPage = 1;
  renderOrders();
}

window.ordersGoToPage = function(page) {
  ordersPage = page;
  renderOrders();
};

async function viewOrderDetail(orderId) {
  try {
    const orders = await supabase.query('buyer_orders', {
      select: '*',
      filter: { id: orderId }
    });
    if (!orders.length) return showToast('订单不存在', true);
    const o = orders[0];

    // 获取关联询价（新表 buyer_inquiries）
    let inquiry = null;
    if (o.inquiry_id) {
      try {
        const inqs = await supabase.query('buyer_inquiries', {
          select: '*',
          filter: { id: o.inquiry_id }
        });
        inquiry = inqs[0] || null;
      } catch (e) { /* ignore */ }
    }

    const content = `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">订单号</span>
          <span class="detail-value">${escapeHtml(o.order_no || '-')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value">${getStatusBadge(o.status)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">供应商</span>
          <span class="detail-value">${escapeHtml(o.supplier_name || '-')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">商品名称</span>
          <span class="detail-value">${escapeHtml(o.product_name || '-')}</span>
        </div>
        ${Array.isArray(o.product_images) && o.product_images.length > 0 ? `
        <div class="detail-item full">
          <span class="detail-label">产品图片</span>
          <span class="detail-value" style="display:flex;flex-wrap:wrap;gap:8px;">
            ${o.product_images.filter(url => !!url).map(url => `
              <img src="${escapeHtml(url)}" alt="产品图" style="height:64px;border-radius:4px;object-fit:cover;" onerror="this.style.display='none'">
            `).join('')}
          </span>
        </div>
        ` : ''}
        <div class="detail-item">
          <span class="detail-label">数量</span>
          <span class="detail-value">${escapeHtml(o.quantity || '-')} ${escapeHtml(o.unit || '')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">单价</span>
          <span class="detail-value">${o.unit_price ? `¥${Number(o.unit_price).toLocaleString()}` : '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">订单金额</span>
          <span class="detail-value">${o.total_price ? `¥${Number(o.total_price).toLocaleString()}` : '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">交期</span>
          <span class="detail-value">${formatDate(o.delivery_date)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">期望交付日期</span>
          <span class="detail-value">${formatDate(o.expected_date)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">${formatDateTime(o.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">更新时间</span>
          <span class="detail-value">${formatDateTime(o.updated_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">关联询价</span>
          <span class="detail-value">${o.inquiry_id ? o.inquiry_id.substring(0, 8) + '...' : '-'}</span>
        </div>
        ${o.notes ? `
        <div class="detail-item full">
          <span class="detail-label">备注</span>
          <span class="detail-value">${escapeHtml(o.notes)}</span>
        </div>
        ` : ''}
      </div>
      ${inquiry ? `
        <div class="sub-table-container">
          <h4>关联询价信息</h4>
          <div class="detail-grid" style="margin-top:8px;">
            <div class="detail-item full">
              <span class="detail-label">询价标题</span>
              <span class="detail-value">${escapeHtml(inquiry.title || '-')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">品类</span>
              <span class="detail-value">${escapeHtml(inquiry.category || '-')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">数量</span>
              <span class="detail-value">${escapeHtml(inquiry.quantity || '-')} ${escapeHtml(inquiry.unit || '')}</span>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    showModal('订单详情', content);
  } catch (err) {
    showToast('加载详情失败: ' + err.message, true);
  }
}
