const adminToken = () => localStorage.getItem('veto_admin') || '';

async function req(path, { method = 'GET', body, form, admin } = {}) {
  const headers = {};
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (admin) headers.Authorization = `Bearer ${adminToken()}`;
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  toss: () => req('/toss'),
  maps: () => req('/maps'),
  createMatch: (body) => req('/matches', { method: 'POST', body }),
  getMatch: (id, token) => req(`/matches/${id}?token=${encodeURIComponent(token || '')}`),
  callToss: (id, token, call) => req(`/matches/${id}/toss`, { method: 'POST', body: { token, call } }),
  choose: (id, token, choice) => req(`/matches/${id}/choice`, { method: 'POST', body: { token, choice } }),
  act: (id, token, value) => req(`/matches/${id}/action`, { method: 'POST', body: { token, value } }),
  login: async (password) => {
    const { token } = await req('/admin/login', { method: 'POST', body: { password } });
    localStorage.setItem('veto_admin', token);
  },
  logout: () => localStorage.removeItem('veto_admin'),
  isAdmin: () => !!adminToken(),
  addMap: (form) => req('/maps', { method: 'POST', form, admin: true }),
  updateMap: (id, form) => req(`/maps/${id}`, { method: 'PUT', form, admin: true }),
  deleteMap: (id) => req(`/maps/${id}`, { method: 'DELETE', admin: true }),
};
