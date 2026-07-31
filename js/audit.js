// ========== 审计日志模块 ==========
let auditData = [];
let auditPage = 1;
let auditFilters = { timeRange: '', operationType: '', search: '' };
const auditPageSize = 20;

// 操作类型映射
const OP_TYPE_MAP = {
  'role:create': '创建角色',
  'role:edit': '编辑角色',
  'role:delete': '删除角色',
  'role:perm_change': '权限变更',
  'user:assign_role': '分配角色',
  'user:remove_role': '移除角色',
  'user:perm_view': '查看权限',
  'company:create': '创建公司',
  'company:edit': '编辑公司',
  'company:team_create': '创建团队',
  'company:team_delete': '删除团队',
  'login': '用户登录',
  'logout': '用户登出',
  'data:export': '数据导出',
  'data:import': '数据导入',
  'supplier:verify': '供应商审核',
  'order:confirm': '订单确认',
  'order:cancel': '订单取消',
};

function getOpTypeLabel(type) {
  return OP_TYPE_MAP[type] || type || '未知操作';
}

function getOpTypeBadge(type) {
  if (type && type.startsWith('role:')) return `<span class="badge badge-primary">${getOpTypeLabel(type)}</span>`;
  if (type && type.startsWith('user:')) return `<span class="badge badge-info">${getOpTypeLabel(type)}</span>`;
  if (type && type.startsWith('company:')) return `<span class="badge badge-warning">${getOpTypeLabel(type)}</span>`;
  if (type && type.startsWith('login') || type === 'logout') return `<span class="badge badge-gray">${getOpTypeLabel(type)}</span>`;
  if (type && type.startsWith('data:')) return `<span class="badge badge-success">${getOpTypeLabel(type)}</span>`;
  if (type && (type.startsWith('supplier:') || type.startsWith('order:'))) return `<span class="badge badge-warning">${getOpTypeLabel(type)}</span>`;
  return `<span class="badge badge-gray">${getOpTypeLabel(type)}</span>`;
}

