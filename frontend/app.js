// ── NAVIGATION ──
const NAV_IDS = ['home', 'share', 'officers', 'rankings', 'complaint', 'deck'];

function nav(id) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.topnav button').forEach((b, i) => {
    b.classList.toggle('active', NAV_IDS[i] === id);
  });
  const section = document.getElementById(id);
  if (section) section.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'officers')  loadOfficers();
  if (id === 'home')      loadStats();
  if (id === 'complaint') renderDepartments();
  if (id === 'rankings')  renderRankings();
}

// ── RATE FORM STATE ──
let verdict = '';
let stars = 0;                // current rating (auto or overridden)
let starsOverride = null;     // if the user manually picked, this is set 1-5
let step = 1;
let uploadedFileUrl = null;

function setVerdict(v) {
  verdict = v;
  document.getElementById('vt-fair').className   = 'vt' + (v === 'fair' ? ' fair-sel' : '');
  document.getElementById('vt-unfair').className = 'vt' + (v === 'unfair' ? ' unfair-sel' : '');
  refreshLiveRating();
}

// Toggle a tag. Adds polarity styling to behavior tags. Updates the live rating.
function toggle(el) {
  el.classList.toggle('on');
  const pol = el.dataset.pol;
  if (pol) el.classList.toggle(pol, el.classList.contains('on'));
  refreshLiveRating();
}

// ── SENTIMENT ANALYZER for the free-text notes ──
// Looks for explicit star mentions and clear positive/negative language.
// Returns a numeric adjustment in [-2.5, +2.5].
function analyzeNotes(text) {
  if (!text) return 0;
  const t = (' ' + text.toLowerCase() + ' ').replace(/[^\w\s/-]/g, ' ');
  let score = 0;

  // Explicit star mentions — strongest signal
  const STAR_PHRASES = [
    { re: /\b(five|5)[\s-]?star(s)?\b/, w: 2.0 },
    { re: /\b5\s?\/\s?5\b/,             w: 2.0 },
    { re: /\b(four|4)[\s-]?star(s)?\b/, w: 1.0 },
    { re: /\b4\s?\/\s?5\b/,             w: 1.0 },
    { re: /\b(three|3)[\s-]?star(s)?\b/, w: 0 },
    { re: /\b3\s?\/\s?5\b/,             w: 0 },
    { re: /\b(two|2)[\s-]?star(s)?\b/,  w: -1.2 },
    { re: /\b2\s?\/\s?5\b/,             w: -1.2 },
    { re: /\b(one|1)[\s-]?star(s)?\b/,  w: -2.0 },
    { re: /\b1\s?\/\s?5\b/,             w: -2.0 },
    { re: /\bzero[\s-]?star(s)?\b/,     w: -2.5 },
  ];
  for (const { re, w } of STAR_PHRASES) if (re.test(t)) score += w;

  // Positive / negative descriptors
  const POSITIVE = [
    'great','excellent','amazing','wonderful','professional','polite','kind','respectful',
    'helpful','fair','calm','understanding','nice','friendly','best','phenomenal','outstanding',
    'patient','reasonable','courteous','exemplary','model','classy','perfect','good',
  ];
  const NEGATIVE = [
    'horrible','terrible','awful','rude','aggressive','mean','hostile','worst','unfair',
    'disrespectful','dismissive','arrogant','angry','abusive','threatening','racist','biased',
    'unprofessional','harassed','intimidating','condescending','liar','lying','corrupt','bully',
  ];
  for (const w of POSITIVE) if (t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ') || t.includes(' ' + w + 'ly ')) score += 0.3;
  for (const w of NEGATIVE) if (t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ') || t.includes(' ' + w + 'ly ')) score -= 0.4;

  // Clamp so notes can't completely dominate
  return Math.max(-2.5, Math.min(2.5, score));
}

// Compute the suggested rating from verdict + behaviors + notes sentiment.
//   Fair  → start 5     Unfair → start 2     None → start 4 (charitable default)
function calculateSuggestedStars() {
  if (starsOverride != null) return starsOverride;
  let score;
  if (verdict === 'fair')        score = 5.0;
  else if (verdict === 'unfair') score = 2.0;
  else                            score = 4.0;
  document.querySelectorAll('#behaviorTags .tag.on').forEach(t => {
    score += parseFloat(t.dataset.w || '0');
  });
  const quickNotes = (document.getElementById('quickStory')?.value || '');
  score += analyzeNotes(quickNotes);
  return Math.max(1, Math.min(5, Math.round(score)));
}

// Refresh the small live chip at the top of the form.
function refreshLiveRating() {
  const s = calculateSuggestedStars();
  stars = s;
  const lr = document.getElementById('liveRating');
  const starsEl = document.getElementById('lrStars');
  const numEl   = document.getElementById('lrNum');
  if (!lr) return;
  starsEl.textContent = '★'.repeat(s) + '☆'.repeat(5 - s);
  numEl.textContent = starsOverride != null ? `${s}/5 · manual` : `${s}/5`;
  numEl.classList.toggle('manual', starsOverride != null);
  // Subtle pulse so the user notices it changed
  lr.classList.remove('pulse');
  void lr.offsetWidth;  // force reflow
  lr.classList.add('pulse');
  // Reflect override stars in the adjust panel
  document.querySelectorAll('#lapStars span').forEach(span => {
    span.classList.toggle('on', starsOverride != null && +span.dataset.v <= starsOverride);
  });
}

function toggleAdjust() {
  document.getElementById('lrAdjustPanel').classList.toggle('show');
}
function overrideRating(n) {
  starsOverride = n;
  refreshLiveRating();
}
function clearOverride() {
  starsOverride = null;
  refreshLiveRating();
}

// Legacy stub — home-page phone-mock & officer cards still call setStar.
function setStar(n) { stars = n; }

function getSelectedTags(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' .tag.on'))
    .map(t => t.textContent.trim());
}

