// API client for the FastAPI backend.
//
// In dev (localhost): talks to http://localhost:8000
// In prod (e.g. GitHub Pages): set window.API_BASE in index.html before this script
//   to point at your deployed backend, OR leave it empty to run in static-demo mode
//   using window.STATIC_DATA from static-data.js.

const API_BASE = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : (
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : null  // null = static demo mode
);

const STATIC_MODE = !API_BASE;

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
  return res.json();
}

// ───── static-demo fallback (used when no backend is reachable) ─────

function staticOfficers() {
  const data = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  return data.map(({ reviews, ...summary }) => summary);
}

function staticOfficer(id) {
  const data = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  const o = data.find(o => o.id === Number(id));
  if (!o) throw new Error('Officer not found');
  return o;
}

function staticStats() {
  return (window.STATIC_DATA && window.STATIC_DATA.stats) || {
    total_reviews: 0, officer_count: 0, unfair_pct: 0, avg_ticket: null,
  };
}

// ───── public API ─────

const api = {
  async listOfficers() {
    if (STATIC_MODE) return staticOfficers();
    try { return await apiGet('/api/officers'); }
    catch { return staticOfficers(); }
  },
  async getOfficer(id) {
    if (STATIC_MODE) return staticOfficer(id);
    try { return await apiGet('/api/officers/' + id); }
    catch { return staticOfficer(id); }
  },
  async submitReview(data) {
    if (STATIC_MODE) return { id: -1, demo: true };  // silent success — the UI handles the demo notice
    return apiPost('/api/reviews', data);
  },
  async sendComplaint(data) {
    if (STATIC_MODE) return { id: -1, demo: true };  // silent success
    return apiPost('/api/complaints', data);
  },
  async uploadFile(file) {
    if (STATIC_MODE) {
      // Simulate a successful upload visually
      return { url: '#demo-upload', filename: file.name };
    }
    return apiUpload(file);
  },
  async stats() {
    if (STATIC_MODE) return staticStats();
    try { return await apiGet('/api/stats'); }
    catch { return staticStats(); }
  },
  isStatic: () => STATIC_MODE,
};

window.api = api;
