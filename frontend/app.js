// ── HOME-PAGE QUICK ACTIONS ──
// Jumps to the rate form and pre-selects fair/unfair if provided.
// (Star args from the home phone-mock are intentionally ignored — stars are
// now suggested by the system at submit time, not entered manually upfront.)
function startRateWith(verdictArg /*, starsArg */) {
  nav('rate');
  if (verdictArg) setVerdict(verdictArg);
}

// ── NAVIGATION ──
function nav(id) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.topnav button').forEach((b, i) => {
    b.classList.toggle('active', ['home', 'rate', 'officers', 'complaint', 'deck'][i] === id);
  });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'officers')  loadOfficers();
  if (id === 'home')      loadStats();
  if (id === 'complaint') renderDepartments();
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
  const longNotes  = (document.getElementById('storyIn')?.value || '');
  score += analyzeNotes(quickNotes + ' ' + longNotes);
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
  if (n === 2 && !verdict) { alert('Please tell us whether the stop was fair or unfair.'); return; }
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

// Submit — direct, no modal. The live chip already showed the user the rating the whole time.
async function submitReview() {
  // Make sure the current rating reflects the latest inputs (in case of focus changes etc.)
  refreshLiveRating();
  const btn = document.getElementById('finalSubmit');
  const errBox = document.getElementById('errorBox');
  errBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  // Combine step 1 quick story with step 3 long story if both exist
  const quickStory = (document.getElementById('quickStory')?.value || '').trim();
  const longStory  = (document.getElementById('storyIn')?.value || '').trim();
  const combinedStory = [quickStory, longStory].filter(Boolean).join('\n\n') || null;

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
    story: combinedStory,
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
      verdict = ''; stars = 0; starsOverride = null; uploadedFileUrl = null;
      setVerdict('');
      document.querySelectorAll('.tag.on').forEach(t => { t.classList.remove('on', 'pos', 'neg'); });
      ['officerName','badgeIn','deptIn','locationIn','ticketAmount','ticketViolation','storyIn','ticketNumberIn','quickStory']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      document.getElementById('lrAdjustPanel').classList.remove('show');
      refreshLiveRating();
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
refreshLiveRating();   // initial state: 4/5 charitable default

// Live update the chip as user types in the notes (debounced ~250ms)
let _notesTimer = null;
['quickStory', 'storyIn'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    clearTimeout(_notesTimer);
    _notesTimer = setTimeout(refreshLiveRating, 250);
  });
});

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
