// Supabase 配置
const SUPABASE_URL = 'https://spb-m06skr4cysol4lwz.supabase.opentrust.net';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNwYi1tMDZza3I0Y3lzb2w0bHd6IiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODUzNzcwNjIsImV4cCI6MjEwMDk1MzA2Mn0.2OO2jmTetq6vOE4xTRruNMXVUI89ATMIStpIl4ul3kI';

// Supabase REST API 辅助函数
const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,

  async query(table, params = {}) {
    let url = `${this.url}/rest/v1/${table}`;
    const queryParams = [];

    if (params.select) queryParams.push(`select=${params.select}`);
    if (params.filter) {
      for (const [key, value] of Object.entries(params.filter)) {
        queryParams.push(`${key}=eq.${value}`);
      }
    }
    if (params.order) queryParams.push(`order=${params.order}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.offset) queryParams.push(`offset=${params.offset}`);
    if (params.like) {
      for (const [key, value] of Object.entries(params.like)) {
        queryParams.push(`${key}=ilike.${value}`);
      }
    }
    if (params.in) {
      for (const [key, value] of Object.entries(params.in)) {
        queryParams.push(`${key}=in.(${value})`);
      }
    }
    if (params.gte) {
      for (const [key, value] of Object.entries(params.gte)) {
        queryParams.push(`${key}=gte.${value}`);
      }
    }
    if (params.lte) {
      for (const [key, value] of Object.entries(params.lte)) {
        queryParams.push(`${key}=lte.${value}`);
      }
    }

    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    const response = await fetch(url, {
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`Query failed: ${response.status}`);
    return response.json();
  },

  async rpc(functionName, params = {}) {
    const url = `${this.url}/rest/v1/rpc/${functionName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error(`RPC failed: ${response.status}`);
    return response.json();
  },

  async update(table, data, match) {
    let url = `${this.url}/rest/v1/${table}?`;
    const queryParams = [];
    for (const [key, value] of Object.entries(match)) {
      queryParams.push(`${key}=eq.${value}`);
    }
    url += queryParams.join('&');

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Update failed: ${response.status}`);
    return response.json();
  },

  async signIn(email, password) {
    const url = `${this.url}/auth/v1/token?grant_type=password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error_description || err.msg || '登录失败');
    }
    return response.json();
  },

  async getCount(table, filter = {}) {
    let url = `${this.url}/rest/v1/${table}?select=count&count=exact`;
    const queryParams = [];
    for (const [key, value] of Object.entries(filter)) {
      queryParams.push(`${key}=eq.${value}`);
    }
    if (queryParams.length > 0) {
      url += '&' + queryParams.join('&');
    }
    const response = await fetch(url, {
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });
    if (!response.ok) return 0;
    const cr = response.headers.get('content-range');
    if (cr) {
      const match = cr.match(/\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  },

  async getStats(table, selectClause, filter = {}) {
    let url = `${this.url}/rest/v1/${table}?select=${selectClause}`;
    const queryParams = [];
    for (const [key, value] of Object.entries(filter)) {
      queryParams.push(`${key}=eq.${value}`);
    }
    if (queryParams.length > 0) {
      url += '&' + queryParams.join('&');
    }
    const response = await fetch(url, {
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) return [];
    return response.json();
  }
};
