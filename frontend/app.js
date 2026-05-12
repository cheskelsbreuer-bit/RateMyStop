// ── AUTH (localStorage-backed mock — real OAuth slots in here later) ──
//
// REAL OAUTH WIRING POINT:
// To switch this to real Google / GitHub / Email auth, replace the body of
// `signIn(provider)` with a call to Firebase Auth or Supabase Auth:
//   firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
//     .then(result => _persistUser(_toCivicVoiceUser(result.user)))
// Everything downstream (gates, handles, profile modal) keeps working as-is
// because it only reads via getCurrentUser(). Leave the localStorage cache
// in place as a session mirror so the UI stays responsive offline.

const AUTH_KEY = 'civicvoice_user_v1';
const REPLIES_KEY = 'civicvoice_replies_v1';
const ORG_KEY = 'civicvoice_org_v1';
const EMAIL_DIGEST_KEY = 'civicvoice_email_digest_v1';
const SUBS_KEY = 'civicvoice_agency_subs_v1';
const DMS_KEY = 'civicvoice_dms_v1';
const PUSH_KEY = 'civicvoice_push_v1';
let _pendingAuthAction = null;

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
  catch { return null; }
}
function _persistUser(u) {
  if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
  else localStorage.removeItem(AUTH_KEY);
  renderAuthState();
}
function _newAnonymousHandle() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Anonymous-${n}`;
}
function openAuthModal() {
  document.getElementById('authModal').classList.add('show');
}
function closeAuthModal() {
  document.getElementById('authModal').classList.remove('show');
}
function signIn(provider) {
  const existing = getCurrentUser();
  if (existing) { closeAuthModal(); _flushPendingAuth(); return existing; }
  let displayName = null;
  let email = null;
  if (provider === 'email') {
    email = (document.getElementById('authEmailInput')?.value || '').trim();
    displayName = (document.getElementById('authNameInput')?.value || '').trim() || null;
    if (!email) { alert('Please enter an email.'); return null; }
  } else if (provider === 'google') {
    // Mock — in production, swap for real Google OAuth
    displayName = null;  // user keeps the option to be anonymous
  } else if (provider === 'github') {
    displayName = null;
  }
  const user = {
    handle: _newAnonymousHandle(),
    displayName,
    email: email || null,
    anonymous: !displayName,  // anonymous by default unless they typed a name
    provider,
    signedInAt: new Date().toISOString(),
  };
  _persistUser(user);
  closeAuthModal();
  _flushPendingAuth();
  return user;
}
function _flushPendingAuth() {
  if (_pendingAuthAction) {
    const fn = _pendingAuthAction;
    _pendingAuthAction = null;
    setTimeout(fn, 150);
  }
}
// Returns true if user is already authed — caller should continue.
// Returns false if not — caller should bail; we'll resume the action after sign-in.
function requireAuth(action, intentLabel) {
  if (getCurrentUser()) return true;   // already authed; do NOT run action here (caller continues)
  _pendingAuthAction = action;
  if (intentLabel) {
    const eyebrow = document.querySelector('.auth-eyebrow');
    if (eyebrow) eyebrow.textContent = intentLabel.toUpperCase();
  }
  openAuthModal();
  return false;
}
function signOut() {
  _persistUser(null);
  closeUserMenu();
}
function toggleAnonymousMode() {
  const u = getCurrentUser();
  if (!u) return;
  u.anonymous = !u.anonymous;
  _persistUser(u);
  closeUserMenu();
}
function toggleUserMenu() {
  document.getElementById('userMenu').classList.toggle('show');
}
function closeUserMenu() {
  document.getElementById('userMenu').classList.remove('show');
}
// Close menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  const pill = document.getElementById('userPill');
  if (!menu || !pill) return;
  if (!menu.contains(e.target) && !pill.contains(e.target)) closeUserMenu();
});
function renderAuthState() {
  const u = getCurrentUser();
  const pill = document.getElementById('userPill');
  const btn = document.getElementById('signInBtn');
  if (!pill || !btn) return;
  if (u) {
    pill.style.display = 'inline-flex';
    btn.style.display = 'none';
    const shown = u.anonymous ? u.handle : (u.displayName || u.handle);
    document.getElementById('upHandle').textContent = shown;
    document.getElementById('upAvatar').textContent = shown.charAt(0).toUpperCase();
    const umH = document.getElementById('umHandle'); if (umH) umH.textContent = shown;
    const umM = document.getElementById('umMeta');
    if (umM) {
      const parts = [];
      parts.push(u.anonymous ? 'Anonymous' : 'Public name');
      if (u.email) parts.push(u.email);
      umM.textContent = parts.join(' · ');
    }
    const anonBtn = document.getElementById('umAnonToggle');
    if (anonBtn) anonBtn.innerHTML = u.anonymous ? '👁️ Show my name instead' : '🛡️ Stay anonymous';
    const dig = document.getElementById('umEmailDigest');
    if (dig) dig.innerHTML = getEmailDigestPref() ? '✉️ Weekly digest: on' : '✉️ Weekly digest: off';
    const push = document.getElementById('umPush');
    if (push) push.innerHTML = getPushPref() ? '🔔 Push notifications: on' : '🔔 Push notifications: off';
  } else {
    pill.style.display = 'none';
    btn.style.display = 'inline-flex';
  }
}

// What name to show on stories the current user posts
function getAuthorDisplay() {
  const u = getCurrentUser();
  if (!u) return 'Anonymous';
  return u.anonymous ? u.handle : (u.displayName || u.handle);
}

// ── NAVIGATION ──
const NAV_IDS = ['home', 'share', 'officers', 'map', 'rankings', 'complaint', 'orgs', 'deck'];

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
  if (id === 'orgs')      renderOrgState();
  if (id === 'admin')     renderModQueue();
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
  // Validation gates
  if (n === 2 && !currentRole) {
    alert('Pick who the moment was with — Police, EMT, Fire, DMV, Hospital, or Gov’t.');
    return;
  }
  if (n === 3) {
    const story = (document.getElementById('quickStory')?.value || '').trim();
    if (story.length < 10) {
      alert('Tell us a little about what happened — even one sentence helps.');
      return;
    }
  }
  document.getElementById('step' + step).style.display = 'none';
  step = n;
  document.getElementById('step' + n).style.display = 'block';
  // Show the live rating chip starting at step 3 — never visible during role pick or story
  const chip = document.getElementById('liveRating');
  if (chip) {
    if (n >= 3) { refreshLiveRating(); chip.classList.add('visible'); }
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

// Role selection (Step 1). All roles equal. Sets all the labels/placeholders/help text
// throughout the rest of the form so no police-specific language leaks into other roles.
let currentRole = null;

const ROLE_CONFIG = {
  police:   { who: 'Officer',     ref: 'Ticket / Citation number',          name_ph: 'e.g. K. Williams',   id_label: 'Badge #',          id_ph: 'e.g. #4821',            agency_label: 'Department / Precinct', agency_ph: 'e.g. Spring Valley PD', where_label: 'Where (location of stop)', where_ph: 'e.g. Main St & Route 59, Spring Valley', story_label: 'What happened?', story_ph: 'Tell the story. The more you share, the more it matters.', photo_help: 'A ticket, badge, or photo from the stop. JPG / PNG / PDF', show_ticket: true,  show_bodycam: true,  show_ref: true },
  emt:      { who: 'EMT / Paramedic', ref: 'Call / Run number',             name_ph: 'e.g. M. Hernandez',  id_label: 'Unit #',           id_ph: 'e.g. Unit 14',          agency_label: 'Ambulance service / EMS', agency_ph: 'e.g. Rockland Paramedic Services', where_label: 'Where', where_ph: 'e.g. Maple Ave, Spring Valley', story_label: 'What happened?', story_ph: 'How did they show up? What did they do? What will you remember?', photo_help: 'Any photo from the call. JPG / PNG / PDF', show_ticket: false, show_bodycam: false, show_ref: true },
  fire:     { who: 'Firefighter',  ref: 'Incident number',                  name_ph: 'e.g. Capt. Murphy',  id_label: 'Engine / Co. #',   id_ph: 'e.g. Engine 60',        agency_label: 'Fire department', agency_ph: 'e.g. Spring Valley FD', where_label: 'Where', where_ph: 'e.g. 14 Main St, Spring Valley', story_label: 'What happened?', story_ph: 'A rescue? An inspection? A false alarm? Tell the story.', photo_help: 'Any photo from the scene. JPG / PNG / PDF', show_ticket: false, show_bodycam: false, show_ref: true },
  dmv:      { who: 'DMV worker',   ref: 'Confirmation number',              name_ph: 'e.g. their first name',  id_label: 'Window / Station', id_ph: 'e.g. Window 5',         agency_label: 'DMV office',  agency_ph: 'e.g. NY DMV — Spring Valley', where_label: 'Which DMV', where_ph: 'e.g. Spring Valley, NY', story_label: 'What happened at the DMV?', story_ph: 'Was it fast? Slow? Did someone go out of their way? Tell us.', photo_help: 'A receipt, queue ticket, or anything from the visit. JPG / PNG / PDF', show_ticket: false, show_bodycam: false, show_ref: true },
  hospital: { who: 'Hospital staff', ref: 'Visit / Admission ID',            name_ph: 'e.g. Nurse Khan',    id_label: 'Role / Dept',      id_ph: 'e.g. RN, ER, Floor 3', agency_label: 'Hospital',    agency_ph: 'e.g. Nyack Hospital', where_label: 'Which hospital', where_ph: 'e.g. Nyack, NY', story_label: 'What happened?', photo_help: 'Wristband, paperwork, or any photo from the visit. JPG / PNG / PDF', story_ph: 'A nurse who stayed late? A tech who was rough? Tell the story.', show_ticket: false, show_bodycam: false, show_ref: true },
  gov:      { who: 'Gov’t worker', ref: 'Case / File number',               name_ph: 'e.g. their first name',  id_label: 'Title / Role',    id_ph: 'e.g. Caseworker, Inspector', agency_label: 'Agency',   agency_ph: 'e.g. NYS Unemployment Office', where_label: 'Where', where_ph: 'e.g. Spring Valley, NY', story_label: 'What happened?', photo_help: 'Letter, case ID, anything from the interaction. JPG / PNG / PDF', story_ph: 'A caseworker who fought for you? A clerk who lost your file? Tell us.', show_ticket: false, show_bodycam: false, show_ref: true },
};

function setRole(el, role) {
  currentRole = role;
  document.querySelectorAll('#rolePills .role-pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  applyRoleLabels(role);
}

function applyRoleLabels(role) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return;
  // Step 2 — story labels
  const sL = document.getElementById('storyLabel'); if (sL) sL.textContent = cfg.story_label;
  const sT = document.getElementById('quickStory'); if (sT) sT.placeholder = cfg.story_ph;
  // Step 3 — who & where labels & placeholders
  const setLabel = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };
  const setPh    = (id, text) => { const e = document.getElementById(id); if (e) e.placeholder = text; };
  setLabel('nameLabel',  `${cfg.who} name`);
  setPh   ('officerName', cfg.name_ph);
  setLabel('idLabel',    `${cfg.id_label}`);
  setPh   ('badgeIn',     cfg.id_ph);
  setLabel('agencyLabel', cfg.agency_label);
  setPh   ('deptIn',      cfg.agency_ph);
  setLabel('whereLabel',  cfg.where_label);
  setPh   ('locationIn',  cfg.where_ph);
  // Step 4 — verify section
  setPh   ('photoHelp',   cfg.photo_help);  // placeholder-style help text element
  const phHelp = document.getElementById('photoHelp'); if (phHelp) phHelp.textContent = cfg.photo_help;
  setLabel('referenceNumberLabel', cfg.ref);
  // Police-only sections
  const ticketSection = document.getElementById('ticketSection');
  if (ticketSection) ticketSection.style.display = cfg.show_ticket ? 'block' : 'none';
  const bodyCamWrap = document.getElementById('bodyCamWrap');
  if (bodyCamWrap) bodyCamWrap.style.display = cfg.show_bodycam ? 'block' : 'none';
}

const EVIDENCE_LABELS = {
  ticket:     { label: '📝 Ticket-verified',    desc: 'A ticket photo is on file. This is strong evidence.' },
  badge:      { label: '🛡️ Badge-verified',     desc: 'A badge or officer-card photo is attached.' },
  receipt:    { label: '🧾 Receipt-verified',   desc: 'A receipt or paperwork backs this up.' },
  record:     { label: '📃 Record-verified',    desc: 'A service or case record is attached.' },
  screenshot: { label: '📱 Screenshot-verified',desc: 'A screenshot or official message is attached.' },
  other:      { label: '📷 Photo-verified',      desc: 'A photo from the moment is attached.' },
};

let _lastUploadedFile = null;

async function onFileUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  _lastUploadedFile = file;
  document.getElementById('uploadName').textContent = `Uploading ${file.name}…`;
  document.getElementById('uploadPreview').classList.add('show');
  // If it's an image, offer redaction before final upload
  if (file.type.startsWith('image/')) {
    openRedact(file);
    return;  // upload happens after redact apply (or skip)
  }
  await _doUpload(file);
}

async function _doUpload(file) {
  try {
    const result = await api.uploadFile(file);
    uploadedFileUrl = result.url;
    document.getElementById('uploadName').textContent = `${file.name} uploaded ✓`;
    _refreshVerificationTier();
  } catch (err) {
    document.getElementById('uploadName').textContent = `Upload failed: ${err.message}`;
    uploadedFileUrl = null;
    _refreshVerificationTier();
  }
}

// ── PHOTO REDACTION ──
let _redactCanvas, _redactCtx, _redactImg, _redactRects = [], _redactMode = 'pixel', _redactDrag = null;

function openRedact(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      _redactImg = img;
      _redactRects = [];
      _redactMode = 'pixel';
      const c = document.getElementById('redactCanvas');
      const ctx = c.getContext('2d');
      // Fit within ~ 700w
      const maxW = 700;
      const scale = Math.min(1, maxW / img.naturalWidth);
      c.width  = Math.round(img.naturalWidth  * scale);
      c.height = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      _redactCanvas = c;
      _redactCtx = ctx;
      _attachRedactHandlers();
      setRedactMode('pixel');
      document.getElementById('redactModal').classList.add('show');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function _attachRedactHandlers() {
  if (_redactCanvas._wired) return;
  _redactCanvas._wired = true;
  const rectAt = (evt) => {
    const r = _redactCanvas.getBoundingClientRect();
    const sx = _redactCanvas.width / r.width;
    const sy = _redactCanvas.height / r.height;
    const px = (evt.touches ? evt.touches[0].clientX : evt.clientX) - r.left;
    const py = (evt.touches ? evt.touches[0].clientY : evt.clientY) - r.top;
    return { x: px * sx, y: py * sy };
  };
  const onDown = (e) => { e.preventDefault(); const p = rectAt(e); _redactDrag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
  const onMove = (e) => { if (!_redactDrag) return; const p = rectAt(e); _redactDrag.x1 = p.x; _redactDrag.y1 = p.y; _redrawRedact(); };
  const onUp   = () => {
    if (!_redactDrag) return;
    const r = _redactDrag;
    if (Math.abs(r.x1 - r.x0) > 5 && Math.abs(r.y1 - r.y0) > 5) {
      _redactRects.push({ x: Math.min(r.x0,r.x1), y: Math.min(r.y0,r.y1), w: Math.abs(r.x1-r.x0), h: Math.abs(r.y1-r.y0), mode: _redactMode });
    }
    _redactDrag = null;
    _redrawRedact();
  };
  _redactCanvas.addEventListener('mousedown', onDown);
  _redactCanvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  _redactCanvas.addEventListener('touchstart', onDown, { passive: false });
  _redactCanvas.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
}
function setRedactMode(mode) {
  _redactMode = mode;
  document.getElementById('redactModePixel').classList.toggle('primary', mode === 'pixel');
  document.getElementById('redactModeBlack').classList.toggle('primary', mode === 'black');
}
function redactUndo() { _redactRects.pop(); _redrawRedact(); }
function redactReset() { _redactRects = []; _redrawRedact(); }
function _redrawRedact() {
  _redactCtx.drawImage(_redactImg, 0, 0, _redactCanvas.width, _redactCanvas.height);
  // Apply each saved rect
  for (const r of _redactRects) _applyRedact(r);
  // Draw the in-progress drag rect
  if (_redactDrag) {
    _redactCtx.save();
    _redactCtx.strokeStyle = 'rgba(184,148,30,0.9)';
    _redactCtx.setLineDash([6, 4]);
    _redactCtx.lineWidth = 2;
    _redactCtx.strokeRect(_redactDrag.x0, _redactDrag.y0, _redactDrag.x1 - _redactDrag.x0, _redactDrag.y1 - _redactDrag.y0);
    _redactCtx.restore();
  }
}
function _applyRedact(r) {
  if (r.mode === 'black') {
    _redactCtx.fillStyle = '#000';
    _redactCtx.fillRect(r.x, r.y, r.w, r.h);
    return;
  }
  // Pixelate: redraw the rect at low res
  const cell = Math.max(8, Math.round(Math.min(r.w, r.h) / 14));
  for (let yy = r.y; yy < r.y + r.h; yy += cell) {
    for (let xx = r.x; xx < r.x + r.w; xx += cell) {
      const data = _redactCtx.getImageData(xx, yy, 1, 1).data;
      _redactCtx.fillStyle = `rgb(${data[0]},${data[1]},${data[2]})`;
      _redactCtx.fillRect(xx, yy, cell, cell);
    }
  }
}
function closeRedact() {
  document.getElementById('redactModal').classList.remove('show');
  // If user closed without applying, still upload the original
  if (_lastUploadedFile && !uploadedFileUrl) {
    _doUpload(_lastUploadedFile);
  }
}
async function redactApply() {
  _redactCanvas.toBlob(async (blob) => {
    const file = new File([blob], 'redacted-' + (_lastUploadedFile?.name || 'photo.png'), { type: blob.type });
    document.getElementById('redactModal').classList.remove('show');
    await _doUpload(file);
    document.getElementById('uploadName').textContent = `${file.name} (redacted) ✓`;
  }, 'image/jpeg', 0.9);
}

// ── PER-STORY SHARE CARDS (canvas-generated) ──
function generateShareCard(officer, review) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 675;
  const ctx = c.getContext('2d');
  // Background
  ctx.fillStyle = '#fafaf7'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fef9e7'; ctx.fillRect(0, c.height - 60, c.width, 60);  // gold strip bottom
  // Top brand row
  ctx.fillStyle = '#b8941e';
  ctx.fillRect(60, 60, 40, 40);
  ctx.fillStyle = '#1a1a1d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('C', 73, 90);
  ctx.fillStyle = '#1a1a1d';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('CivicVoice', 116, 92);
  ctx.fillStyle = '#7a7a82';
  ctx.font = '15px sans-serif';
  ctx.fillText('your voice on every public servant', 116, 113);
  // Role + agency
  const role = inferRole(officer);
  const isPos = review.verdict === 'fair';
  ctx.fillStyle = isPos ? '#1f8c5f' : '#c93434';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText((isPos ? '★ RECOGNITION' : '⚠ CONCERN') + ' · ' + (role || '').toUpperCase(), 60, 180);
  // Officer name
  ctx.fillStyle = '#1a1a1d';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(officer.name || 'Unknown', 60, 240);
  // Department
  ctx.fillStyle = '#3d3d45';
  ctx.font = '22px sans-serif';
  ctx.fillText(officer.department || '', 60, 274);
  // Quoted story
  ctx.fillStyle = '#1a1a1d';
  ctx.font = 'italic 28px Georgia, serif';
  const text = (review.story || '').slice(0, 280);
  wrapText(ctx, '“' + text + '”', 60, 340, c.width - 120, 38);
  // Footer
  ctx.fillStyle = '#7a7a82';
  ctx.font = '16px sans-serif';
  ctx.fillText('Read on CivicVoice → ' + (window.location.host || 'civicvoice.com'), 60, c.height - 28);
  return c;
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = w + ' ';
      y += lineHeight; lines++;
      if (lines >= 6) { ctx.fillText(line + '…', x, y); return; }
    } else line = test;
  }
  ctx.fillText(line, x, y);
}
async function shareStoryCard(officerId, reviewId) {
  const it = _streamIndex[`${officerId}:${reviewId}`];
  if (!it) return shareTo('native');
  const c = generateShareCard(it.officer, it.review);
  c.toBlob(async (blob) => {
    const file = new File([blob], 'civicvoice-story.jpg', { type: 'image/jpeg' });
    const url = window.location.origin + window.location.pathname;
    const text = `${it.officer.name || 'A public servant'} — ${(it.review.story || '').slice(0, 100)}${(it.review.story || '').length > 100 ? '…' : ''}`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ title: 'CivicVoice', text, url, files: [file] }); return; }
      catch { /* fall through to download */ }
    }
    // Fallback — download the card so the user can attach it manually
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'civicvoice-story.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }, 'image/jpeg', 0.9);
}

function _refreshVerificationTier() {
  const tier = document.getElementById('verificationTier');
  if (!tier) return;
  const type = document.getElementById('evidenceType')?.value;
  if (!uploadedFileUrl || !type) {
    tier.style.display = 'none';
    return;
  }
  const info = EVIDENCE_LABELS[type] || EVIDENCE_LABELS.other;
  tier.innerHTML = `<strong>${info.label}</strong> &mdash; ${info.desc}`;
  tier.style.display = 'block';
}

// Update verification tier whenever the evidence type changes
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'evidenceType') _refreshVerificationTier();
});

// Submit — direct, no modal. The live chip already showed the user the rating the whole time.
async function submitReview() {
  if (!requireAuth(() => submitReview(), 'Sign in to post your story')) return;
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
  const author = getCurrentUser();
  const authorDisplay = author ? (anonymous ? author.handle : (author.displayName || author.handle)) : 'Anonymous';
  const payload = {
    kind: 'moment',
    role: currentRole,
    author_handle: author?.handle || null,
    author_display: authorDisplay,
    author_provider: author?.provider || null,
    verdict: verdict || 'fair',  // backend requires fair|unfair; default to fair for balanced/positive moments
    stars,
    reasons: [],
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
    evidence_type: document.getElementById('evidenceType')?.value || null,
    tags: (document.getElementById('storyTags')?.value || '').split(',').map(s => s.trim().toLowerCase().replace(/^#/, '')).filter(Boolean),
    anonymous,
    reviewer_name: anonymous ? null : (document.getElementById('reviewerName')?.value || null),
    body_cam: bodyCamAnswer,
  };

  try {
    const result = await api.submitReview(payload);
    // Tailor success copy to demo mode vs live
    const isDemo = result && result.demo;
    const sTitle = document.getElementById('successTitle');
    const sSub   = document.getElementById('successSub');
    if (isDemo) {
      if (sTitle) sTitle.textContent = 'Your story is saved (preview mode).';
      if (sSub)   sSub.innerHTML = 'When we go live, it joins the public record. For now, share it with your network below.';
    } else {
      if (sTitle) sTitle.textContent = 'Your story is on the record.';
      if (sSub)   sSub.textContent = 'Public service is real because of moments like this. Help others see it.';
    }
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
      const evType = document.getElementById('evidenceType'); if (evType) evType.value = '';
      const vTier  = document.getElementById('verificationTier'); if (vTier) vTier.style.display = 'none';
      ['officerName','badgeIn','deptIn','locationIn','ticketAmount','ticketViolation','ticketNumberIn','quickStory','reviewerName','storyTags']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      // Clear role selection — user picks fresh each time
      currentRole = null;
      document.querySelectorAll('#rolePills .role-pill').forEach(p => p.classList.remove('on'));
      const bodyCamWrap = document.getElementById('bodyCamWrap'); if (bodyCamWrap) bodyCamWrap.style.display = 'none';
      const ticketSection = document.getElementById('ticketSection'); if (ticketSection) ticketSection.style.display = 'none';
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
let activePill = '';  // '' = All; or 'police','emt',...,'top'

function starsStr(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

async function loadOfficers() {
  const stream = document.getElementById('storyStream');
  const grid = document.getElementById('officerGrid');
  if (stream) stream.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;">Loading stories…</div>';
  if (grid)   grid.innerHTML   = '<div style="color:var(--gray);text-align:center;padding:40px 0;">Loading…</div>';
  try {
    officerCache = await api.listOfficers();
    applyFilters();
  } catch (err) {
    if (stream) stream.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px 0;">Couldn't load stories: ${err.message}</div>`;
  }
}

