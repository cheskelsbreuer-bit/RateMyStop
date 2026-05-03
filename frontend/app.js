// ── NAVIGATION ──
function nav(id) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.topnav button').forEach((b, i) => {
    b.classList.toggle('active', ['home', 'rate', 'officers', 'complaint', 'deck'][i] === id);
  });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'officers') loadOfficers();
  if (id === 'home') loadStats();
}

// ── RATE FORM STATE ──
let verdict = '';
let stars = 0;
let step = 1;
let uploadedFileUrl = null;

function setVerdict(v) {
  verdict = v;
  document.getElementById('vt-fair').className = 'vt' + (v === 'fair' ? ' fair-sel' : '');
  document.getElementById('vt-unfair').className = 'vt' + (v === 'unfair' ? ' unfair-sel' : '');
}

function setStar(n) {
  stars = n;
  document.querySelectorAll('.sr').forEach(s => s.classList.toggle('on', +s.dataset.v <= n));
}

function toggle(el) { el.classList.toggle('on'); }

function getSelectedTags(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' .tag.on'))
    .map(t => t.textContent.trim());
}

function goStep(n) {
  if (n === 2 && !verdict) { alert('Please select whether the stop was fair or unfair.'); return; }
  if (n === 2 && !stars)   { alert('Please give the officer a star rating.'); return; }
  document.getElementById('step' + step).style.display = 'none';
  step = n;
  document.getElementById('step' + n).style.display = 'block';
  for (let i = 1; i <= 4; i++) {
    const w = document.getElementById('ws' + i);
    w.className = 'ws' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

function onTicketChange() {
  const v = document.getElementById('ticketType').value;
  const showTicket = v && v !== 'none';
  document.getElementById('ticketAmountWrap').style.display = showTicket ? 'block' : 'none';
  document.getElementById('ticketViolationWrap').style.display = showTicket ? 'block' : 'none';
  if (showTicket) {
    document.getElementById('fighterPopup').classList.add('show');
    updateFighterPopup();
  } else {
    document.getElementById('fighterPopup').classList.remove('show');
  }
}

function updateFighterPopup() {
  const amt = document.getElementById('ticketAmount').value;
  const type = document.getElementById('ticketType').value;
  const labels = { minor: 'Minor ticket', mid: 'Standard ticket', major: 'Large ticket', multi: 'Multiple tickets' };
  const label = labels[type] || 'Traffic ticket';
  const amtStr = amt ? ` — $${amt}` : '';
  document.getElementById('fpInfo').innerHTML = `Ticket: <strong>${label}${amtStr}</strong>`;
}

async function onFileUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  document.getElementById('uploadName').textContent = `Uploading ${file.name}…`;
  document.getElementById('uploadPreview').classList.add('show');
  try {
    const result = await api.uploadFile(file);
    uploadedFileUrl = result.url;
    document.getElementById('uploadName').textContent = `${file.name} uploaded ✓`;
  } catch (err) {
    document.getElementById('uploadName').textContent = `Upload failed: ${err.message}`;
    uploadedFileUrl = null;
  }
}

async function submitReview() {
  const btn = document.getElementById('finalSubmit');
  const errBox = document.getElementById('errorBox');
  errBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const payload = {
    verdict,
    stars,
    reasons: getSelectedTags('reasonTags'),
    behaviors: getSelectedTags('behaviorTags'),
    officer_name: document.getElementById('officerName').value || null,
    officer_badge: document.getElementById('badgeIn').value || null,
    department: document.getElementById('deptIn').value || null,
    stop_date: document.getElementById('dateIn').value || null,
    location: document.getElementById('locationIn').value || null,
    ticket_type: document.getElementById('ticketType').value || null,
    ticket_amount: parseFloat(document.getElementById('ticketAmount').value) || null,
    ticket_violation: document.getElementById('ticketViolation').value || null,
    story: document.getElementById('storyIn').value || null,
    ticket_number: document.getElementById('ticketNumberIn').value || null,
    upload_url: uploadedFileUrl,
  };

  try {
    await api.submitReview(payload);
    document.getElementById('successBox').classList.add('show');
    btn.style.display = 'none';
    setTimeout(() => {
      document.getElementById('successBox').classList.remove('show');
      btn.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Submit Review →';
      step = 1;
      goStep(1);
      // Reset
      verdict = ''; stars = 0; uploadedFileUrl = null;
      setVerdict(''); setStar(0);
      document.querySelectorAll('.tag.on').forEach(t => t.classList.remove('on'));
      ['officerName','badgeIn','deptIn','locationIn','ticketAmount','ticketViolation','storyIn','ticketNumberIn']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      document.getElementById('ticketType').value = '';
      document.getElementById('uploadPreview').classList.remove('show');
      onTicketChange();
    }, 4000);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Submit Review →';
    errBox.textContent = `Couldn't submit: ${err.message}`;
    errBox.style.display = 'block';
  }
}

// ── OFFICER PROFILES ──
let officerCache = [];
let activePill = 'All Officers';

function starsStr(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

async function loadOfficers() {
  const grid = document.getElementById('officerGrid');
  grid.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;">Loading officers…</div>';
  try {
    officerCache = await api.listOfficers();
    applyFilters();
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px 0;">Couldn't load officers: ${err.message}</div>`;
  }
}

function renderOfficers(list) {
  const grid = document.getElementById('officerGrid');
  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;">No officers match yet. Be the first to add one by submitting a review.</div>';
    return;
  }
  grid.innerHTML = list.map(o => `
    <div class="officer-card" onclick="openOfficer(${o.id})">
      <div class="oc-top">
        <div class="oc-av">${(o.name || 'Unknown').split(' ').pop().slice(0, 2).toUpperCase()}</div>
        <div><div class="oc-name">${escapeHtml(o.name || 'Unknown Officer')}</div><div class="oc-dept">${escapeHtml(o.badge || '—')} · ${escapeHtml(o.department || 'Unknown Dept')}</div></div>
      </div>
      <div class="oc-stars">${starsStr(Math.round(o.avg_stars || 0))} <span style="font-size:0.8rem;color:var(--gray);margin-left:4px;">${(o.avg_stars || 0).toFixed(1)}/5</span></div>
      <div class="oc-meta">
        ${o.fair_count > 0 ? `<span class="oc-chip fair">✅ ${o.fair_count} Fair</span>` : ''}
        ${o.unfair_count > 0 ? `<span class="oc-chip unfair">❌ ${o.unfair_count} Unfair</span>` : ''}
      </div>
      <div class="oc-reviews">${o.review_count} review${o.review_count !== 1 ? 's' : ''} · Click to view</div>
    </div>
  `).join('');
}

async function openOfficer(id) {
  const modal = document.getElementById('modalContent');
  modal.innerHTML = '<div style="color:var(--gray);padding:40px 0;text-align:center;">Loading…</div>';
  document.getElementById('officerModal').classList.add('show');
  try {
    const o = await api.getOfficer(id);
    modal.innerHTML = `
      <div class="mo-head">
        <div class="mo-av">${(o.name || 'Unknown').split(' ').pop().slice(0, 2).toUpperCase()}</div>
        <div>
          <div class="mo-name">${escapeHtml(o.name || 'Unknown Officer')}</div>
          <div class="mo-sub">${escapeHtml(o.badge || '—')} · ${escapeHtml(o.department || 'Unknown')}</div>
        </div>
      </div>
      <div class="mo-stats">
        <div class="ms-box"><div class="ms-n">${(o.avg_stars || 0).toFixed(1)}★</div><div class="ms-l">Avg Rating</div></div>
        <div class="ms-box"><div class="ms-n">${o.review_count}</div><div class="ms-l">Reviews</div></div>
        <div class="ms-box"><div class="ms-n">${o.unfair_count}</div><div class="ms-l">Complaints</div></div>
      </div>
      ${o.reviews.map(r => `
        <div class="mo-review">
          <div class="mr-top">
            <div class="mr-stars">${starsStr(r.stars)}</div>
            <div>
              <span class="mr-verdict ${r.verdict}">${r.verdict === 'fair' ? '✅ Fair' : '❌ Unfair'}</span>
              ${r.upload_url ? '<span class="flag-verified" style="margin-left:6px;">🛡️ Verified</span>' : ''}
            </div>
          </div>
          <div class="mr-text">${escapeHtml(r.story || 'No description provided.')}</div>
          <div class="mr-date">${formatDate(r.created_at)}</div>
        </div>
      `).join('')}
      ${o.unfair_count >= 3 ? `<div class="mo-flag"><span>⚠️</span><div>This officer has <strong>${o.unfair_count} unfair stop complaints</strong> from community reviews. You can file a complaint directly with the department.</div></div>` : ''}
      <button class="submit-main" style="margin-top:18px;" onclick="document.getElementById('officerModal').classList.remove('show'); nav('complaint');">File a Complaint About This Officer →</button>
    `;
  } catch (err) {
    modal.innerHTML = `<div style="color:var(--red);padding:40px 0;text-align:center;">Couldn't load officer: ${err.message}</div>`;
  }
}

function closeModal(e) {
  if (e.target.id === 'officerModal') document.getElementById('officerModal').classList.remove('show');
}

function searchOfficers() { applyFilters(); }

function pillClick(el) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  activePill = el.textContent.trim();
  applyFilters();
}

