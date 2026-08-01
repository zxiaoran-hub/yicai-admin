// ========== 数据看板 ==========
async function renderDashboard() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    // 并行查询所有数据
    const [
      suppliers,
      buyers,
      inquiries,
      quotes,
      orders
    ] = await Promise.all([
      supabase.query('suppliers', { select: 'is_verified,created_at' }),
      supabase.query('buyers', { select: 'created_at' }),
      supabase.query('inquiries', { select: 'status,created_at' }),
      supabase.query('inquiry_quotes', { select: 'id,created_at' }),
      supabase.query('orders', { select: 'status,created_at' })
    ]);

    // 统计数据
    const totalSuppliers = suppliers.length;
    const totalBuyers = buyers.length;
    const activeInquiries = inquiries.filter(i => i.status === 'active').length;
    const totalQuotes = quotes.length;
    const totalOrders = orders.length;

    // 本月新增用户
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const newSuppliers = suppliers.filter(s => s.created_at >= monthStart).length;
    const newBuyers = buyers.filter(b => b.created_at >= monthStart).length;
    const newUsers = newSuppliers + newBuyers;

    // 供应商状态分布（使用 is_verified 布尔字段）
    const verifiedCount = suppliers.filter(s => s.is_verified === true).length;
    const pendingCount = suppliers.filter(s => s.is_verified !== true).length;
    const rejectedCount = 0; // is_verified 为布尔值，暂无 rejected 状态

    // 询价状态分布
    const activeCount = inquiries.filter(i => i.status === 'active').length;
    const closedCount = inquiries.filter(i => i.status === 'closed').length;
    const completedCount = inquiries.filter(i => i.status === 'completed').length;
    const cancelledCount = inquiries.filter(i => i.status === 'cancelled').length;

    // 订单状态分布
    const orderStatuses = {};
    orders.forEach(o => {
      orderStatuses[o.status] = (orderStatuses[o.status] || 0) + 1;
    });

    // 最近7天趋势
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push({
        date: d.toISOString().split('T')[0],
        label: `${d.getMonth() + 1}/${d.getDate()}`
      });
    }

    const inquiryByDay = last7Days.map(day => {
      const count = inquiries.filter(i => {
        const created = i.created_at ? i.created_at.split('T')[0] : '';
        return created === day.date;
      }).length;
      return { ...day, count };
    });

    const quoteByDay = last7Days.map(day => {
      const count = quotes.filter(q => {
        const created = q.created_at ? q.created_at.split('T')[0] : '';
        return created === day.date;
      }).length;
      return { ...day, count };
    });

    const maxInquiry = Math.max(...inquiryByDay.map(d => d.count), 1);
    const maxQuote = Math.max(...quoteByDay.map(d => d.count), 1);

    // 供应商状态分布百分比
    const totalVerif = verifiedCount + pendingCount + rejectedCount || 1;

    // 询价状态分布百分比
    const totalInq = activeCount + closedCount + completedCount + cancelledCount || 1;

    // 订单状态标签映射
    const orderStatusLabels = {
      'pending': '待处理',
      'confirmed': '已确认',
      'producing': '生产中',
      'quality': '质检中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    const orderStatusColors = {
      'pending': 'yellow',
      'confirmed': 'blue',
      'producing': 'teal',
      'quality': 'yellow',
      'completed': 'green',
      'cancelled': 'red'
    };

    body.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal">🏭</div>
          <div class="stat-value">${totalSuppliers}</div>
          <div class="stat-label">供应商总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">🛒</div>
          <div class="stat-value">${totalBuyers}</div>
          <div class="stat-label">采购方总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">📋</div>
          <div class="stat-value">${activeInquiries}</div>
          <div class="stat-label">进行中询价</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">💬</div>
          <div class="stat-value">${totalQuotes}</div>
          <div class="stat-label">总报价数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📦</div>
          <div class="stat-value">${totalOrders}</div>
          <div class="stat-label">订单总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">👤</div>
          <div class="stat-value">${newUsers}</div>
          <div class="stat-label">本月新增用户</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <h3>供应商认证状态</h3>
          <div class="status-distribution">
            <div class="status-row">
              <span class="status-label">已认证</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill green" style="width:${(verifiedCount/totalVerif*100).toFixed(1)}%">${verifiedCount > 0 ? verifiedCount : ''}</div>
              </div>
              <span class="status-count">${verifiedCount}</span>
            </div>
            <div class="status-row">
              <span class="status-label">待审核</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill yellow" style="width:${(pendingCount/totalVerif*100).toFixed(1)}%">${pendingCount > 0 ? pendingCount : ''}</div>
              </div>
              <span class="status-count">${pendingCount}</span>
            </div>
            <div class="status-row">
              <span class="status-label">已拒绝</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill red" style="width:${(rejectedCount/totalVerif*100).toFixed(1)}%">${rejectedCount > 0 ? rejectedCount : ''}</div>
              </div>
              <span class="status-count">${rejectedCount}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <h3>采购需求状态</h3>
          <div class="status-distribution">
            <div class="status-row">
              <span class="status-label">进行中</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill green" style="width:${(activeCount/totalInq*100).toFixed(1)}%">${activeCount > 0 ? activeCount : ''}</div>
              </div>
              <span class="status-count">${activeCount}</span>
            </div>
            <div class="status-row">
              <span class="status-label">已关闭</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill yellow" style="width:${(closedCount/totalInq*100).toFixed(1)}%">${closedCount > 0 ? closedCount : ''}</div>
              </div>
              <span class="status-count">${closedCount}</span>
            </div>
            <div class="status-row">
              <span class="status-label">已完成</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill blue" style="width:${(completedCount/totalInq*100).toFixed(1)}%">${completedCount > 0 ? completedCount : ''}</div>
              </div>
              <span class="status-count">${completedCount}</span>
            </div>
            <div class="status-row">
              <span class="status-label">已取消</span>
              <div class="status-bar-bg">
                <div class="status-bar-fill red" style="width:${(cancelledCount/totalInq*100).toFixed(1)}%">${cancelledCount > 0 ? cancelledCount : ''}</div>
              </div>
              <span class="status-count">${cancelledCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <h3>近7天询价趋势</h3>
          <div class="bar-chart">
            ${inquiryByDay.map(d => `
              <div class="bar-group">
                <div class="bar-value">${d.count}</div>
                <div class="bar" style="height:${Math.max((d.count/maxInquiry*100), 3)}%"></div>
                <div class="bar-label">${d.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="chart-card">
          <h3>近7天报价趋势</h3>
          <div class="bar-chart">
            ${quoteByDay.map(d => `
              <div class="bar-group">
                <div class="bar-value">${d.count}</div>
                <div class="bar" style="height:${Math.max((d.count/maxQuote*100), 3)}%;background:var(--accent)"></div>
                <div class="bar-label">${d.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      ${Object.keys(orderStatuses).length > 0 ? `
      <div class="charts-row">
        <div class="chart-card">
          <h3>订单状态分布</h3>
          <div class="status-distribution">
            ${Object.entries(orderStatuses).map(([status, count]) => {
              const total = orders.length || 1;
              return `
                <div class="status-row">
                  <span class="status-label">${orderStatusLabels[status] || status}</span>
                  <div class="status-bar-bg">
                    <div class="status-bar-fill ${orderStatusColors[status] || 'blue'}" style="width:${(count/total*100).toFixed(1)}%">${count}</div>
                  </div>
                  <span class="status-count">${count}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      ` : ''}
    `;
  } catch (err) {
    console.error('Dashboard error:', err);
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>加载数据失败：${err.message}</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="navigateTo('dashboard')">重试</button>
      </div>
    `;
  }
}