// Stream / grid toggle
let storiesView = 'stream';
function setStoriesView(el, view) {
  storiesView = view;
  document.querySelectorAll('.view-toggle .vt-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('storyStream').style.display = view === 'stream' ? 'flex' : 'none';
  document.getElementById('officerGrid').style.display = view === 'grid'   ? 'grid' : 'none';
  applyFilters();
}

function renderOfficers(list) {
  const grid = document.getElementById('officerGrid');
  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;">Nothing matches yet. Be the first — <button onclick="nav(\'share\')" style="background:none;border:none;color:var(--accent);cursor:pointer;text-decoration:underline;font-family:inherit;font-size:inherit;">share a story</button>.</div>';
    return;
  }
  const ICON = { police:'🚔', emt:'🚑', fire:'🚒', dmv:'🪪', hospital:'🏥', gov:'👨‍💼' };
  grid.innerHTML = list.map(o => {
    const role = inferRole(o);
    return `
    <div class="officer-card" onclick="openOfficer(${o.id})">
      <div class="oc-top">
        <div class="oc-av">${ICON[role] || '👤'}</div>
        <div style="flex:1;min-width:0;">
          <div class="oc-name">${escapeHtml(o.name || 'Unknown')}</div>
          <div class="oc-dept">${escapeHtml(o.department || 'Unknown agency')}</div>
        </div>
      </div>
      <div class="oc-stars">${starsStr(Math.round(o.avg_stars || 0))} <span style="font-size:0.78rem;color:var(--gray);margin-left:4px;">${(o.avg_stars || 0).toFixed(1)}</span></div>
      <div class="oc-meta">
        ${o.fair_count > 0 ? `<span class="oc-chip fair">${o.fair_count} ${o.fair_count === 1 ? 'recognition' : 'recognitions'}</span>` : ''}
        ${o.unfair_count > 0 ? `<span class="oc-chip unfair">${o.unfair_count} concern${o.unfair_count === 1 ? '' : 's'}</span>` : ''}
      </div>
      <div class="oc-reviews">${o.review_count} stor${o.review_count === 1 ? 'y' : 'ies'} · tap to read</div>
    </div>
  `;}).join('');
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
        <div class="ms-box"><div class="ms-n">${(o.avg_stars || 0).toFixed(1)}★</div><div class="ms-l">Sentiment</div></div>
        <div class="ms-box"><div class="ms-n">${o.review_count}</div><div class="ms-l">Stories</div></div>
        <div class="ms-box"><div class="ms-n">${o.fair_count}</div><div class="ms-l">Recognitions</div></div>
      </div>
      ${o.reviews.map(r => `
        <div class="mo-review">
          <div class="mr-top">
            <div class="mr-stars">${starsStr(r.stars)}</div>
            <div>
              <span class="mr-verdict ${r.verdict}">${r.verdict === 'fair' ? '★ Recognition' : '⚠ Concern'}</span>
              ${r.upload_url ? '<span class="flag-verified" style="margin-left:6px;">🛡️ Verified</span>' : ''}
            </div>
          </div>
          <div class="mr-text">${escapeHtml(r.story || 'No description provided.')}</div>
          <div class="mr-date">${formatDate(r.created_at)}</div>
        </div>
      `).join('')}
      <button class="submit-main" style="margin-top:18px;" onclick="document.getElementById('officerModal').classList.remove('show'); nav('complaint');">Send a message to this agency →</button>
    `;
  } catch (err) {
    modal.innerHTML = `<div style="color:var(--red);padding:40px 0;text-align:center;">Couldn't load officer: ${err.message}</div>`;
  }
}

