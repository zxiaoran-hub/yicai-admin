// ========== 全局状态 ==========
let currentUser = null;
let currentPage = 'dashboard';
let sidebarOpen = false;

// ========== 认证 ==========
function saveSession(data) {
  secureStorage.setToken(data.access_token, data.refresh_token);
  currentUser = data.user;
}

function loadSession() {
  const token = secureStorage.getToken();
  if (!token) return null;
  // 简单解析JWT获取用户信息
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUser = { id: payload.sub, email: payload.email };
    return { access_token: token, user: currentUser };
  } catch (e) {
    secureStorage.clearToken();
    return null;
  }
}

function logout() {
  secureStorage.clearToken();
  currentUser = null;
  showLogin();
}

// ========== 路由 ==========
function navigateTo(page) {
  currentPage = page;
  // 更新导航高亮
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  // 渲染页面内容
  const body = document.getElementById('page-body');
  const title = document.getElementById('page-title');
  const subtitle = document.getElementById('page-subtitle');

  switch (page) {
    case 'dashboard':
      title.textContent = '数据看板';
      subtitle.textContent = '平台运营数据概览';
      renderDashboard();
      break;
    case 'suppliers':
      title.textContent = '供应商管理';
      subtitle.textContent = '管理供应商信息与认证审核';
      renderSuppliers();
      break;
    case 'buyers':
      title.textContent = '采购方管理';
      subtitle.textContent = '管理采购方信息';
      renderBuyers();
      break;
    case 'inquiries':
      title.textContent = '询价管理';
      subtitle.textContent = '查看和管理所有采购需求';
      renderInquiries();
      break;
    case 'orders':
      title.textContent = '订单管理';
      subtitle.textContent = '查看和管理所有订单';
      renderOrders();
      break;
    case 'roles':
      title.textContent = '角色管理';
      subtitle.textContent = '管理系统角色与权限配置';
      renderRoles();
      break;
    case 'users-perm':
      title.textContent = '用户权限';
      subtitle.textContent = '管理用户角色分配与权限';
      renderUsersPerm();
      break;
    case 'companies':
      title.textContent = '公司管理';
      subtitle.textContent = '管理公司与团队信息';
      renderCompanies();
      break;
    case 'audit':
      title.textContent = '审计日志';
      subtitle.textContent = '查看权限操作审计记录';
      renderAudit();
      break;
    case 'settings':
      title.textContent = '平台设置';
      subtitle.textContent = '平台基础配置';
      renderSettings();
      break;
  }
  // 关闭移动端侧边栏
  closeSidebar();
}