function applyFilters() {
  let list = [...officerCache];
  const q = document.getElementById('officerSearch').value.toLowerCase().trim();
  if (q) {
    list = list.filter(o =>
      (o.name || '').toLowerCase().includes(q) ||
      (o.badge || '').toLowerCase().includes(q) ||
      (o.department || '').toLowerCase().includes(q)
    );
  }
  if (activePill.includes('Spring Valley')) list = list.filter(o => (o.department || '').includes('Spring Valley'));
  else if (activePill.includes('Highest'))   list = list.sort((a, b) => (b.avg_stars || 0) - (a.avg_stars || 0));
  else if (activePill.includes('Complaints')) list = list.sort((a, b) => (b.unfair_count || 0) - (a.unfair_count || 0));
  renderOfficers(list);
}

// ── COMPLAINTS ──
function openComplaintForm(name, email) {
  document.getElementById('cfTitle').textContent = 'Complaint to ' + name;
  document.getElementById('cfSub').textContent = 'Sending to: ' + (email || 'Department front desk');
  document.getElementById('complaintFormWrap').style.display = 'block';
  document.getElementById('complaintFormWrap').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('cfDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('complaintFormWrap').dataset.recipientName = name;
  document.getElementById('complaintFormWrap').dataset.recipientEmail = email || '';
}

async function sendComplaint() {
  const btn = document.getElementById('cfSubmitBtn');
  const errBox = document.getElementById('complaintError');
  errBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const wrap = document.getElementById('complaintFormWrap');
  const payload = {
    recipient_name: wrap.dataset.recipientName || '',
    recipient_email: wrap.dataset.recipientEmail || '',
    sender_name: document.getElementById('cfSenderName').value || 'Anonymous',
    officer_badge_or_name: document.getElementById('cfBadge').value || null,
    incident_date: document.getElementById('cfDate').value || null,
    body: document.getElementById('cfBody').value || '',
  };

  if (!payload.body.trim()) {
    errBox.textContent = 'Please describe what happened.';
    errBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send Complaint →';
    return;
  }

  try {
    await api.sendComplaint(payload);
    document.getElementById('complaintSuccess').classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Send Complaint →';
    setTimeout(() => document.getElementById('complaintSuccess').classList.remove('show'), 6000);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Send Complaint →';
    errBox.textContent = `Couldn't send: ${err.message}`;
    errBox.style.display = 'block';
  }
}

// ── HOMEPAGE STATS ──
async function loadStats() {
  try {
    const s = await api.stats();
    document.getElementById('statStops').textContent = s.total_reviews.toLocaleString() + (s.total_reviews >= 100 ? '+' : '');
    document.getElementById('statUnfair').textContent = (s.unfair_pct || 0) + '%';
    document.getElementById('statAvgTicket').textContent = s.avg_ticket ? '$' + Math.round(s.avg_ticket) : '—';
    document.getElementById('statOfficers').textContent = s.officer_count.toLocaleString();
  } catch (err) {
    // silently fall back to placeholder dashes
    console.warn('Stats unavailable:', err.message);
  }
}

// ── HELPERS ──
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── INIT ──
document.getElementById('dateIn').value = new Date().toISOString().split('T')[0];
loadStats();
loadOfficers();