function closeModal(e) {
  if (e.target.id === 'officerModal') document.getElementById('officerModal').classList.remove('show');
}

function searchOfficers() { applyFilters(); }

// Click a #tag chip → jump to Stories with the tag pre-filtered in the search
function filterByTag(tag) {
  nav('officers');
  const input = document.getElementById('officerSearch');
  if (input) {
    input.value = '#' + tag;
    setTimeout(() => applyFilters(), 50);
  }
}

function pillClick(el) {
  // Only update pills within the same pill group (don't cross-touch the rankings pills)
  const group = el.parentElement;
  if (group) group.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  activePill = el.dataset.rolefilter !== undefined ? el.dataset.rolefilter : el.textContent.trim();
  applyFilters();
}

function inferRole(o) {
  const d = (o.department || '').toLowerCase();
  const n = (o.name || '').toLowerCase();
  if (/\b(ems|ambulance|paramedic)\b/.test(d) || /\b(emt|paramedic|lt\. paramedic)\b/.test(n)) return 'emt';
  if (/\b(fire|fd|engine|hose)\b/.test(d) || /\b(firefighter|capt\.|lt\. firefighter)\b/.test(n)) return 'fire';
  if (/\bdmv\b/.test(d) || /\b(clerk|window)\b/.test(n)) return 'dmv';
  if (/\b(hospital|medical|sinai|montefiore|good samaritan|langone|nyack hospital)\b/.test(d) || /\b(nurse|rn|pa|tech|admissions)\b/.test(n)) return 'hospital';
  if (/\b(tax|hra|housing|unemployment|county clerk|dept of)\b/.test(d) || /\b(caseworker|case manager|inspector|specialist)\b/.test(n)) return 'gov';
  return 'police';
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
  const f = activePill;
  if (f && f !== 'top') {
    list = list.filter(o => inferRole(o) === f);
  } else if (f === 'top') {
    list = list.filter(o => (o.avg_stars || 0) >= 4).sort((a, b) => (b.avg_stars || 0) - (a.avg_stars || 0));
  }
  renderOfficers(list);
  renderStream(list, q);
}