// ========== 初始化 ==========
function initApp() {
  const session = loadSession();
  if (session) {
    showApp();
    navigateTo('dashboard');
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('app-root').innerHTML = `
    <div class="login-page">
      <div class="login-container">
        <div class="login-logo">
          <div class="logo-icon">异</div>
          <h1>异采 YiCai</h1>
          <p>管理后台</p>
        </div>
        <div class="login-error" id="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label>管理员邮箱</label>
            <input type="email" id="login-email" placeholder="admin@yicai.app" required>
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" id="login-password" placeholder="请输入密码" required>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="login-btn">登 录</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = '登录中...';
  errorEl.style.display = 'none';

  try {
    const data = await supabase.signIn(email, password);
    saveSession(data);
    showApp();
    navigateTo('dashboard');
  } catch (err) {
    errorEl.textContent = err.message || '登录失败，请检查邮箱和密码';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

function showApp() {
  document.getElementById('app-root').innerHTML = `
    <div class="app-layout">
      <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="closeSidebar()"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="logo-icon">异</div>
          <div>
            <div class="logo-text">异采</div>
            <div class="logo-sub">管理后台</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-title">主菜单</div>
          <div class="nav-item active" data-page="dashboard" onclick="navigateTo('dashboard')">
            <span class="nav-icon">📊</span>
            <span>数据看板</span>
          </div>
          <div class="nav-section-title">业务管理</div>
          <div class="nav-item" data-page="suppliers" onclick="navigateTo('suppliers')">
            <span class="nav-icon">🏭</span>
            <span>供应商管理</span>
          </div>
          <div class="nav-item" data-page="buyers" onclick="navigateTo('buyers')">
            <span class="nav-icon">🛒</span>
            <span>采购方管理</span>
          </div>
          <div class="nav-item" data-page="inquiries" onclick="navigateTo('inquiries')">
            <span class="nav-icon">📋</span>
            <span>询价管理</span>
          </div>
          <div class="nav-item" data-page="orders" onclick="navigateTo('orders')">
            <span class="nav-icon">📦</span>
            <span>订单管理</span>
          </div>
          <div class="nav-section-title">权限管理</div>
          <div class="nav-item" data-page="roles" onclick="navigateTo('roles')">
            <span class="nav-icon">🔑</span>
            <span>角色管理</span>
          </div>
          <div class="nav-item" data-page="users-perm" onclick="navigateTo('users-perm')">
            <span class="nav-icon">👤</span>
            <span>用户权限</span>
          </div>
          <div class="nav-item" data-page="companies" onclick="navigateTo('companies')">
            <span class="nav-icon">🏢</span>
            <span>公司管理</span>
          </div>
          <div class="nav-item" data-page="audit" onclick="navigateTo('audit')">
            <span class="nav-icon">📜</span>
            <span>审计日志</span>
          </div>
          <div class="nav-section-title">系统</div>
          <div class="nav-item" data-page="settings" onclick="navigateTo('settings')">
            <span class="nav-icon">⚙️</span>
            <span>平台设置</span>
          </div>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">管</div>
            <span>${currentUser?.email || 'admin'}</span>
            <span class="logout-btn" onclick="logout()" title="退出登录">⏻</span>
          </div>
        </div>
      </aside>
      <main class="main-content">
        <header class="page-header">
          <div>
            <button class="mobile-menu-btn" onclick="toggleSidebar()">☰</button>
            <h2 class="page-title" id="page-title">数据看板</h2>
            <p class="page-subtitle" id="page-subtitle">平台运营数据概览</p>
          </div>
        </header>
        <div class="page-body" id="page-body"></div>
      </main>
    </div>
    <div id="modal-root"></div>
    <div id="toast-root"></div>
  `;
}

// ========== 侧边栏控制 ==========
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  document.getElementById('sidebar-backdrop').classList.toggle('show', sidebarOpen);
}

function closeSidebar() {
  sidebarOpen = false;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('show');
}

// ========== 工具函数 ==========
function showToast(message, isError = false) {
  const root = document.getElementById('toast-root');
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.innerHTML = `<span>${isError ? '⚠️' : '✅'}</span><span>${escapeHtml(message)}</span>`;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showModal(title, content, footer = '') {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay show" id="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
      document.getElementById('modal-root').innerHTML = '';
    }, 200);
  }
}

function showConfirm(title, message, onConfirm) {
  const div = document.createElement('div');
  div.className = 'confirm-overlay';
  div.id = 'confirm-dialog';
  div.innerHTML = `
    <div class="confirm-dialog">
      <div class="confirm-icon">⚠️</div>
      <h4>${title}</h4>
      <p>${escapeHtml(message)}</p>
      <div class="confirm-btns">
        <button class="btn btn-outline" onclick="this.closest('.confirm-overlay').remove()">取消</button>
        <button class="btn btn-primary" id="confirm-ok-btn">确认</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.querySelector('#confirm-ok-btn').addEventListener('click', () => {
    div.remove();
    onConfirm();
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status) {
  const map = {
    'pending': '<span class="badge badge-warning">待审核</span>',
    'verified': '<span class="badge badge-success">已认证</span>',
    'rejected': '<span class="badge badge-danger">已拒绝</span>',
    'active': '<span class="badge badge-success">进行中</span>',
    'closed': '<span class="badge badge-gray">已关闭</span>',
    'completed': '<span class="badge badge-info">已完成</span>',
    'cancelled': '<span class="badge badge-danger">已取消</span>',
    'accepted': '<span class="badge badge-success">已接受</span>',
    'withdrawn': '<span class="badge badge-gray">已撤回</span>',
    'confirmed': '<span class="badge badge-info">已确认</span>',
    'producing': '<span class="badge badge-primary">生产中</span>',
    'quality': '<span class="badge badge-warning">质检中</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status}</span>`;
}

// 分页组件
function renderPagination(container, currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  let pages = '';
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);

  if (start > 1) pages += `<button onclick="${onPageChange}(1)">1</button>`;
  if (start > 2) pages += `<span style="padding:6px 4px;color:#9ca3af;">…</span>`;

  for (let i = start; i <= end; i++) {
    pages += `<button class="${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
  }

  if (end < totalPages - 1) pages += `<span style="padding:6px 4px;color:#9ca3af;">…</span>`;
  if (end < totalPages) pages += `<button onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination-info">第 ${currentPage} / ${totalPages} 页</div>
      <div class="pagination-btns">
        <button ${currentPage <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">上一页</button>
        ${pages}
        <button ${currentPage >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">下一页</button>
      </div>
    </div>
  `;
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', initApp);

// ========== 平台设置页面 ==========
function renderSettings() {
  const body = document.getElementById('page-body');
  body.innerHTML = `
    <div class="settings-section">
      <h3>平台信息</h3>
      <div class="settings-row">
        <div>
          <div class="setting-label">平台名称</div>
          <div class="setting-desc">异采 YiCai - 化妆品行业可信供应链B2B平台</div>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="setting-label">Supabase 连接</div>
          <div class="setting-desc">已连接至 ${SUPABASE_URL}</div>
        </div>
        <span class="badge badge-success">正常</span>
      </div>
      <div class="settings-row">
        <div>
          <div class="setting-label">当前管理员</div>
          <div class="setting-desc">${currentUser?.email || '未登录'}</div>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <h3>部署信息</h3>
      <div class="settings-row">
        <div>
          <div class="setting-label">供应商端</div>
          <div class="setting-desc"><a href="https://zxiaoran-hub.github.io/yicai-supplier-app/" target="_blank">https://zxiaoran-hub.github.io/yicai-supplier-app/</a></div>
        </div>
        <span class="badge badge-success">运行中</span>
      </div>
      <div class="settings-row">
        <div>
          <div class="setting-label">采购方端</div>
          <div class="setting-desc"><a href="https://zxiaoran-hub.github.io/yicai-buyer-app/" target="_blank">https://zxiaoran-hub.github.io/yicai-buyer-app/</a></div>
        </div>
        <span class="badge badge-success">运行中</span>
      </div>
      <div class="settings-row">
        <div>
          <div class="setting-label">管理后台</div>
          <div class="setting-desc"><a href="https://zxiaoran-hub.github.io/yicai-admin/" target="_blank">https://zxiaoran-hub.github.io/yicai-admin/</a></div>
        </div>
        <span class="badge badge-success">运行中</span>
      </div>
    </div>
    <div class="settings-section">
      <h3>系统配置（预留）</h3>
      <div class="settings-row">
        <div>
          <div class="setting-label">供应商自动认证</div>
          <div class="setting-desc">新注册供应商是否需要人工审核</div>
        </div>
        <span class="badge badge-warning">待配置</span>
      </div>
      <div class="settings-row">
        <div>
          <div class="setting-label">询价自动关闭</div>
          <div class="setting-desc">超过30天无报价的询价自动关闭</div>
        </div>
        <span class="badge badge-warning">待配置</span>
      </div>
      <div class="settings-row">
        <div>
          <div class="setting-label">邮件通知</div>
          <div class="setting-desc">新询价/报价时发送邮件通知</div>
        </div>
        <span class="badge badge-warning">待配置</span>
      </div>
    </div>
  `;
}
