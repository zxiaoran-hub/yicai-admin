// ========== 安全工具函数 ==========

/**
 * HTML转义函数 - 防止XSS攻击
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 转义后的安全字符串
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  return String(str).replace(/[&<>"'`=\/]/g, s => map[s]);
}

/**
 * 安全渲染HTML - 转义用户输入
 * @param {string} str - 用户输入
 * @returns {string} - 安全渲染的HTML
 */
function safeHtml(str) {
  return escapeHtml(str);
}

/**
 * 生成CSRF Token
 * @returns {string} - CSRF Token
 */
function generateCsrfToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array));
}

/**
 * 获取CSRF Token（从SessionStorage）
 * @returns {string} - CSRF Token
 */
function getCsrfToken() {
  let token = sessionStorage.getItem('csrf_token');
  if (!token) {
    token = generateCsrfToken();
    sessionStorage.setItem('csrf_token', token);
  }
  return token;
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} - 是否有效
 */
function isValidEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @returns {object} - {valid: boolean, strength: string, message: string}
 */
function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, strength: 'weak', message: '密码至少6位' };
  }
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  if (strength >= 4) {
    return { valid: true, strength: 'strong', message: '密码强度：强' };
  } else if (strength >= 2) {
    return { valid: true, strength: 'medium', message: '密码强度：中' };
  } else {
    return { valid: true, strength: 'weak', message: '密码强度：弱，建议包含大小写字母、数字和特殊字符' };
  }
}

/**
 * 验证用户名（仅允许字母、数字、下划线）
 * @param {string} username - 用户名
 * @returns {boolean} - 是否有效
 */
function isValidUsername(username) {
  const re = /^[a-zA-Z0-9_]{3,20}$/;
  return re.test(username);
}

/**
 * 清理敏感日志（生产环境移除）
 */
const logger = {
  log: (...args) => {
    if (window.ENV !== 'production') {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (window.ENV !== 'production') {
      console.warn(...args);
    }
  },
  error: (...args) => {
    console.error(...args); // 错误日志始终保留
  }
};

/**
 * 安全的Token存储
 */
const secureStorage = {
  setToken: (accessToken, refreshToken) => {
    // 使用SessionStorage替代LocalStorage
    sessionStorage.setItem('yicai_admin_token', accessToken);
    if (refreshToken) {
      sessionStorage.setItem('yicai_admin_refresh', refreshToken);
    }
    
    // 设置Token过期时间（30分钟）
    const expiresAt = Date.now() + 30 * 60 * 1000;
    sessionStorage.setItem('yicai_token_expires', expiresAt);
  },
  
  getToken: () => {
    const expiresAt = sessionStorage.getItem('yicai_token_expires');
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      // Token已过期，清除
      secureStorage.clearToken();
      return null;
    }
    return sessionStorage.getItem('yicai_admin_token');
  },
  
  getRefreshToken: () => {
    return sessionStorage.getItem('yicai_admin_refresh');
  },
  
  clearToken: () => {
    sessionStorage.removeItem('yicai_admin_token');
    sessionStorage.removeItem('yicai_admin_refresh');
    sessionStorage.removeItem('yicai_token_expires');
  }
};

/**
 * 安全的API请求（带CSRF Token）
 */
async function secureFetch(url, options = {}) {
  const csrfToken = getCsrfToken();
  
  // 合并Headers
  const headers = {
    ...options.headers,
    'X-CSRF-Token': csrfToken
  };
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin' // 仅发送同源Cookie
  });
}

// 导出到全局（兼容现有代码）
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.safeHtml = safeHtml;
  window.generateCsrfToken = generateCsrfToken;
  window.getCsrfToken = getCsrfToken;
  window.isValidEmail = isValidEmail;
  window.validatePassword = validatePassword;
  window.isValidUsername = isValidUsername;
  window.logger = logger;
  window.secureStorage = secureStorage;
  window.secureFetch = secureFetch;
}