const ROLE_ICON = { police:'🚔', emt:'🚑', fire:'🚒', dmv:'🪪', hospital:'🏥', gov:'👨‍💼' };
const ROLE_NAME = { police:'POLICE', emt:'EMT', fire:'FIRE', dmv:'DMV', hospital:'HOSPITAL', gov:'GOV\'T' };
const STORY_PREVIEW_CHARS = 280;
let _streamIndex = {};  // map of `${officerId}:${reviewId}` → {officer, review, role}

// Generate a stable handle for seed/legacy stories that have no author attached.
function _legacyAuthor(officerId, reviewId) {
  const n = ((officerId * 7919 + reviewId * 11) % 9000) + 1000;
  return `Anonymous-${n}`;
}

// Flatten all officers' reviews into a flat stream, sorted newest-first.
function renderStream(officers, q) {
  const stream = document.getElementById('storyStream');
  if (!stream) return;

  let items = [];
  for (const o of officers) {
    const role = inferRole(o);
    for (const r of (o.reviews || [])) {
      items.push({ officer: o, review: r, role });
      _streamIndex[`${o.id}:${r.id}`] = { officer: o, review: r, role };
    }
  }
  if (q) {
    // Tag search: query starts with '#' → match against story.tags
    if (q.startsWith('#')) {
      const wanted = q.slice(1).trim();
      items = items.filter(it => (it.review.tags || []).some(t => t.toLowerCase().includes(wanted)));
    } else {
      items = items.filter(it => (it.review.story || '').toLowerCase().includes(q) ||
                                 (it.officer.name || '').toLowerCase().includes(q) ||
                                 (it.officer.department || '').toLowerCase().includes(q) ||
                                 ((it.review.tags || []).some(t => t.toLowerCase().includes(q))));
    }
  }
  items.sort((a, b) => new Date(b.review.created_at || 0) - new Date(a.review.created_at || 0));
  items = items.slice(0, 60);

  if (!items.length) {
    stream.innerHTML = `<div style="color:var(--gray);text-align:center;padding:48px 0;">No stories yet for this filter. <button onclick="nav('share')" style="background:none;border:none;color:var(--accent);cursor:pointer;text-decoration:underline;font-family:inherit;font-size:inherit;">Be the first to share one →</button></div>`;
    return;
  }

  stream.innerHTML = items.map(it => {
    const o = it.officer;
    const r = it.review;
    const isPositive = r.verdict === 'fair';
    const sentimentClass = isPositive ? 'pos' : 'neg';
    const sentimentTag   = isPositive ? '★ Recognition' : '⚠ Concern';
    const date = formatDate(r.created_at);
    const rawStory = (r.story || '').trim() || '(No description was provided with this story.)';
    const truncated = rawStory.length > STORY_PREVIEW_CHARS;
    const shown = truncated ? rawStory.slice(0, STORY_PREVIEW_CHARS).replace(/\s+\S*$/, '') + '…' : rawStory;
    const author = r.author_display || _legacyAuthor(o.id, r.id);
    const authorInitial = author.charAt(0).toUpperCase();
    return `
      <article class="story-post" onclick="openStoryDetail(${o.id}, ${r.id})">
        <div class="sp-head">
          <div class="sp-icon">${ROLE_ICON[it.role] || '👤'}</div>
          <div class="sp-meta">
            <div class="sp-who">
              <span class="sp-name" onclick="event.stopPropagation(); openOfficer(${o.id})">${escapeHtml(o.name || 'Unknown')}</span>
              <span class="sp-role">${ROLE_NAME[it.role] || ''}</span>
            </div>
            <div class="sp-agency">${escapeHtml(o.department || 'Unknown agency')}${r.location ? ' <span class="sp-loc">· ' + escapeHtml(r.location) + '</span>' : ''}</div>
          </div>
          <div class="sp-sentiment ${sentimentClass}">
            <span class="sp-stars">${starsStr(r.stars || 3)}</span>
            <span class="sp-tag">${sentimentTag}</span>
          </div>
        </div>
        <div class="sp-body">${escapeHtml(shown)}${truncated ? ' <button class="sp-readmore" onclick="event.stopPropagation(); openStoryDetail(' + o.id + ', ' + r.id + ')">Read full</button>' : ''}</div>
        ${(r.tags && r.tags.length) ? `<div class="sp-tags-row">${r.tags.slice(0, 5).map(t => `<span class="spt" onclick="event.stopPropagation(); filterByTag('${escapeHtml(t).replace(/'/g, "\\'")}');">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="sp-byline">
          <span class="sp-author" style="cursor:pointer;" onclick="event.stopPropagation(); openAuthorProfile('${escapeHtml(author).replace(/'/g, "\\'")}');"><span class="sp-author-avatar">${escapeHtml(authorInitial)}</span>${escapeHtml(author)}</span>
          <span class="sp-sep">·</span>
          <span>${date}</span>
          ${r.upload_url ? '<span class="sp-sep">·</span><span style="color:var(--blue);">🛡️ Verified</span>' : ''}
        </div>
        <div class="sp-foot">
          <div class="sp-actions">
            <button class="sp-action up" onclick="thanksTo(this, event)">👍 Same here</button>
            ${getReplyCount(o.id, r.id) > 0 ? `<button class="sp-action" onclick="event.stopPropagation(); openStoryDetail(${o.id}, ${r.id})">💬 ${getReplyCount(o.id, r.id)} repl${getReplyCount(o.id, r.id) === 1 ? 'y' : 'ies'}</button>` : ''}
            <button class="sp-action" onclick="event.stopPropagation(); shareStoryCard(${o.id}, ${r.id})">🔗 Share card</button>
            <button class="sp-action primary" onclick="event.stopPropagation(); openStoryDetail(${o.id}, ${r.id})">Read full →</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ── STORY DETAIL MODAL ──
function openStoryDetail(officerId, reviewId) {
  const it = _streamIndex[`${officerId}:${reviewId}`];
  if (!it) return;
  const o = it.officer;
  const r = it.review;
  const isPositive = r.verdict === 'fair';
  const sClass = isPositive ? 'pos' : 'neg';
  const sTag   = isPositive ? '★ Recognition' : '⚠ Concern';
  const story = (r.story || '').trim() || '(No description was provided.)';
  const author = r.author_display || _legacyAuthor(o.id, r.id);
  const authorInitial = author.charAt(0).toUpperCase();
  const body = document.getElementById('storyDetailBody');
  body.innerHTML = `
    <div class="sd-eyebrow">A moment on the record</div>
    <div class="sd-head">
      <div class="sd-icon">${ROLE_ICON[it.role] || '👤'}</div>
      <div class="sd-who">
        <div class="sd-name" onclick="closeStoryDetail(); openOfficer(${o.id})">${escapeHtml(o.name || 'Unknown')}</div>
        <div class="sd-agency">${escapeHtml(o.department || 'Unknown agency')}${r.location ? ' · ' + escapeHtml(r.location) : ''}</div>
        <div class="sd-sent">
          <span class="sd-stars">${starsStr(r.stars || 3)}</span>
          <span class="sd-tag ${sClass}">${sTag}</span>
        </div>
      </div>
    </div>
    <div class="sd-body">${escapeHtml(story)}</div>
    <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="sp-action" onclick="translateStory(${JSON.stringify(story).replace(/"/g, '&quot;')})">&#127760; Translate</button>
      ${(r.tags && r.tags.length) ? r.tags.map(t => `<span class="spt" onclick="closeStoryDetail(); filterByTag('${escapeHtml(t).replace(/'/g, "\\'")}');">#${escapeHtml(t)}</span>`).join('') : ''}
    </div>
    <div class="sd-foot">
      <div class="sd-byline">
        <span class="sd-author-avatar">${escapeHtml(authorInitial)}</span>
        Posted by <strong style="color:var(--ink);cursor:pointer;text-decoration:underline;text-underline-offset:3px;" onclick="closeStoryDetail(); openAuthorProfile('${escapeHtml(author).replace(/'/g, "\\'")}');">${escapeHtml(author)}</strong>
        · ${formatDate(r.created_at)}
        ${r.upload_url ? ' · <span style="color:var(--blue);">🛡️ Verified</span>' : ''}
      </div>
      <button class="sp-action up" onclick="thanksTo(this, event)">👍 Same here</button>
      <button class="sp-action" onclick="shareStoryCard(${o.id}, ${r.id})">🔗 Share card</button>
      <button class="sp-action primary" onclick="closeStoryDetail(); openOfficer(${o.id})">View full profile →</button>
    </div>
    <div class="reply-thread">
      <div class="reply-thread-head">
        <span class="reply-thread-title">&#128172; Thread <span id="replyCountBadge" style="color:var(--gray);font-weight:500;margin-left:6px;"></span></span>
      </div>
      <div class="reply-list" id="replyList"></div>
      <div class="reply-form">
        <textarea id="replyText" placeholder="Add to this thread — share a similar moment, ask a question, or speak up."></textarea>
        <div class="reply-form-foot">
          <span class="reply-as" id="replyAsHint"></span>
          <button class="rcm-confirm" style="padding:9px 18px;font-size:0.85rem;" onclick="postReply(${o.id}, ${r.id})">Post reply &rarr;</button>
        </div>
      </div>
    </div>
  `;
  // Render existing replies and update the "post as" hint
  _renderReplies(o.id, r.id);
  const count = getReplyCount(o.id, r.id);
  const badge = document.getElementById('replyCountBadge');
  if (badge) badge.textContent = count ? `· ${count} repl${count === 1 ? 'y' : 'ies'}` : '';
  const hint = document.getElementById('replyAsHint');
  if (hint) {
    const user = getCurrentUser();
    const org = getCurrentOrg();
    if (org && org.verified) hint.innerHTML = `Posting as <strong style="color:var(--green);">&#9989; ${escapeHtml(org.agency_name)}</strong>`;
    else if (user)            hint.innerHTML = `Posting as <strong style="color:var(--accent);">${escapeHtml(user.anonymous ? user.handle : (user.displayName || user.handle))}</strong>`;
    else                       hint.innerHTML = `<span style="color:var(--gray);">Sign in to reply</span>`;
  }
  document.getElementById('storyDetailModal').classList.add('show');
}
function closeStoryDetail() {
  document.getElementById('storyDetailModal').classList.remove('show');
}