async function renderAudit() {
  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>加载中...</div>';

  try {
    const logs = await supabase.query('permission_audit_log', {
      select: '*',
      order: 'created_at.desc',
      limit: 500
    });

    auditData = logs || [];

    // 如果数据库没有数据，提供演示数据
    if (auditData.length === 0) {
      auditData = generateDemoAuditData();
    }

    renderAuditPage();
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div><p>加载审计日志失败，请稍后重试</p></div>`;
  }
}

function renderAuditPage() {
  const body = document.getElementById('page-body');
  let filtered = applyAuditFilters(auditData);

  const totalPages = Math.ceil(filtered.length / auditPageSize) || 1;
  if (auditPage > totalPages) auditPage = totalPages;
  const start = (auditPage - 1) * auditPageSize;
  const pageData = filtered.slice(start, start + auditPageSize);

  // 统计操作类型
  const opTypes = [...new Set(auditData.map(l => l.operation_type).filter(Boolean))];

  body.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <input class="search-input" type="text" placeholder="搜索操作人/目标..." value="${auditFilters.search}" oninput="auditSearch(this.value)">
        <select onchange="auditFilterType(this.value)">
          <option value="">全部操作类型</option>
          ${opTypes.map(t => `<option value="${t}" ${auditFilters.operationType === t ? 'selected' : ''}>${getOpTypeLabel(t)}</option>`).join('')}
        </select>
        <select onchange="auditFilterTime(this.value)">
          <option value="">全部时间</option>
          <option value="today" ${auditFilters.timeRange === 'today' ? 'selected' : ''}>今天</option>
          <option value="week" ${auditFilters.timeRange === 'week' ? 'selected' : ''}>最近7天</option>
          <option value="month" ${auditFilters.timeRange === 'month' ? 'selected' : ''}>最近30天</option>
        </select>
        <span style="margin-left:auto;font-size:13px;color:var(--gray-500);">共 ${filtered.length} 条</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>操作人</th>
            <th>操作类型</th>
            <th>操作目标</th>
            <th>详情</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400)">暂无审计记录</td></tr>' : ''}
          ${pageData.map(log => `
            <tr>
              <td style="font-weight:500;color:var(--gray-900)">${log.operator || log.operator_email || '-'}</td>
              <td>${getOpTypeBadge(log.operation_type)}</td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${log.target || ''}">${log.target || '-'}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gray-500);font-size:13px;" title="${log.detail || ''}">${log.detail || '-'}</td>
              <td style="white-space:nowrap;">${formatDateTime(log.created_at)}</td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="viewAuditDetail('${log.id}')">详情</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div id="audit-pagination"></div>
    </div>
  `;

  renderPagination(
    document.getElementById('audit-pagination'),
    auditPage,
    totalPages,
    'auditGoToPage'
  );
}

function applyAuditFilters(data) {
  let filtered = data;

  if (auditFilters.operationType) {
    filtered = filtered.filter(l => l.operation_type === auditFilters.operationType);
  }

  if (auditFilters.timeRange) {
    const now = new Date();
    let startTime;
    if (auditFilters.timeRange === 'today') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (auditFilters.timeRange === 'week') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (auditFilters.timeRange === 'month') {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (startTime) {
      filtered = filtered.filter(l => new Date(l.created_at) >= startTime);
    }
  }

  if (auditFilters.search) {
    const q = auditFilters.search.toLowerCase();
    filtered = filtered.filter(l =>
      (l.operator || '').toLowerCase().includes(q) ||
      (l.operator_email || '').toLowerCase().includes(q) ||
      (l.target || '').toLowerCase().includes(q)
    );
  }

  return filtered;
}

window.auditGoToPage = function(page) {
  auditPage = page;
  renderAuditPage();
};

let auditSearchTimer;
function auditSearch(val) {
  clearTimeout(auditSearchTimer);
  auditSearchTimer = setTimeout(() => {
    auditFilters.search = val;
    auditPage = 1;
    renderAuditPage();
  }, 300);
}

function auditFilterType(val) {
  auditFilters.operationType = val;
  auditPage = 1;
  renderAuditPage();
}

function auditFilterTime(val) {
  auditFilters.timeRange = val;
  auditPage = 1;
  renderAuditPage();
}

// ========== 查看详情 ==========
function viewAuditDetail(logId) {
  const log = auditData.find(l => l.id === logId);
  if (!log) return showToast('记录不存在', true);

  const content = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">操作人</span>
        <span class="detail-value">${log.operator || log.operator_email || '-'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">操作人ID</span>
        <span class="detail-value" style="font-family:monospace;font-size:12px;">${log.operator_id || '-'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">操作类型</span>
        <span class="detail-value">${getOpTypeBadge(log.operation_type)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">操作目标</span>
        <span class="detail-value">${log.target || '-'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">目标ID</span>
        <span class="detail-value" style="font-family:monospace;font-size:12px;">${log.target_id || '-'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">操作时间</span>
        <span class="detail-value">${formatDateTime(log.created_at)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">IP地址</span>
        <span class="detail-value">${log.ip_address || '-'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">User Agent</span>
        <span class="detail-value" style="font-size:12px;word-break:break-all;">${log.user_agent || '-'}</span>
      </div>
      <div class="detail-item full">
        <span class="detail-label">操作详情</span>
        <span class="detail-value" style="font-size:13px;line-height:1.6;">${log.detail || '无详细信息'}</span>
      </div>
      ${log.before_data || log.after_data ? `
        <div class="detail-item full">
          <span class="detail-label">变更前</span>
          <pre style="background:var(--gray-50);padding:12px;border-radius:var(--radius);font-size:12px;overflow-x:auto;max-height:200px;border:1px solid var(--gray-200);">${log.before_data ? JSON.stringify(JSON.parse(log.before_data), null, 2) : '无'}</pre>
        </div>
        <div class="detail-item full">
          <span class="detail-label">变更后</span>
          <pre style="background:var(--primary-bg);padding:12px;border-radius:var(--radius);font-size:12px;overflow-x:auto;max-height:200px;border:1px solid var(--gray-200);">${log.after_data ? JSON.stringify(JSON.parse(log.after_data), null, 2) : '无'}</pre>
        </div>
      ` : ''}
    </div>
  `;

  showModal('审计日志详情', content, '<button class="btn btn-outline" onclick="closeModal()">关闭</button>');
}

// 生成演示审计数据
function generateDemoAuditData() {
  const operators = ['admin@yicai.app', 'manager@yicai.app', 'hr@yicai.app'];
  const opTypes = Object.keys(OP_TYPE_MAP);
  const targets = ['角色：采购经理', '用户：zhangsan@yicai.app', '公司：广州美妆集团', '角色：运营管理员', '团队：华东采购组'];
  const details = [
    '修改了角色的数据权限范围为「本公司」',
    '为用户分配了「采购经理」角色',
    '创建了新的子公司关联关系',
    '调整了权限树中的3项按钮权限',
    '删除了自定义角色「临时查看」',
    '导出了平台用户权限汇总数据',
    '审核通过了供应商「上海化妆品有限公司」',
    '确认了订单 ORD-20260730-001',
  ];

  const data = [];
  for (let i = 0; i < 35; i++) {
    const date = new Date();
    date.setHours(date.getHours() - Math.floor(Math.random() * 720));
    data.push({
      id: 'log_' + (1000 + i),
      operator: operators[Math.floor(Math.random() * operators.length)],
      operator_email: operators[Math.floor(Math.random() * operators.length)],
      operator_id: 'user_' + Math.random().toString(36).substr(2, 8),
      operation_type: opTypes[Math.floor(Math.random() * opTypes.length)],
      target: targets[Math.floor(Math.random() * targets.length)],
      target_id: 'id_' + Math.random().toString(36).substr(2, 8),
      detail: details[Math.floor(Math.random() * details.length)],
      ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      created_at: date.toISOString()
    });
  }
  return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
