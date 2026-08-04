// 异采 YiCai 管理端 API 配置（自建后端版，替代原 Supabase）
// API 与前端同域部署（nginx 反代 /api），无需跨域配置
const API_BASE = '';

// 设置环境为生产环境（移除console输出）
window.ENV = 'production';

// 解码 JWT payload（兼容 base64url 编码与 UTF-8 字符）
function decodeJwtPayload(token) {
  try {
    let b64 = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

// 检查 token 是否即将过期（5分钟内过期视为已过期）
function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return payload.exp * 1000 - Date.now() < 5 * 60 * 1000;
}

// 刷新 token（单飞模式：并发请求共享同一次刷新，避免轮换竞态）
let __refreshInFlight = null;
async function refreshTokenIfNeeded() {
  const accessToken = secureStorage.getToken();
  const refreshTok = secureStorage.getRefreshToken();
  if (!accessToken || !refreshTok) return;
  if (!isTokenExpired(accessToken)) return;

  if (!__refreshInFlight) {
    __refreshInFlight = (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshTok })
        });
        if (resp.ok) {
          const data = await resp.json();
          secureStorage.setToken(data.access_token, data.refresh_token);
        } else {
          // 刷新被拒绝：保留现有令牌，由服务端按 401 处理，避免误清登录态
          logger.warn('Token refresh rejected:', resp.status);
        }
      } catch (e) {
        // 网络异常：同样不激进清除，等待下次请求重试
        logger.warn('Token refresh failed:', e);
      } finally {
        setTimeout(() => { __refreshInFlight = null; }, 1000);
      }
    })();
  }
  await __refreshInFlight;
}

// 获取当前认证请求头（未登录时不带 Authorization，服务端按匿名规则处理）
// X-CSRF-Token 保留（服务端忽略，仅兼容前端安全层）
async function getAuthHeaders() {
  await refreshTokenIfNeeded();
  const userToken = secureStorage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken()
  };
  if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
  return headers;
}

// 数据访问封装（接口签名与原 Supabase 版保持一致，业务代码无需改动）
const supabase = {
  async query(table, params = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ table, ...params }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.warn(`Query ${table} failed: ${response.status}`);
        return [];
      }
      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Query ${table} error:`, err.message);
      return [];
    }
  },

  async rpc(functionName, params = {}) {
    const response = await fetch(`${API_BASE}/api/rpc/${functionName}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`RPC failed: ${response.status} - ${errText}`);
    }
    return response.json();
  },

  async insert(table, data) {
    const response = await fetch(`${API_BASE}/api/insert`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ table, data })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Insert failed: ${response.status}`);
    }
    return response.json();
  },

  async update(table, data, match) {
    const response = await fetch(`${API_BASE}/api/update`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ table, data, match })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Update failed: ${response.status}`);
    }
    return response.json();
  },

  async delete(table, match) {
    const response = await fetch(`${API_BASE}/api/delete`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ table, match })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Delete failed: ${response.status}`);
    }
    const deleted = await response.json();
    if (!deleted || deleted.length === 0) {
      throw new Error('未找到匹配记录，删除未生效（可能是权限不足）');
    }
    return true;
  },

  async signIn(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || '登录失败');
    }
    return response.json();
  },

  // 注册（metadata 映射到 body.data，如 {name, full_name}）
  async signUp(email, password, metadata) {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: metadata })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || '注册失败');
    }
    return response.json();
  },

  // 注册（管理端创建账号用）：已存在邮箱（422）时降级为登录，返回 { user, existingUser:true }
  async authSignUp(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errMsg = err.message || err.msg || '注册失败';
      // 用户已存在时，尝试直接登录获取用户信息
      if (response.status === 422 || /already.*registered/i.test(errMsg)) {
        try {
          const signInResp = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          if (signInResp.ok) {
            const signInData = await signInResp.json();
            return { user: signInData.user, existingUser: true };
          }
        } catch (e) { /* sign-in fallback failed */ }
      }
      throw new Error(errMsg);
    }
    return response.json();
  },

  async getCount(table, filter = {}) {
    try {
      const response = await fetch(`${API_BASE}/api/count`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ table, filter })
      });
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    } catch {
      return 0;
    }
  },

  // 按 select 子句取统计数据（内部走 /api/query）
  async getStats(table, selectClause, filter = {}) {
    return this.query(table, { select: selectClause, filter });
  }
};