// ── REPLIES (forum threads under each story) ──
function _readAllReplies() {
  try { return JSON.parse(localStorage.getItem(REPLIES_KEY) || '{}'); }
  catch { return {}; }
}
function _writeAllReplies(map) {
  localStorage.setItem(REPLIES_KEY, JSON.stringify(map));
}
function _storyKey(officerId, reviewId) { return `${officerId}:${reviewId}`; }

function getReplies(officerId, reviewId) {
  const all = _readAllReplies();
  return all[_storyKey(officerId, reviewId)] || [];
}
function getReplyCount(officerId, reviewId) {
  return getReplies(officerId, reviewId).length;
}

function postReply(officerId, reviewId) {
  if (!requireAuth(() => postReply(officerId, reviewId), 'Sign in to reply')) return;
  const ta = document.getElementById('replyText');
  const body = (ta?.value || '').trim();
  if (!body) { alert('Type a reply first.'); return; }

  const user = getCurrentUser();
  const org  = getCurrentOrg();
  const map = _readAllReplies();
  const k = _storyKey(officerId, reviewId);
  map[k] = map[k] || [];
  map[k].push({
    id: 'r' + Date.now(),
    author_handle: user.handle,
    author_display: user.anonymous ? user.handle : (user.displayName || user.handle),
    is_agency_response: !!(org && org.verified),
    agency_name: org && org.verified ? org.agency_name : null,
    body,
    created_at: new Date().toISOString(),
  });
  _writeAllReplies(map);
  ta.value = '';
  _renderReplies(officerId, reviewId);
}

