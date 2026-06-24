const BASE = '';

async function request(path, options = {}) {
  const token = localStorage.getItem('stealth_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('stealth_token');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  return res.json();
}

export const api = {
  login: (adminId, password) =>
    request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ adminId, password }),
    }),

  getDashboard: () => request('/admin/dashboard'),

  getUsers: () => request('/admin/users'),
  updateUser: (id, data) =>
    request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  suspendUser: (id) =>
    request(`/admin/users/${id}/suspend`, { method: 'PUT' }),
  activateUser: (id) =>
    request(`/admin/users/${id}/activate`, { method: 'PUT' }),
  deleteUser: (id) =>
    request(`/admin/users/${id}`, { method: 'DELETE' }),

  getProviders: () => request('/admin/providers'),
  approveProvider: (id) =>
    request(`/admin/providers/${id}/approve`, { method: 'POST' }),
  rejectProvider: (id, reason) =>
    request(`/admin/providers/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getJobs: () => request('/admin/jobs'),
  approveJob: (id) =>
    request(`/admin/jobs/${id}/approve`, { method: 'POST' }),
  rejectJob: (id) =>
    request(`/admin/jobs/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: 'Rejected by admin' }) }),

  getActivities: (params) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/activities${q}`);
  },
  approveActivity: (id) =>
    request(`/api/activities/${id}/approve`, { method: 'PUT' }),
  rejectActivity: (id, reason) =>
    request(`/api/activities/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  createActivity: (data) =>
    request('/api/activities', { method: 'POST', body: JSON.stringify(data) }),

  getTransactions: () => request('/admin/transactions'),
  getStats: () => request('/admin/stats'),
};
