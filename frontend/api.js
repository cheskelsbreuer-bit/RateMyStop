// API client for the FastAPI backend.
// In dev: points to http://localhost:8000
// In prod: set window.API_BASE in index.html before loading this script,
//          or change the default below to your deployed backend URL.

const API_BASE = window.API_BASE || (
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : ''  // same-origin in production (configure via reverse proxy or env)
);

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function apiUpload(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(API_BASE + '/api/uploads', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();  // { url: "/uploads/abc.jpg" }
}

const api = {
  listOfficers: () => apiGet('/api/officers'),
  getOfficer:   (id) => apiGet('/api/officers/' + id),
  submitReview: (data) => apiPost('/api/reviews', data),
  sendComplaint: (data) => apiPost('/api/complaints', data),
  uploadFile:   apiUpload,
  stats:        () => apiGet('/api/stats'),
};

window.api = api;