function _renderReplies(officerId, reviewId) {
  const list = document.getElementById('replyList');
  if (!list) return;
  const replies = getReplies(officerId, reviewId);
  if (!replies.length) {
    list.innerHTML = '<div style="color:var(--gray);font-size:0.86rem;text-align:center;padding:14px 0;">No replies yet. Be the first to add to this thread.</div>';
    return;
  }
  list.innerHTML = replies.map(r => {
    const initial = (r.author_display || 'A').charAt(0).toUpperCase();
    return `
      <div class="reply-item${r.is_agency_response ? ' is-agency' : ''}">
        <div class="reply-head">
          <span class="reply-author" onclick="openAuthorProfile('${escapeHtml(r.author_display).replace(/'/g, "\\'")}');">
            <span class="reply-avatar">${escapeHtml(initial)}</span>
            <strong>${escapeHtml(r.author_display)}</strong>
            ${r.is_agency_response ? `<span class="reply-agency-badge">&#9989; Verified: ${escapeHtml(r.agency_name || 'Agency')}</span>` : ''}
          </span>
          <span class="reply-date">${formatDate(r.created_at)}</span>
        </div>
        <div class="reply-body">${escapeHtml(r.body)}</div>
      </div>
    `;
  }).join('');
}

// ── AUTHOR PROFILE — click any handle to see their full history ──
function openAuthorProfile(handle) {
  if (!handle) return;
  // Gather every story attributed to this handle
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const items = [];
  for (const o of officers) {
    for (const r of (o.reviews || [])) {
      const author = r.author_display || _legacyAuthor(o.id, r.id);
      if (author === handle) items.push({ officer: o, review: r, role: inferRole(o) });
    }
  }
  items.sort((a, b) => new Date(b.review.created_at || 0) - new Date(a.review.created_at || 0));

  // Compute sentiment summary
  const total = items.length;
  const fair = items.filter(it => it.review.verdict === 'fair').length;
  const unfair = total - fair;
  const avgStars = total ? (items.reduce((s, it) => s + (it.review.stars || 3), 0) / total) : 0;
  const tone = total === 0 ? 'no stories yet'
              : fair / total >= 0.7 ? 'overwhelmingly positive'
              : fair / total >= 0.5 ? 'mostly positive'
              : fair / total >= 0.35 ? 'mixed'
              : 'mostly critical';
  const toneColor = fair / total >= 0.5 ? 'var(--green)' : (fair / total >= 0.35 ? 'var(--accent)' : 'var(--red)');

  const initial = handle.charAt(0).toUpperCase();
  const isCurrentUser = (() => {
    const u = getCurrentUser();
    return u && (u.handle === handle || u.displayName === handle);
  })();

  const body = document.getElementById('authorProfileBody');
  body.innerHTML = `
    <div class="sd-eyebrow">Contributor</div>
    <div class="sd-head">
      <div class="sd-icon" style="background:var(--accent-soft);color:var(--accent);font-family:'Syne',sans-serif;font-weight:800;font-size:1.6rem;">${escapeHtml(initial)}</div>
      <div class="sd-who">
        <div class="sd-name" style="cursor:default;">${escapeHtml(handle)}${isCurrentUser ? ' <span style="font-size:0.7rem;color:var(--accent);font-weight:600;background:var(--accent-soft);border:1px solid rgba(184,148,30,0.3);border-radius:999px;padding:2px 8px;margin-left:6px;vertical-align:middle;">You</span>' : ''}</div>
        <div class="sd-agency">${total} stor${total === 1 ? 'y' : 'ies'} on the record · sentiment <strong style="color:${toneColor};">${tone}</strong></div>
        <div class="sd-sent">
          <span class="sd-stars">${starsStr(Math.round(avgStars))}</span>
          <span class="sd-tag pos" style="background:rgba(31,140,95,0.1);">${fair} ★</span>
          <span class="sd-tag neg" style="background:rgba(201,52,52,0.08);">${unfair} ⚠</span>
        </div>
      </div>
    </div>
    ${items.length === 0 ? `
      <div style="color:var(--gray);padding:30px 0;text-align:center;">This contributor hasn't posted any stories yet.</div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${items.slice(0, 12).map(it => {
          const o = it.officer;
          const r = it.review;
          const isPos = r.verdict === 'fair';
          const story = (r.story || '').trim();
          const preview = story.length > 180 ? story.slice(0, 180).replace(/\s+\S*$/, '') + '…' : (story || '(No description.)');
          return `
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;cursor:pointer;" onclick="closeAuthorProfile(); openStoryDetail(${o.id}, ${r.id});">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
                <div style="font-weight:700;font-size:0.9rem;color:var(--ink);">${ROLE_ICON[it.role] || '👤'} ${escapeHtml(o.name || 'Unknown')}</div>
                <span style="font-size:0.68rem;font-weight:700;color:${isPos ? 'var(--green)' : 'var(--red)'};text-transform:uppercase;letter-spacing:0.5px;background:${isPos ? 'rgba(31,140,95,0.1)' : 'rgba(201,52,52,0.08)'};padding:2px 8px;border-radius:999px;">${isPos ? '★ Recognition' : '⚠ Concern'}</span>
              </div>
              <div style="font-size:0.83rem;color:var(--gray);margin-bottom:8px;">${escapeHtml(o.department || '')}</div>
              <div style="font-size:0.92rem;line-height:1.6;color:var(--light);">${escapeHtml(preview)}</div>
              <div style="font-size:0.74rem;color:var(--gray);margin-top:8px;">${formatDate(r.created_at)}${r.upload_url ? ' · 🛡️ Verified' : ''}</div>
            </div>
          `;
        }).join('')}
      </div>
      ${items.length > 12 ? `<div style="font-size:0.82rem;color:var(--gray);text-align:center;margin-top:14px;">+ ${items.length - 12} more stories</div>` : ''}
    `}
    <div class="sd-foot" style="margin-top:18px;">
      <div class="sd-byline" style="flex:1;">
        ${(() => {
          const t = computeTrustScore(handle);
          return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:0.78rem;color:var(--gray);">Trust score:</span>
            <strong style="color:${t.tier.color};font-size:0.95rem;">${t.score}/100 · ${t.tier.label}</strong>
            <span style="flex:1;min-width:100px;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden;">
              <span style="display:block;width:${t.score}%;height:100%;background:${t.tier.color};"></span>
            </span>
          </div>`;
        })()}
      </div>
      ${!isCurrentUser ? `<button class="sp-action" onclick="openDMThread('${escapeHtml(handle).replace(/'/g, "\\'")}');">💌 Message</button>` : ''}
      ${!isCurrentUser ? '<button class="sp-action">Report</button>' : ''}
    </div>
  `;
  document.getElementById('authorProfileModal').classList.add('show');
}
function closeAuthorProfile() {
  document.getElementById('authorProfileModal').classList.remove('show');
}

// ── SUBSCRIBE TO AGENCY ──
function getSubs() {
  try { return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]'); } catch { return []; }
}
function _setSubs(arr) { localStorage.setItem(SUBS_KEY, JSON.stringify(arr)); }
function isSubscribed(agencyName) { return getSubs().includes(agencyName); }
function toggleSubscribe(agencyName, btn) {
  if (!requireAuth(() => toggleSubscribe(agencyName, btn), 'Sign in to subscribe')) return;
  let subs = getSubs();
  if (subs.includes(agencyName)) {
    subs = subs.filter(s => s !== agencyName);
    if (btn) { btn.innerHTML = '🔔 Subscribe'; btn.classList.remove('subscribed'); }
  } else {
    subs.push(agencyName);
    if (btn) { btn.innerHTML = '✓ Subscribed'; btn.classList.add('subscribed'); }
  }
  _setSubs(subs);
}

// ── TRUST SCORE — compute author trustworthiness from existing data ──
function computeTrustScore(handle) {
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  let total = 0, verified = 0, fair = 0;
  for (const o of officers) {
    for (const r of (o.reviews || [])) {
      const a = r.author_display || _legacyAuthor(o.id, r.id);
      if (a === handle) {
        total++;
        if (r.upload_url) verified++;
        if (r.verdict === 'fair') fair++;
      }
    }
  }
  // Score formula:
  //   30 base (has account)
  //   +2 per story posted, cap +40 (20 stories)
  //   +5 per verified story, cap +20 (4 verified)
  //   +10 for balanced sentiment (fair % between 30-70)
  let score = 30;
  score += Math.min(total * 2, 40);
  score += Math.min(verified * 5, 20);
  if (total >= 3) {
    const fairPct = fair / total;
    if (fairPct >= 0.3 && fairPct <= 0.7) score += 10;
  }
  score = Math.min(100, Math.max(0, score));
  const tier =
    score >= 85 ? { label: 'Expert',   color: 'var(--green)' } :
    score >= 60 ? { label: 'Trusted',  color: 'var(--accent)' } :
    score >= 30 ? { label: 'Active',   color: 'var(--blue)' } :
                  { label: 'New',      color: 'var(--gray)' };
  return { score, tier, total, verified, fair };
}

// ── TRANSLATE — opens Google Translate with the story text ──
function translateStory(text) {
  const t = encodeURIComponent((text || '').slice(0, 5000));
  window.open(`https://translate.google.com/?sl=auto&tl=en&text=${t}&op=translate`, '_blank', 'noopener');
}

// ── PUSH NOTIFICATIONS — request permission, show a sample, document real backend ──
function getPushPref() {
  try { return JSON.parse(localStorage.getItem(PUSH_KEY) || 'false'); } catch { return false; }
}
function _setPushPref(on) { localStorage.setItem(PUSH_KEY, JSON.stringify(!!on)); }
async function togglePushNotifications() {
  closeUserMenu();
  if (!('Notification' in window)) { alert('Your browser does not support notifications.'); return; }
  if (getPushPref()) {
    _setPushPref(false);
    alert('Push notifications turned off.');
    renderAuthState();
    return;
  }
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Please allow notifications in your browser settings.'); return; }
  _setPushPref(true);
  renderAuthState();
  // Demo notification so the user sees it works
  new Notification('CivicVoice', {
    body: 'Notifications enabled. We\'ll ping you when there\'s activity on your stories.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
  });
}

// ── DIRECT MESSAGES — local-only demo (real cross-device DMs need the backend) ──
function _readDMs() { try { return JSON.parse(localStorage.getItem(DMS_KEY) || '{}'); } catch { return {}; } }
function _writeDMs(m) { localStorage.setItem(DMS_KEY, JSON.stringify(m)); }
function _dmThreadKey(a, b) { return [a, b].sort().join(' ↔ '); }
function sendDM(toHandle) {
  if (!requireAuth(() => sendDM(toHandle), 'Sign in to send a message')) return;
  const ta = document.getElementById('dmComposeText');
  const body = (ta?.value || '').trim();
  if (!body) { alert('Type a message first.'); return; }
  const me = getCurrentUser();
  const fromHandle = me.anonymous ? me.handle : (me.displayName || me.handle);
  const key = _dmThreadKey(fromHandle, toHandle);
  const all = _readDMs();
  all[key] = all[key] || [];
  all[key].push({ id: 'm' + Date.now(), from: fromHandle, to: toHandle, body, ts: new Date().toISOString() });
  _writeDMs(all);
  ta.value = '';
  openDMThread(toHandle);
}
function openDMs() {
  closeUserMenu();
  if (!requireAuth(() => openDMs(), 'Sign in to use messages')) return;
  const me = getCurrentUser();
  const myHandle = me.anonymous ? me.handle : (me.displayName || me.handle);
  const all = _readDMs();
  const myThreads = Object.entries(all)
    .filter(([key]) => key.includes(myHandle))
    .map(([key, msgs]) => {
      const other = key.split(' ↔ ').find(h => h !== myHandle);
      const last = msgs[msgs.length - 1];
      return { other, last, count: msgs.length };
    })
    .sort((a, b) => new Date(b.last.ts) - new Date(a.last.ts));

  const body = document.getElementById('authorProfileBody');
  body.innerHTML = `
    <div class="sd-eyebrow">YOUR INBOX</div>
    <div class="sd-head" style="border-bottom:1px solid var(--border);padding-bottom:18px;margin-bottom:18px;">
      <div class="sd-icon" style="background:var(--accent-soft);color:var(--accent);font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem;">${escapeHtml(myHandle.charAt(0).toUpperCase())}</div>
      <div class="sd-who">
        <div class="sd-name" style="cursor:default;">Messages</div>
        <div class="sd-agency">${myThreads.length} thread${myThreads.length === 1 ? '' : 's'}</div>
      </div>
    </div>
    ${myThreads.length === 0 ? `
      <div style="text-align:center;padding:30px 0;color:var(--gray);font-size:0.92rem;">
        No messages yet.<br><br>
        <span style="font-size:0.82rem;">Open any contributor's profile and tap <strong>Message</strong> to start a thread.</span>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${myThreads.map(t => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;cursor:pointer;" onclick="openDMThread('${escapeHtml(t.other).replace(/'/g, "\\'")}');">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="color:var(--ink);">${escapeHtml(t.other)}</strong>
              <span style="font-size:0.74rem;color:var(--gray);">${formatDate(t.last.ts)}</span>
            </div>
            <div style="font-size:0.88rem;color:var(--light);line-height:1.5;">${escapeHtml(t.last.body.slice(0, 100))}${t.last.body.length > 100 ? '…' : ''}</div>
            <div style="font-size:0.72rem;color:var(--gray);margin-top:4px;">${t.count} message${t.count === 1 ? '' : 's'}</div>
          </div>
        `).join('')}
      </div>
    `}
    <div style="font-size:0.76rem;color:var(--gray);margin-top:18px;padding-top:14px;border-top:1px solid var(--border);line-height:1.5;">
      💡 Messages are stored on this device. Cross-device sync arrives with the real backend.
    </div>
  `;
  document.getElementById('authorProfileModal').classList.add('show');
}
function openDMThread(otherHandle) {
  if (!requireAuth(() => openDMThread(otherHandle), 'Sign in to message')) return;
  const me = getCurrentUser();
  const myHandle = me.anonymous ? me.handle : (me.displayName || me.handle);
  const key = _dmThreadKey(myHandle, otherHandle);
  const all = _readDMs();
  const msgs = all[key] || [];
  const body = document.getElementById('authorProfileBody');
  body.innerHTML = `
    <div class="sd-eyebrow"><button onclick="openDMs()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-family:inherit;font-size:inherit;letter-spacing:inherit;font-weight:inherit;">&larr; Inbox</button></div>
    <div class="sd-head" style="border-bottom:1px solid var(--border);padding-bottom:18px;margin-bottom:18px;">
      <div class="sd-icon" style="background:var(--accent-soft);color:var(--accent);font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem;">${escapeHtml(otherHandle.charAt(0).toUpperCase())}</div>
      <div class="sd-who">
        <div class="sd-name" onclick="openAuthorProfile('${escapeHtml(otherHandle).replace(/'/g, "\\'")}');">${escapeHtml(otherHandle)}</div>
        <div class="sd-agency">${msgs.length} message${msgs.length === 1 ? '' : 's'}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;padding:0 4px;margin-bottom:14px;">
      ${msgs.length === 0 ? '<div style="color:var(--gray);text-align:center;padding:14px 0;font-size:0.88rem;">No messages yet — say hi.</div>' :
        msgs.map(m => `
          <div style="background:${m.from === myHandle ? 'var(--accent-soft)' : 'var(--bg2)'};border:1px solid var(--border);border-radius:12px;padding:10px 14px;align-self:${m.from === myHandle ? 'flex-end' : 'flex-start'};max-width:80%;">
            <div style="font-size:0.92rem;line-height:1.55;color:var(--ink);white-space:pre-wrap;">${escapeHtml(m.body)}</div>
            <div style="font-size:0.7rem;color:var(--gray);margin-top:4px;">${formatDate(m.ts)}</div>
          </div>
        `).join('')
      }
    </div>
    <div class="reply-form">
      <textarea id="dmComposeText" placeholder="Type a message…" style="min-height:60px;"></textarea>
      <div class="reply-form-foot">
        <span class="reply-as">Posting as <strong style="color:var(--accent);">${escapeHtml(myHandle)}</strong></span>
        <button class="rcm-confirm" style="padding:9px 18px;font-size:0.85rem;" onclick="sendDM('${escapeHtml(otherHandle).replace(/'/g, "\\'")}');">Send &rarr;</button>
      </div>
    </div>
  `;
  document.getElementById('authorProfileModal').classList.add('show');
}
// Escape closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sd = document.getElementById('storyDetailModal');
    if (sd && sd.classList.contains('show')) closeStoryDetail();
    const am = document.getElementById('authModal');
    if (am && am.classList.contains('show')) closeAuthModal();
    const ap = document.getElementById('authorProfileModal');
    if (ap && ap.classList.contains('show')) closeAuthorProfile();
  }
});

// Lightweight engagement signal — increments a "same here" counter on the button.
// Requires sign-in (you can read without an account, but engaging requires one).
function thanksTo(btn, evt) {
  if (evt) evt.stopPropagation();
  if (!requireAuth(() => thanksTo(btn), 'Sign in to react')) return;
  const n = parseInt(btn.dataset.count || '0', 10) + 1;
  btn.dataset.count = n;
  btn.innerHTML = `👍 Same here · ${n}`;
  btn.style.color = 'var(--green)';
  btn.style.borderColor = 'rgba(31,140,95,0.4)';
}

// ── NY AGENCY DIRECTORY ──
let agencyTypeFilter = '';
function agencyTypeClick(el) {
  document.querySelectorAll('#agencyTypeFilter .pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  agencyTypeFilter = el.dataset.typefilter || '';
  renderDepartments();
}

function inferAgencyType(d) {
  const name = (d.name || '').toLowerCase();
  if (/\b(ems|ambulance|paramedic)\b/.test(name)) return 'emt';
  if (/\b(fire|fd|hose|engine|truck co)\b/.test(name)) return 'fire';
  if (/\bdmv\b/.test(name)) return 'dmv';
  if (/\b(hospital|medical center|sinai|montefiore|good samaritan|langone)\b/.test(name)) return 'hospital';
  if (/\b(tax|hra|housing|unemployment|county clerk|dept of|division of|attorney general)\b/.test(name)) return 'gov';
  return 'police';
}

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
  if (agencyTypeFilter) filtered = filtered.filter(d => inferAgencyType(d) === agencyTypeFilter);
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
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button class="cc-send" style="flex:1;" onclick="openComplaintForm(${JSON.stringify(recipientName).replace(/"/g, '&quot;')}, ${JSON.stringify(recipientEmail).replace(/"/g, '&quot;')})">Send message &rarr;</button>
          <button class="sub-btn ${isSubscribed(d.name) ? 'subscribed' : ''}" title="${isSubscribed(d.name) ? 'Subscribed — you get updates on new stories about this agency' : 'Get updates when new stories mention this agency'}" onclick="toggleSubscribe(${JSON.stringify(d.name).replace(/"/g, '&quot;')}, this)">${isSubscribed(d.name) ? '✓ Subscribed' : '🔔 Subscribe'}</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── REACH OUT — bidirectional praise / complaint ──
let messageType = 'praise';  // default to positive

function setMessageType(el, type) {
  messageType = type;
  document.querySelectorAll('.msg-type').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  // Update labels and submit text
  const body = document.getElementById('cfBody');
  const bodyLabel = document.getElementById('cfBodyLabel');
  const submitBtn = document.getElementById('cfSubmitBtn');
  const title = document.getElementById('cfTitle');
  if (type === 'praise') {
    if (bodyLabel) bodyLabel.textContent = 'Thank-you message';
    if (body) body.placeholder = 'Tell them what they did well, and why it mattered. Specifics make it real.';
    if (submitBtn) submitBtn.textContent = 'Send thank-you →';
    if (title) title.textContent = title.textContent.replace(/^(Message|Concern|Thank-you) to/, 'Thank-you to');
  } else {
    if (bodyLabel) bodyLabel.textContent = 'Complaint / concern';
    if (body) body.placeholder = 'Be factual and specific — include time, location, what was said, and what happened.';
    if (submitBtn) submitBtn.textContent = 'Send concern →';
    if (title) title.textContent = title.textContent.replace(/^(Message|Concern|Thank-you) to/, 'Concern to');
  }
}

function openComplaintForm(name, email) {
  const title = document.getElementById('cfTitle');
  const sub   = document.getElementById('cfSub');
  // Default to praise — it's the positive first impression
  const prefix = messageType === 'praise' ? 'Thank-you to ' : 'Concern to ';
  title.textContent = prefix + name;
  sub.textContent = 'Sending to: ' + (email || 'Agency front desk');
  document.getElementById('complaintFormWrap').style.display = 'block';
  document.getElementById('complaintFormWrap').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('cfDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('complaintFormWrap').dataset.recipientName = name;
  document.getElementById('complaintFormWrap').dataset.recipientEmail = email || '';
  // Default the message-type pills to praise visually
  const praisePill = document.querySelector('.msg-type[data-type="praise"]');
  if (praisePill) setMessageType(praisePill, 'praise');
}

async function sendComplaint() {
  if (!requireAuth(() => sendComplaint(), 'Sign in to send a message')) return;
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
renderAuthState();
loadStats();
loadOfficers();
refreshLiveRating();   // initial state: 4/5 charitable default

// Admin URL gate — open admin queue when ?admin=1
if (location.search.includes('admin=1')) {
  setTimeout(() => nav('admin'), 200);
}

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

// ─── Share to socials ───
function _shareText() {
  return 'I just shared a story on CivicVoice — every interaction with a public servant, on the record. Add yours →';
}
function _shareUrl() {
  return window.location.origin + window.location.pathname;
}
async function shareTo(target) {
  const text = _shareText();
  const url  = _shareUrl();
  const fullText = encodeURIComponent(text);
  const fullUrl  = encodeURIComponent(url);
  if (target === 'twitter') {
    window.open(`https://twitter.com/intent/tweet?text=${fullText}&url=${fullUrl}`, '_blank', 'noopener,width=600,height=500');
  } else if (target === 'linkedin') {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`, '_blank', 'noopener,width=600,height=500');
  } else if (target === 'whatsapp') {
    window.open(`https://wa.me/?text=${fullText}%20${fullUrl}`, '_blank', 'noopener');
  } else if (target === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${fullUrl}`, '_blank', 'noopener,width=600,height=500');
  } else if (target === 'copy') {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      _flashShare('copy', '✓ Copied to clipboard');
    } catch {
      prompt('Copy this:', `${text} ${url}`);
    }
  } else if (target === 'native') {
    if (navigator.share) {
      try { await navigator.share({ title: 'CivicVoice', text, url }); } catch {}
    } else {
      _flashShare('more', 'No native share available — try Copy link');
    }
  }
}
function _flashShare(targetClass, msg) {
  const btn = document.querySelector('.share-pill.share-' + targetClass);
  if (!btn) return;
  const original = btn.innerHTML;
  btn.innerHTML = msg;
  setTimeout(() => { btn.innerHTML = original; }, 2200);
}
// Legacy alias — old code might still reference shareReview()
function shareReview() { shareTo('native'); }

// ─── Universal autocomplete on Step 3 fields ───
// Role-aware: shows only people whose inferred role matches the picked category.
// Triggered from both the name and ID inputs; picking a match fills name+ID+agency+location.

function _allOfficers() {
  return (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
}
function _filterByRole(list) {
  if (!currentRole || currentRole === 'other') return list;
  return list.filter(o => inferRole(o) === currentRole);
}

function onPersonInput(sourceFieldId) {
  const valueRaw = document.getElementById(sourceFieldId).value.trim().toLowerCase();
  // Pick the right suggestion container based on which field triggered
  const sugId = (sourceFieldId === 'officerName') ? 'personSuggest' : 'badgeSuggest';
  const sug = document.getElementById(sugId);
  const otherSug = document.getElementById(sugId === 'personSuggest' ? 'badgeSuggest' : 'personSuggest');
  if (otherSug) otherSug.classList.remove('show');
  if (!sug) return;

  const all = _filterByRole(_allOfficers());
  // If field is empty on focus, show top recent of this role
  let matches;
  if (!valueRaw) {
    matches = all.slice(0, 5);
  } else {
    matches = all.filter(o =>
      (o.name && o.name.toLowerCase().includes(valueRaw)) ||
      (o.badge && o.badge.toLowerCase().includes(valueRaw)) ||
      (o.department && o.department.toLowerCase().includes(valueRaw))
    ).slice(0, 6);
  }
  if (!matches.length) { sug.classList.remove('show'); return; }

  sug.innerHTML = matches.map(o => `
    <div class="ac-item" onmousedown="pickPersonMatch(${o.id})">
      <div class="ac-name">${escapeHtml(o.name || 'Unknown')}</div>
      <div class="ac-meta">${escapeHtml(o.badge || '—')} · ${escapeHtml(o.department || 'Unknown')} · ${(o.avg_stars || 0).toFixed(1)}★ · ${o.review_count} stor${o.review_count === 1 ? 'y' : 'ies'}</div>
    </div>
  `).join('');
  sug.classList.add('show');
}

function pickPersonMatch(id) {
  const o = _allOfficers().find(x => x.id === id);
  if (!o) return;
  document.getElementById('officerName').value = o.name || '';
  document.getElementById('badgeIn').value = o.badge || '';
  document.getElementById('deptIn').value = o.department || '';
  document.getElementById('personSuggest').classList.remove('show');
  document.getElementById('badgeSuggest').classList.remove('show');
}

// Agency / Department autocomplete — unique department names, filtered by role
function onAgencyInput() {
  const q = document.getElementById('deptIn').value.trim().toLowerCase();
  const sug = document.getElementById('agencySuggest');
  if (!sug) return;
  const filtered = _filterByRole(_allOfficers());
  const names = new Set(filtered.map(o => o.department).filter(Boolean));
  let pool = Array.from(names).sort();
  if (q) pool = pool.filter(d => d.toLowerCase().includes(q));
  pool = pool.slice(0, 6);
  if (!pool.length) { sug.classList.remove('show'); return; }
  sug.innerHTML = pool.map(d => `
    <div class="ac-item" onmousedown="document.getElementById('deptIn').value=${JSON.stringify(d)};document.getElementById('agencySuggest').classList.remove('show');">
      <div class="ac-name">${escapeHtml(d)}</div>
    </div>
  `).join('');
  sug.classList.add('show');
}

// Location autocomplete — pulls from all known story locations matching the role
function onLocationInput() {
  const q = document.getElementById('locationIn').value.trim().toLowerCase();
  const sug = document.getElementById('locationSuggest');
  if (!sug) return;
  if (!q || q.length < 2) { sug.classList.remove('show'); return; }
  const filtered = _filterByRole(_allOfficers());
  const locs = new Set();
  for (const o of filtered) {
    for (const r of (o.reviews || [])) {
      if (r.location) locs.add(r.location);
    }
  }
  const matches = Array.from(locs).filter(l => l.toLowerCase().includes(q)).slice(0, 6);
  if (!matches.length) { sug.classList.remove('show'); return; }
  sug.innerHTML = matches.map(l => `
    <div class="ac-item" onmousedown="document.getElementById('locationIn').value=${JSON.stringify(l)};document.getElementById('locationSuggest').classList.remove('show');">
      <div class="ac-name">${escapeHtml(l)}</div>
    </div>
  `).join('');
  sug.classList.add('show');
}

// Legacy aliases — keep old calls working
function onBadgeInput() { onPersonInput('officerName'); }
function pickBadgeMatch(id) { pickPersonMatch(id); }

// ─── GEOLOCATION — fill the Where field from device GPS ───
async function useMyLocation() {
  const btn = document.getElementById('geoBtn');
  const status = document.getElementById('geoStatus');
  const input = document.getElementById('locationIn');
  if (!navigator.geolocation) {
    status.textContent = 'Your browser does not support location.';
    status.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = '📍 Locating…';
  status.style.color = 'var(--gray)';
  status.textContent = '';
  status.style.display = 'none';

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
    const { latitude: lat, longitude: lon } = pos.coords;
    // Reverse-geocode via OpenStreetMap Nominatim (free, no key)
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (!res.ok) throw new Error('Lookup failed');
    const data = await res.json();
    // Build a human-readable location: "Main St & Route 59, Spring Valley"
    const a = data.address || {};
    const road = a.road || a.pedestrian || a.cycleway || a.path || '';
    const town = a.city || a.town || a.village || a.hamlet || a.suburb || a.county || '';
    const state = a.state_code || a.state || '';
    const display = [road, town, state].filter(Boolean).join(', ') || data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    input.value = display;
    status.style.color = 'var(--green)';
    status.textContent = '✓ Filled from your location';
    status.style.display = 'block';
  } catch (err) {
    status.style.color = 'var(--red)';
    status.textContent = err.code === 1 ? 'Permission denied. Allow location in your browser to use this.' :
                         err.code === 3 ? 'Took too long — try again or type it in.' :
                         'Couldn\'t get location: ' + (err.message || 'unknown');
    status.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#128205; Use my location';
  }
}

// ─── ORG PORTAL — verified-agency sign-in for posting official responses ───
// Email-domain mapping → verified agency. This list is the "trust root" for the demo.
// Real deployment would use a backend table + manual admin verification.
const ORG_DOMAINS = {
  'villagespringvalley.org': 'Spring Valley PD',
  'villageofspringvalleyny.gov': 'Spring Valley PD',
  'ramapopolice.com': 'Ramapo PD',
  'clarkstown.org': 'Clarkstown PD',
  'orangetown.com': 'Orangetown PD',
  'nypd.org': 'NYPD',
  'nyc.gov': 'NYC Agency',
  'fdny.nyc.gov': 'FDNY',
  'troopers.ny.gov': 'NYS Police',
  'dmv.ny.gov': 'NY DMV',
  'rocklandgov.com': 'Rockland County Agency',
  'westchestercountypd.com': 'Westchester County PD',
};
function _agencyFromEmail(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].trim().toLowerCase();
  return ORG_DOMAINS[domain] || null;
}
function getCurrentOrg() {
  try { return JSON.parse(localStorage.getItem(ORG_KEY) || 'null'); }
  catch { return null; }
}
function _persistOrg(o) {
  if (o) localStorage.setItem(ORG_KEY, JSON.stringify(o));
  else localStorage.removeItem(ORG_KEY);
  renderOrgState();
}
function orgSignIn() {
  const email = (document.getElementById('orgEmail')?.value || '').trim();
  const name = (document.getElementById('orgContactName')?.value || '').trim();
  const status = document.getElementById('orgStatus');
  if (!email) { status.textContent = 'Please enter your work email.'; status.style.color = 'var(--red)'; return; }
  const agency = _agencyFromEmail(email);
  const org = {
    email,
    contact_name: name || null,
    agency_name: agency || 'Pending verification',
    verified: !!agency,
    signedInAt: new Date().toISOString(),
  };
  _persistOrg(org);
  status.style.color = agency ? 'var(--green)' : 'var(--accent)';
  status.innerHTML = agency
    ? `✓ Verified as <strong>${escapeHtml(agency)}</strong>. You can now post official responses to stories about your agency.`
    : `⏳ Your email is not in our verified-domain list yet. Submit a request and our team will manually verify within 1–2 business days.`;
}
function orgSignOut() {
  _persistOrg(null);
  const s = document.getElementById('orgStatus'); if (s) s.innerHTML = '';
  const e = document.getElementById('orgEmail'); if (e) e.value = '';
  const n = document.getElementById('orgContactName'); if (n) n.value = '';
}
function renderOrgState() {
  const o = getCurrentOrg();
  const summary = document.getElementById('orgCurrent');
  if (!summary) return;
  if (o && o.verified) {
    summary.style.display = 'block';
    summary.innerHTML = `
      <div style="background:rgba(31,140,95,0.06);border:1px solid rgba(31,140,95,0.3);border-radius:12px;padding:18px 22px;">
        <div style="font-weight:700;color:var(--green);margin-bottom:4px;">&#9989; Signed in as ${escapeHtml(o.agency_name)}</div>
        <div style="color:var(--light);font-size:0.88rem;margin-bottom:12px;">${escapeHtml(o.email)}${o.contact_name ? ' · ' + escapeHtml(o.contact_name) : ''}</div>
        <div style="font-size:0.85rem;color:var(--gray);line-height:1.55;">Your replies on stories about <strong style="color:var(--ink);">${escapeHtml(o.agency_name)}</strong> will appear with a <strong style="color:var(--green);">✓ Verified</strong> badge.</div>
        <button class="btn-ghost" style="margin-top:14px;" onclick="orgSignOut()">Sign out of agency account</button>
      </div>
    `;
  } else if (o) {
    summary.style.display = 'block';
    summary.innerHTML = `
      <div style="background:rgba(184,148,30,0.06);border:1px solid rgba(184,148,30,0.3);border-radius:12px;padding:18px 22px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:4px;">⏳ Pending verification</div>
        <div style="color:var(--light);font-size:0.88rem;">${escapeHtml(o.email)} is awaiting manual review. Until then, your replies appear as a regular user.</div>
        <button class="btn-ghost" style="margin-top:14px;" onclick="orgSignOut()">Cancel</button>
      </div>
    `;
  } else {
    summary.style.display = 'none';
  }
}

// ─── MODERATION QUEUE (admin-only, accessed via ?admin=1) ───
function renderModQueue() {
  const wrap = document.getElementById('modQueueList');
  if (!wrap) return;
  // For the demo, we treat the 3 most recently posted stories as "pending" — in production
  // this'd be a separate queue table. The point is to demonstrate the workflow.
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const items = [];
  for (const o of officers) {
    for (const r of (o.reviews || [])) {
      items.push({ officer: o, review: r, role: inferRole(o) });
    }
  }
  items.sort((a, b) => new Date(b.review.created_at || 0) - new Date(a.review.created_at || 0));
  const pending = items.slice(0, 5);
  wrap.innerHTML = pending.map(it => {
    const o = it.officer, r = it.review;
    return `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:0.95rem;">${ROLE_ICON[it.role] || '👤'} ${escapeHtml(o.name || 'Unknown')}</div>
            <div style="font-size:0.82rem;color:var(--gray);">${escapeHtml(o.department || '')}${r.location ? ' · ' + escapeHtml(r.location) : ''}</div>
          </div>
          <div style="font-size:0.74rem;color:var(--accent);background:var(--accent-soft);border:1px solid rgba(184,148,30,0.3);border-radius:999px;padding:3px 10px;font-weight:700;">PENDING</div>
        </div>
        <div style="font-size:0.92rem;line-height:1.65;color:var(--light);margin-bottom:14px;">${escapeHtml((r.story || '(No description)').slice(0, 320))}${(r.story || '').length > 320 ? '…' : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="sp-action" style="background:rgba(31,140,95,0.1);border-color:rgba(31,140,95,0.4);color:var(--green);" onclick="_modAction(this, 'approved')">✓ Approve</button>
          <button class="sp-action" style="background:rgba(201,52,52,0.08);border-color:rgba(201,52,52,0.4);color:var(--red);" onclick="_modAction(this, 'rejected')">✕ Reject</button>
          <button class="sp-action" onclick="closeStoryDetail(); openStoryDetail(${o.id}, ${r.id})">👁 View full</button>
          <span style="margin-left:auto;font-size:0.78rem;color:var(--gray);align-self:center;">submitted ${formatDate(r.created_at)}</span>
        </div>
      </div>
    `;
  }).join('') || '<div style="color:var(--gray);text-align:center;padding:40px 0;">Queue empty.</div>';
}
function _modAction(btn, action) {
  const card = btn.closest('div[style*="background"]')?.parentElement?.parentElement;
  const wrap = btn.closest('div[style*="background:var(--card)"]');
  if (!wrap) return;
  wrap.style.opacity = '0.5';
  wrap.style.pointerEvents = 'none';
  btn.closest('div[style*="display:flex"]').innerHTML =
    `<span style="font-size:0.86rem;color:${action === 'approved' ? 'var(--green)' : 'var(--red)'};">${action === 'approved' ? '✓ Approved & published.' : '✕ Rejected.'} (demo &mdash; nothing actually saved)</span>`;
}

// ─── EMAIL DIGEST TOGGLE ───
function getEmailDigestPref() {
  try { return JSON.parse(localStorage.getItem(EMAIL_DIGEST_KEY) || 'false'); }
  catch { return false; }
}
function setEmailDigestPref(on) {
  localStorage.setItem(EMAIL_DIGEST_KEY, JSON.stringify(!!on));
}
function toggleEmailDigest() {
  const cur = getEmailDigestPref();
  setEmailDigestPref(!cur);
  closeUserMenu();
  alert((!cur)
    ? '✓ Weekly digest enabled. (Real emails will start sending once we deploy the backend mail service.)'
    : 'Weekly digest disabled.');
  renderAuthState();
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