function goStep(n) {
  // Step 1 validation: must pick a role first
  if (n === 2 && !currentRole) {
    alert('Pick who it was first (Police / EMT / Fire / DMV / Hospital / Gov’t).');
    return;
  }
  // Step 3 is ticket info — only relevant for police. Skip for everyone else.
  if (n === 3 && currentRole !== 'police') {
    n = 4;
  }
  document.getElementById('step' + step).style.display = 'none';
  step = n;
  document.getElementById('step' + n).style.display = 'block';
  // Show the live rating chip starting at step 2 — never visible during step-1 input
  const chip = document.getElementById('liveRating');
  if (chip) {
    if (n >= 2) { refreshLiveRating(); chip.classList.add('visible'); }
    else        { chip.classList.remove('visible'); }
  }
  for (let i = 1; i <= 4; i++) {
    const w = document.getElementById('ws' + i);
    w.className = 'ws' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

function onTicketChange() {
  const v = document.getElementById('ticketType').value;
  const showTicket = v && v !== 'none';
  document.getElementById('ticketAmountWrap').style.display   = showTicket ? 'block' : 'none';
  document.getElementById('ticketViolationWrap').style.display = showTicket ? 'block' : 'none';
}

// Role selection (Step 1). All roles are equal — police is one of six categories.
// No default selection — user picks. Police-only contextual UI hides for other roles.
let currentRole = null;
function setRole(el, role) {
  currentRole = role;
  document.querySelectorAll('#rolePills .role-pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  const reasonRow = document.getElementById('reasonRow');
  if (reasonRow) reasonRow.style.display = (role === 'police') ? 'block' : 'none';
  const bodyCamWrap = document.getElementById('bodyCamWrap');
  if (bodyCamWrap) bodyCamWrap.style.display = (role === 'police') ? 'block' : 'none';
  // Step 3 is the ticket info — only makes sense for traffic stops
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

// Submit — direct, no modal. The live chip already showed the user the rating the whole time.
async function submitReview() {
  // Make sure the current rating reflects the latest inputs (in case of focus changes etc.)
  refreshLiveRating();
  const btn = document.getElementById('finalSubmit');
  const errBox = document.getElementById('errorBox');
  errBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const story = (document.getElementById('quickStory')?.value || '').trim() || null;

  // Derive verdict from selected tags if user hasn't picked one explicitly.
  // Positive-majority → fair, negative-majority → unfair, balanced → null.
  if (!verdict) {
    let pos = 0, neg = 0;
    document.querySelectorAll('#behaviorTags .tag.on').forEach(t => {
      if (t.dataset.pol === 'pos') pos++;
      else if (t.dataset.pol === 'neg') neg++;
    });
    if (pos > neg) verdict = 'fair';
    else if (neg > pos) verdict = 'unfair';
  }

  const anonymous = document.getElementById('anonToggle')?.checked !== false;
  const payload = {
    kind: 'moment',
    role: currentRole,
    verdict: verdict || 'fair',  // backend requires fair|unfair; default to fair for balanced/positive moments
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
    story,
    ticket_number: document.getElementById('ticketNumberIn').value || null,
    upload_url: uploadedFileUrl,
    anonymous,
    reviewer_name: anonymous ? null : (document.getElementById('reviewerName')?.value || null),
    body_cam: bodyCamAnswer,
  };

  try {
    await api.submitReview(payload);
    document.getElementById('successBox').classList.add('show');
    btn.style.display = 'none';
    setTimeout(() => {
      document.getElementById('successBox').classList.remove('show');
      btn.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Post this moment →';
      step = 1;
      goStep(1);
      // Full form reset
      verdict = ''; stars = 0; starsOverride = null; uploadedFileUrl = null; bodyCamAnswer = null;
      setVerdict('');
      document.querySelectorAll('.tag.on').forEach(t => { t.classList.remove('on', 'pos', 'neg'); });
      document.querySelectorAll('#bodyCamPills .bcp.on').forEach(p => p.classList.remove('on'));
      const bcpHint = document.getElementById('bcpHint'); if (bcpHint) bcpHint.style.display = 'none';
      const statHelper = document.getElementById('statuteHelper'); if (statHelper) statHelper.classList.remove('show');
      const badgeSug = document.getElementById('badgeSuggest'); if (badgeSug) badgeSug.classList.remove('show');
      const anonT = document.getElementById('anonToggle'); if (anonT) { anonT.checked = true; const rnw = document.getElementById('reviewerNameWrap'); if (rnw) rnw.style.display = 'none'; }
      ['officerName','badgeIn','deptIn','locationIn','ticketAmount','ticketViolation','ticketNumberIn','quickStory','reviewerName']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      // Clear role selection — user picks fresh each time
      currentRole = null;
      document.querySelectorAll('#rolePills .role-pill').forEach(p => p.classList.remove('on'));
      const reasonRow = document.getElementById('reasonRow'); if (reasonRow) reasonRow.style.display = 'none';
      const bodyCamWrap = document.getElementById('bodyCamWrap'); if (bodyCamWrap) bodyCamWrap.style.display = 'none';
      const lap = document.getElementById('lrAdjustPanel'); if (lap) lap.classList.remove('show');
      const lr = document.getElementById('liveRating'); if (lr) lr.classList.remove('visible');
      refreshLiveRating();
      document.getElementById('ticketType').value = '';
      document.getElementById('uploadPreview').classList.remove('show');
      onTicketChange();
    }, 4000);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Post this moment →';
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

// ── NY DEPARTMENT DIRECTORY ──
function renderDepartments() {
  const grid = document.getElementById('contactGrid');
  if (!grid) return;
  const depts = window.NY_DEPARTMENTS || [];
  const q = (document.getElementById('deptSearch').value || '').toLowerCase().trim();
  const region = document.getElementById('deptRegion').value || '';

  // Populate region dropdown once
  const regionSel = document.getElementById('deptRegion');
  if (regionSel && regionSel.options.length === 1) {
    const regions = Array.from(new Set(depts.map(d => d.region))).sort();
    regions.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      regionSel.appendChild(opt);
    });
  }

  let filtered = depts;
  if (region) filtered = filtered.filter(d => d.region === region);
  if (q) filtered = filtered.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.address.toLowerCase().includes(q) ||
    d.region.toLowerCase().includes(q)
  );

  document.getElementById('deptCount').textContent = filtered.length;

  if (!filtered.length) {
    grid.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;grid-column:1/-1;">No departments match. Try a broader search.</div>';
    return;
  }

  grid.innerHTML = filtered.map(d => {
    const primaryContact = d.contacts && d.contacts[0] ? d.contacts[0] : null;
    const recipientName = primaryContact && primaryContact.name ? primaryContact.name : d.name;
    const recipientEmail = primaryContact && primaryContact.email ? primaryContact.email : '';
    return `
      <div class="contact-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div class="cc-role">${escapeHtml(d.region)}</div>
          ${d.verified ? '<span class="flag-verified">&#10003; Verified</span>' : '<span style="font-size:0.7rem;color:var(--gray);">phone-only</span>'}
        </div>
        <div class="cc-name">${escapeHtml(d.name)}</div>
        ${(d.contacts || []).slice(0, 2).map(c => `
          <div class="cc-row">
            ${c.role ? `<span style="font-size:0.7rem;color:var(--gray);width:80px;flex-shrink:0;">${escapeHtml(c.role)}:</span>` : ''}
            ${c.email ? `&#128231; <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : (c.phone ? `&#128222; ${escapeHtml(c.phone)}` : '')}
          </div>
        `).join('')}
        <div class="cc-row" style="font-size:0.78rem;color:var(--gray);margin-top:6px;">&#128205; ${escapeHtml(d.address)}</div>
        <button class="cc-send" onclick="openComplaintForm(${JSON.stringify(recipientName).replace(/"/g, '&quot;')}, ${JSON.stringify(recipientEmail).replace(/"/g, '&quot;')})">Send Complaint &rarr;</button>
      </div>
    `;
  }).join('');
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

// ── HOMEPAGE STATS — neutral metrics only ──
async function loadStats() {
  try {
    // For "people recognized" + "departments tracked" we compute from the local static-data,
    // since the API doesn't yet expose those aggregates.
    let recognizedCount = 0;
    let deptCount = 0;
    if (window.STATIC_DATA && window.STATIC_DATA.officers) {
      const officers = window.STATIC_DATA.officers;
      recognizedCount = officers.filter(o => (o.avg_stars || 0) >= 4).length;
      deptCount = new Set(officers.map(o => o.department).filter(Boolean)).size;
    }
    const s = await api.stats();
    const moments = s.total_reviews || 0;
    document.getElementById('statMoments').textContent      = moments.toLocaleString() + (moments >= 100 ? '+' : '');
    document.getElementById('statRecognized').textContent   = recognizedCount.toLocaleString();
    document.getElementById('statDepartments').textContent  = deptCount.toLocaleString();
    document.getElementById('statOfficers').textContent     = (s.officer_count || 0).toLocaleString();
  } catch (err) {
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
refreshLiveRating();   // initial state: 4/5 charitable default

// Live update the chip as user types in the notes (debounced ~250ms)
let _notesTimer = null;
['quickStory'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    clearTimeout(_notesTimer);
    _notesTimer = setTimeout(refreshLiveRating, 250);
  });
});

// ─── Feature 1: Anonymous toggle ───
const anonToggle = document.getElementById('anonToggle');
if (anonToggle) {
  anonToggle.addEventListener('change', () => {
    document.getElementById('reviewerNameWrap').style.display = anonToggle.checked ? 'none' : 'block';
  });
}

// ─── Feature 2: Body cam pill picker ───
let bodyCamAnswer = null;
function setBodyCam(el, value) {
  bodyCamAnswer = value;
  document.querySelectorAll('#bodyCamPills .bcp').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  const hint = document.getElementById('bcpHint');
  if (value === 'yes') {
    hint.innerHTML = '🛡️ <strong style="color:var(--accent);">Strong evidence.</strong> In NY, you have a right to request body-cam footage. We\'ll add a "Request body cam" template to your complaint.';
    hint.style.display = 'block';
  } else if (value === 'no') {
    hint.innerHTML = '<strong style="color:var(--accent);">Worth noting.</strong> Most NY officers are required to wear body cams on traffic stops. This may be relevant to your complaint.';
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

// ─── Feature 3: Share button ───
async function shareReview() {
  const shareData = {
    title: 'RateMyStop',
    text: 'I just rated my traffic stop on RateMyStop — your stop, your voice, on the record. Add yours →',
    url: window.location.origin + window.location.pathname,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareData.text + ' ' + shareData.url);
      const btn = document.getElementById('shareBtn');
      const orig = btn.textContent;
      btn.textContent = '✓ Copied to clipboard';
      setTimeout(() => { btn.textContent = orig; }, 2500);
    }
  } catch (err) {
    // User cancelled — silent
  }
}

// ─── Feature 4: Officer badge auto-lookup ───
function onBadgeInput() {
  const q = document.getElementById('badgeIn').value.trim().toLowerCase();
  const sug = document.getElementById('badgeSuggest');
  if (!q || q.length < 1) { sug.classList.remove('show'); return; }

  // Pull from whichever data source is available
  const all = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const matches = all.filter(o =>
    (o.badge && o.badge.toLowerCase().includes(q)) ||
    (o.name && o.name.toLowerCase().includes(q))
  ).slice(0, 5);

  if (!matches.length) { sug.classList.remove('show'); return; }

  sug.innerHTML = matches.map(o => `
    <div class="ac-item" onmousedown="pickBadgeMatch(${o.id})">
      <div class="ac-name">${escapeHtml(o.name || 'Unknown')}</div>
      <div class="ac-meta">${escapeHtml(o.badge || '—')} · ${escapeHtml(o.department || 'Unknown')} · ${(o.avg_stars || 0).toFixed(1)}★ avg · ${o.review_count} review${o.review_count !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
  sug.classList.add('show');
}

function pickBadgeMatch(id) {
  const all = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const o = all.find(x => x.id === id);
  if (!o) return;
  document.getElementById('badgeIn').value = o.badge || '';
  document.getElementById('officerName').value = o.name || '';
  document.getElementById('deptIn').value = o.department || '';
  document.getElementById('badgeSuggest').classList.remove('show');
}

// ─── Feature 5: Statute code lookup ───
function onViolationInput() {
  const v = document.getElementById('ticketViolation').value;
  const helper = document.getElementById('statuteHelper');
  if (!v || !window.lookupVTL) { helper.classList.remove('show'); return; }
  const match = window.lookupVTL(v);
  if (!match) { helper.classList.remove('show'); return; }
  helper.innerHTML = `
    <div class="sh-eyebrow">NY VEHICLE & TRAFFIC LAW</div>
    <div class="sh-code">VTL ${escapeHtml(match.code)}</div>
    <div class="sh-desc">${escapeHtml(match.desc)}</div>
    <div class="sh-meta">
      <span>Typical fine: <strong>${escapeHtml(match.fine)}</strong></span>
      <span>DMV points: <strong>${escapeHtml(String(match.points))}</strong></span>
    </div>
  `;
  helper.classList.add('show');
}

// ─── Feature 7: Department Rankings ───
let _rankSort = 'best';

function switchRanking(el, kind) {
  document.querySelectorAll('.rank-controls .pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  _rankSort = kind;
  renderRankings();
}

function renderRankings() {
  const wrap = document.getElementById('rankTable');
  if (!wrap) return;
  // Source: live cache if present, else static data
  const officers = officerCache.length ? officerCache : ((window.STATIC_DATA && window.STATIC_DATA.officers) || []);
  if (!officers.length) {
    wrap.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;">No data yet.</div>';
    return;
  }
  // Aggregate by department
  const byDept = {};
  for (const o of officers) {
    const d = o.department || 'Unknown';
    if (!byDept[d]) byDept[d] = { name: d, total_stars: 0, review_count: 0, fair: 0, unfair: 0, officer_count: 0 };
    byDept[d].total_stars += (o.avg_stars || 0) * (o.review_count || 0);
    byDept[d].review_count += (o.review_count || 0);
    byDept[d].fair += (o.fair_count || 0);
    byDept[d].unfair += (o.unfair_count || 0);
    byDept[d].officer_count += 1;
  }
  let rows = Object.values(byDept).filter(d => d.review_count >= 1).map(d => ({
    ...d,
    avg: d.review_count ? d.total_stars / d.review_count : 0,
    unfair_pct: d.review_count ? Math.round((d.unfair / d.review_count) * 100) : 0,
  }));
  if (_rankSort === 'best')         rows.sort((a, b) => b.avg - a.avg);
  else if (_rankSort === 'busiest') rows.sort((a, b) => b.review_count - a.review_count);
  rows = rows.slice(0, 15);

  wrap.innerHTML = `
    <div class="rank-row head" style="grid-template-columns:60px 1fr 140px 100px;">
      <div class="rank-pos head">#</div>
      <div>DEPARTMENT</div>
      <div>AVG RATING</div>
      <div>MOMENTS</div>
    </div>
    ${rows.map((d, i) => `
      <div class="rank-row" style="grid-template-columns:60px 1fr 140px 100px;">
        <div class="rank-pos">${(i + 1).toString().padStart(2, '0')}</div>
        <div>
          <div class="rank-name">${escapeHtml(d.name)}</div>
          <div class="rank-name-sub">${d.officer_count} public servant${d.officer_count !== 1 ? 's' : ''} documented</div>
        </div>
        <div class="rank-stars">${'★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg))} <span style="color:var(--gray);font-size:0.78rem;">${d.avg.toFixed(1)}</span></div>
        <div class="rank-num review-count">${d.review_count}</div>
      </div>
    `).join('')}
  `;
}

// Show the demo badge if running without a backend
if (window.api && window.api.isStatic && window.api.isStatic()) {
  const badge = document.getElementById('demoBadge');
  if (badge) badge.classList.add('show');
}

// Register service worker (for PWA / offline / installability)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
