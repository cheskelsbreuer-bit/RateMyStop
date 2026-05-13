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
const PENDING_KEY = 'civicvoice_pending_v1';   // user-submitted reviews awaiting moderation
const APPROVED_KEY = 'civicvoice_approved_v1'; // user-submitted reviews that have been approved
const RESOLUTIONS_KEY = 'civicvoice_resolutions_v1';   // resolution status overrides per story
const NOTIFS_KEY = 'civicvoice_notifs_v1';             // notifications for current user
const NOTIF_PREFS_KEY = 'civicvoice_notif_prefs_v1';   // per-event notification preferences
const PULSE_PREFS_KEY = 'civicvoice_pulse_prefs_v1';   // learned preferences (role/sentiment/agency)
const NOTIFY_LIST_KEY = 'civicvoice_notify_list_v1';   // email capture for "Coming Soon" features
const REACTIONS_KEY = 'civicvoice_reactions_v1';       // per-story reaction counts visible to all
const MY_REACTIONS_KEY = 'civicvoice_my_reactions_v1'; // which reactions THIS user has placed (prevents double-count)
const LAST_NOTIF_KEY = 'civicvoice_last_notif_v1';     // last time we fired a daily notif (ISO)
const SOUND_ENABLED_KEY = 'civicvoice_sound_v1';       // 'on' | 'off' for reaction sound
let _pendingAuthAction = null;

// ── DAILY LOCAL NOTIFICATION ──
// Fires a single browser notification when the user opens the app after >24h, IF they granted push.
// Local-only stand-in for a real backend push service (FCM/APNs/web-push). Real version coming with backend.
function _maybeFireDailyNotif() {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const last = localStorage.getItem(LAST_NOTIF_KEY);
    if (last) {
      const diff = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
      if (diff < 22) return;  // <22h since last — don't spam
    }
    // Count new stories in the last day to make the message specific
    const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    let recent = 0;
    officers.forEach(o => (o.reviews || []).forEach(r => {
      if (new Date(r.created_at || 0).getTime() > dayAgo) recent++;
    }));
    const body = recent > 0
      ? `${recent} new ${recent === 1 ? 'story' : 'stories'} since yesterday. Stay current with what's on the record.`
      : `Quiet day on the record. Check the Polls — your take counts.`;
    new Notification('CivicVoice', { body, icon: './manifest-icon-192.png', tag: 'civicvoice-daily' });
    localStorage.setItem(LAST_NOTIF_KEY, new Date().toISOString());
  } catch (err) {
    console.warn('daily notif fail:', err);
  }
}

// ── REACTION SOUND ──
// Soft civic bell on every reaction tap. Off by default, opt-in via user menu.
let _audioCtx = null;
function _initSoundToggle() {
  const lbl = document.getElementById('umSoundLabel');
  if (lbl) lbl.textContent = _isSoundOn() ? '🔊 Reaction sounds: on' : '🔇 Reaction sounds: off';
}
function _isSoundOn() { return localStorage.getItem(SOUND_ENABLED_KEY) === 'on'; }
function toggleReactionSound() {
  const next = _isSoundOn() ? 'off' : 'on';
  localStorage.setItem(SOUND_ENABLED_KEY, next);
  const lbl = document.getElementById('umSoundLabel');
  if (lbl) lbl.textContent = next === 'on' ? 'Reaction sounds: on' : 'Reaction sounds: off';
  // Test-play on enable
  if (next === 'on') playReactionSound();
}
function playReactionSound() {
  if (!_isSoundOn()) return;
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const now = ctx.currentTime;
    // Two-note civic bell — clean, brief, non-dopamine
    const notes = [
      { freq: 880,  start: 0,    dur: 0.10 },  // A5
      { freq: 1318, start: 0.06, dur: 0.16 },  // E6
    ];
    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0, now + n.start);
      gain.gain.linearRampToValueAtTime(0.08, now + n.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    });
  } catch {}
}

// ── REACTIONS STORE ── per-story counts visible to everyone (localStorage stand-in for backend)
function _readReactions() { try { return JSON.parse(localStorage.getItem(REACTIONS_KEY) || '{}'); } catch { return {}; } }
function _readMyReactions() { try { return JSON.parse(localStorage.getItem(MY_REACTIONS_KEY) || '{}'); } catch { return {}; } }
function getReactionCounts(officerId, reviewId) {
  const all = _readReactions();
  return all[`${officerId}:${reviewId}`] || { up:0, down:0, thanks:0, strong:0, curious:0 };
}
function _bumpReactionCount(officerId, reviewId, kind) {
  const all = _readReactions();
  const key = `${officerId}:${reviewId}`;
  all[key] = all[key] || { up:0, down:0, thanks:0, strong:0, curious:0 };
  all[key][kind] = (all[key][kind] || 0) + 1;
  localStorage.setItem(REACTIONS_KEY, JSON.stringify(all));
  // Track that this user reacted this way
  const mine = _readMyReactions();
  mine[key] = mine[key] || {};
  mine[key][kind] = true;
  localStorage.setItem(MY_REACTIONS_KEY, JSON.stringify(mine));
  return all[key];
}
function reactionTotalsHtml(officerId, reviewId) {
  const c = getReactionCounts(officerId, reviewId);
  const total = c.up + c.down + c.thanks + c.strong + c.curious;
  if (!total) return '';
  const parts = [];
  if (c.up)      parts.push(`<span title="People who had the same experience">🙋 ${c.up}</span>`);
  if (c.down)    parts.push(`<span title="People with a different experience">👎 ${c.down}</span>`);
  if (c.thanks)  parts.push(`<span title="Thank-yous">🙏 ${c.thanks}</span>`);
  if (c.strong)  parts.push(`<span title="Strong / powerful">💪 ${c.strong}</span>`);
  if (c.curious) parts.push(`<span title="Curious">🤔 ${c.curious}</span>`);
  return `<div class="reaction-summary">${parts.join('<span class="rs-sep">·</span>')}</div>`;
}
// Seed baseline reactions on existing stories so the app doesn't look dead on first open
function _seedReactionsIfNeeded() {
  const all = _readReactions();
  if (Object.keys(all).length > 0) return;  // already seeded
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  officers.forEach(o => (o.reviews || []).forEach(r => {
    // Plausible spread: more reactions on 5-star or 1-star stories, fewer on 3-star
    const stars = r.stars || 3;
    const heat = stars >= 5 || stars <= 2 ? (3 + Math.floor(Math.random() * 9)) : (1 + Math.floor(Math.random() * 4));
    const key = `${o.id}:${r.id}`;
    if (r.verdict === 'fair') {
      all[key] = {
        up:      heat + Math.floor(Math.random() * 4),
        down:    Math.floor(Math.random() * 2),
        thanks:  Math.floor(heat * 0.6),
        strong:  Math.floor(heat * 0.5),
        curious: Math.floor(Math.random() * 3),
      };
    } else {
      all[key] = {
        up:      heat + Math.floor(Math.random() * 5),
        down:    Math.floor(Math.random() * 3),
        thanks:  Math.floor(Math.random() * 2),
        strong:  Math.floor(heat * 0.4),
        curious: Math.floor(heat * 0.6),
      };
    }
  }));
  localStorage.setItem(REACTIONS_KEY, JSON.stringify(all));
}

// ── NOTIFY-ME MODAL ──
// Used by: "Where this is going" home rail · agency review-request CTA · claim-this-profile placeholders.
// Real backend wiring later: POST to /api/notify with { topic, email } — for now we localStorage and
// surface in admin so you can see who's interested in what.
let _notifyTopic = '';
function openNotifyMe(title, topic) {
  _notifyTopic = topic || title;
  const t = document.getElementById('notifyTitle');
  const sub = document.getElementById('notifySub');
  const form = document.getElementById('notifyForm');
  const ok = document.getElementById('notifySuccess');
  if (t) t.textContent = title;
  if (sub) sub.textContent = `Drop your email. We'll tell you the moment "${title}" goes live — no spam, no list-selling.`;
  if (form) form.style.display = 'block';
  if (ok) ok.style.display = 'none';
  const overlay = document.getElementById('notifyOverlay');
  if (overlay) overlay.classList.add('show');
  setTimeout(() => { const e = document.getElementById('notifyEmail'); if (e) e.focus(); }, 80);
}
function closeNotifyMe() {
  const overlay = document.getElementById('notifyOverlay');
  if (overlay) overlay.classList.remove('show');
}
// ESC closes the Notify modal — native-app expectation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('notifyOverlay');
    if (overlay && overlay.classList.contains('show')) closeNotifyMe();
  }
});
function submitNotifyMe() {
  const emailEl = document.getElementById('notifyEmail');
  const email = (emailEl && emailEl.value || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (emailEl) { emailEl.style.borderColor = 'var(--red)'; emailEl.focus(); }
    return;
  }
  let list = [];
  try { list = JSON.parse(localStorage.getItem(NOTIFY_LIST_KEY) || '[]'); } catch {}
  list.push({ email, topic: _notifyTopic, ts: new Date().toISOString() });
  localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(list));
  document.getElementById('notifyForm').style.display = 'none';
  document.getElementById('notifySuccess').style.display = 'block';
  if (emailEl) emailEl.value = '';
}

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
// Close menus when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  const pill = document.getElementById('userPill');
  if (menu && pill && !menu.contains(e.target) && !pill.contains(e.target)) closeUserMenu();
  const moreMenu = document.getElementById('navMoreMenu');
  const moreBtn  = document.getElementById('navMoreBtn');
  if (moreMenu && moreBtn && !moreMenu.contains(e.target) && !moreBtn.contains(e.target)) closeMoreMenu();
});

function toggleMoreMenu(evt) {
  if (evt) evt.stopPropagation();
  document.getElementById('navMoreMenu')?.classList.toggle('show');
}
function closeMoreMenu() {
  document.getElementById('navMoreMenu')?.classList.remove('show');
}

// Mobile drawer — slides in from the right on phones
function openMobileDrawer() {
  document.getElementById('mobileDrawer')?.classList.add('show');
  document.getElementById('mobileDrawerBackdrop')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeMobileDrawer() {
  document.getElementById('mobileDrawer')?.classList.remove('show');
  document.getElementById('mobileDrawerBackdrop')?.classList.remove('show');
  document.body.style.overflow = '';
}
function renderAuthState() {
  const u = getCurrentUser();
  const pill = document.getElementById('userPill');
  const btn = document.getElementById('signInBtn');
  const bell = document.getElementById('bellBtn');
  if (!pill || !btn) return;
  if (bell) bell.style.display = u ? 'inline-flex' : 'none';
  if (u) renderBellState();
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
// Primary nav: Home · Pulse · Stories · Share · Reach Out · More ▾
// "More" dropdown contains: Community · Rankings · For Agencies · Sponsors
const MORE_SECTIONS = ['contributors', 'rankings', 'orgs', 'deck'];

function nav(id) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  // Highlight by matching data-section, not by index
  document.querySelectorAll('.topnav button[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === id);
  });
  // If destination is inside More, highlight the More toggle instead
  const moreBtn = document.getElementById('navMoreBtn');
  if (moreBtn) moreBtn.classList.toggle('active', MORE_SECTIONS.includes(id));
  const section = document.getElementById(id);
  if (section) section.classList.add('active');
  // Body class lets CSS show the persistent "back to home" escape pill on Pulse
  document.body.classList.toggle('on-pulse', id === 'pulse');
  // Document-level scroll-snap turns on only when on Pulse — filters scroll away first, then one card at a time
  document.documentElement.classList.toggle('snap-pulse', id === 'pulse');
  closeMoreMenu();
  window.scrollTo(0, 0);
  if (id === 'officers')  loadOfficers();
  if (id === 'home')      { loadStats(); _refreshConsistencyBanner(); }
  if (id === 'complaint') renderDepartments();
  if (id === 'rankings')     renderRankings();
  if (id === 'orgs')         renderOrgState();
  if (id === 'admin')        { setAdminTab(_adminTab || 'stories'); _refreshAdminBadges(); }
  if (id === 'contributors') renderContributors();
  if (id === 'pulse')        renderPulse();
  if (id === 'polls')        renderPolls();
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
  school:   { who: 'School board member / Superintendent', ref: 'Meeting / vote reference',  name_ph: 'e.g. Trustee Goldberg',  id_label: 'Role / District',  id_ph: 'e.g. Trustee, East Ramapo CSD',  agency_label: 'District / Board',  agency_ph: 'e.g. East Ramapo Central School District',  where_label: 'Where', where_ph: 'e.g. Board meeting, Spring Valley HS',  story_label: 'What happened?',  story_ph: 'A board vote? A meeting? A response to your email? Tell the story.',  photo_help: 'Meeting minutes, email screenshot, anything from the interaction. JPG / PNG / PDF', show_ticket: false, show_bodycam: false, show_ref: true },
  elected:  { who: 'Elected official',  ref: 'Meeting / vote reference',  name_ph: 'e.g. Mayor Simon',  id_label: 'Title / Office',  id_ph: 'e.g. Village Mayor, County Legislator',  agency_label: 'Office / Body',  agency_ph: 'e.g. Village of Spring Valley',  where_label: 'Where',  where_ph: 'e.g. Village Hall, town hall meeting',  story_label: 'What happened?',  story_ph: 'A vote? A constituent meeting? Showed up — or didn\'t? Tell the story.',  photo_help: 'Meeting photo, email screenshot, anything from the interaction. JPG / PNG / PDF', show_ticket: false, show_bodycam: false, show_ref: true },
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
    // Also persist to the local pending queue so admins can approve and it shows up live
    _addToPendingQueue(payload);
    const result = await api.submitReview(payload);
    const isDemo = result && result.demo;
    const sTitle = document.getElementById('successTitle');
    const sSub   = document.getElementById('successSub');
    if (sTitle) sTitle.textContent = 'Your story is in moderation.';
    if (sSub)   sSub.innerHTML = 'Pending review by our moderators. Once approved, it joins the public record. <a href="?admin=1" style="color:var(--accent);font-weight:700;">View admin queue &rarr;</a>';
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
    }, 60000);
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
    const seed = await api.listOfficers();
    const approved = getApprovedAsOfficers();
    officerCache = [...approved, ...seed];  // user submissions surface at the top
    // Pre-populate the stream index so the story detail modal works from any entry point.
    // (Seed officers don't yet have reviews here; that's filled in on demand by openOfficer.)
    for (const o of approved) {
      for (const r of (o.reviews || [])) {
        _streamIndex[`${o.id}:${r.id}`] = { officer: o, review: r, role: inferRole(o) };
      }
    }
    // Also index any seeded officers that did include reviews inline (e.g. STATIC_DATA + extras)
    const fullSeed = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
    for (const o of fullSeed) {
      for (const r of (o.reviews || [])) {
        _streamIndex[`${o.id}:${r.id}`] = { officer: o, review: r, role: inferRole(o) };
      }
    }
    applyFilters();
  } catch (err) {
    if (stream) stream.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px 0;">Couldn't load stories: ${err.message}</div>`;
  }
}

// Stream / grid toggle — DEFAULT to grid (By person) per founder preference
let storiesView = 'grid';
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
  const ICON = { police:'🚔', emt:'🚑', fire:'🚒', dmv:'🪪', hospital:'🏥', gov:'👨‍💼', school:'🎓', elected:'🏛️', federal:'🇺🇸' };
  const ROLE_LABEL = { police:'POLICE', emt:'EMT / EMS', fire:'FIRE', dmv:'DMV', hospital:'HOSPITAL', gov:'GOVERNMENT', school:'SCHOOL BOARD', elected:'LOCAL ELECTED', federal:'STATE / FEDERAL' };
  grid.innerHTML = list.map(o => {
    const role = inferRole(o);
    const stars = Math.round(o.avg_stars || 0);
    const isClaim = !!o.claim_only;
    return `
    <div class="officer-card role-${role}${isClaim ? ' claim-only' : ''}" onclick="openOfficer(${o.id})">
      <div class="oc-eyebrow">${ICON[role] || '👤'} ${ROLE_LABEL[role] || ''}${isClaim ? ' · UNCLAIMED' : ''}</div>
      <div class="oc-name">${escapeHtml(o.name || 'Unknown')}</div>
      <div class="oc-dept">${escapeHtml(o.department || 'Unknown agency')}</div>
      ${isClaim ? `
        <div class="oc-claim-note">This profile is unclaimed. Reviews open once the official (or their office) claims it. <strong>If this is you — claim it.</strong></div>
        <button class="oc-view" onclick="event.stopPropagation(); openNotifyMe('Claim this profile: ${escapeHtml(o.name).replace(/'/g, "\\'")}', 'claim-${o.id}');">Claim this profile &rarr;</button>
      ` : `
        <div class="oc-stat-row">
          <span class="oc-stars">${starsStr(stars)}</span>
          <span class="oc-avg">${(o.avg_stars || 0).toFixed(1)}</span>
        </div>
        <div class="oc-meta">
          ${o.fair_count > 0 ? `<span class="oc-chip fair">★ ${o.fair_count}</span>` : ''}
          ${o.unfair_count > 0 ? `<span class="oc-chip unfair">⚠ ${o.unfair_count}</span>` : ''}
          <span class="oc-count">${o.review_count} stor${o.review_count === 1 ? 'y' : 'ies'}</span>
        </div>
        <button class="oc-view">View profile &rarr;</button>
      `}
    </div>
  `;}).join('');
}

// Make sure _streamIndex is populated even if the user hasn't visited Stories/Pulse yet
function _ensureStreamIndex() {
  if (Object.keys(_streamIndex).length > 0) return;
  const officers = officerCache.length ? officerCache : ((window.STATIC_DATA && window.STATIC_DATA.officers) || []);
  const approved = getApprovedAsOfficers();
  for (const o of [...approved, ...officers]) {
    for (const r of (o.reviews || [])) {
      _streamIndex[`${o.id}:${r.id}`] = { officer: o, review: r, role: inferRole(o) };
    }
  }
}

async function openOfficer(id) {
  const modal = document.getElementById('modalContent');
  modal.innerHTML = '<div style="color:var(--gray);padding:40px 0;text-align:center;">Loading…</div>';
  document.getElementById('officerModal').classList.add('show');
  _ensureStreamIndex();

  // Approved user-submissions live in officerCache with their reviews already inlined.
  // The API only knows seed data, so for synthetic IDs (1000000+) we must use cache directly.
  const cached = officerCache.find(x => x.id === Number(id));
  const isApproved = cached && cached.reviews && cached.reviews.length && Number(id) >= 1000000;
  try {
    let o;
    if (isApproved) {
      o = cached;
    } else if (cached && cached.reviews && cached.reviews.length) {
      // From extras or any cached officer that already has reviews
      o = cached;
    } else {
      o = await api.getOfficer(id);
    }
    // Make sure stream index has every review on this officer for future detail-modal opens
    if (o && o.reviews) {
      for (const r of o.reviews) {
        _streamIndex[`${o.id}:${r.id}`] = { officer: o, review: r, role: inferRole(o) };
      }
    }
    // Claim-only profiles (state/federal placeholders): no reviews yet, show claim CTA only
    if (o.claim_only) {
      modal.innerHTML = `
        <div class="mo-head">
          <div class="mo-av">${(o.name || 'Unknown').split(' ').pop().slice(0, 2).toUpperCase()}</div>
          <div>
            <div class="mo-name">${escapeHtml(o.name || 'Unknown')}</div>
            <div class="mo-sub">${escapeHtml(o.department || 'Unknown')}</div>
          </div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:18px;">
          <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent);font-weight:800;margin-bottom:8px;">Unclaimed profile</div>
          <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.05rem;font-weight:800;color:var(--ink);margin-bottom:10px;letter-spacing:-0.2px;">No reviews on this profile yet.</div>
          <div style="font-size:0.9rem;color:var(--light);line-height:1.6;margin-bottom:16px;">
            This profile exists on the record so the role is visible &mdash; but reviews and ratings open only once <strong>${escapeHtml(o.name || 'this official')}</strong> or their office <strong>claims it</strong>. That keeps the record fair: every state and federal official can answer for themselves.
          </div>
          <button class="ac-btn" onclick="openNotifyMe('Claim this profile: ${escapeHtml(o.name).replace(/'/g, "\\'")}', 'claim-${o.id}');">If this is you &mdash; claim this profile &rarr;</button>
        </div>
        <button class="btn-ghost" style="width:100%;margin-top:8px;" onclick="document.getElementById('officerModal').classList.remove('show');">Close</button>
      `;
      return;
    }
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
      ${o.reviews.map(r => {
        const status = getResolutionStatus(o.id, r.id, r);
        const meta = RES_META[status];
        const author = r.author_display || _legacyAuthor(o.id, r.id);
        const u = getCurrentUser();
        const myHandle = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : null;
        const isAuthor = myHandle && myHandle === author;
        const replyCount = getReplyCount(o.id, r.id);
        return `
          <div class="mo-review">
            <div class="mr-top">
              <div class="mr-stars">${starsStr(r.stars)}</div>
              <div>
                <span class="mr-verdict ${r.verdict}">${r.verdict === 'fair' ? '★ Recognition' : '⚠ Concern'}</span>
                ${r.upload_url ? '<span class="flag-verified" style="margin-left:6px;">🛡️ Verified</span>' : ''}
              </div>
            </div>
            <div class="mr-text">${escapeHtml(r.story || 'No description provided.')}</div>
            <div class="mr-date">By <strong style="color:var(--ink);cursor:pointer;text-decoration:underline;text-underline-offset:3px;" onclick="document.getElementById('officerModal').classList.remove('show'); openAuthorProfile('${escapeHtml(author).replace(/'/g, "\\'")}');">${escapeHtml(author)}</strong> · ${formatDate(r.created_at)}</div>
            <div class="resolution-banner" style="background:${meta.bg};border:1px solid ${meta.border};color:${meta.color};margin-top:10px;font-size:0.82rem;padding:8px 12px;">
              <span class="rb-icon">${meta.icon}</span>
              <span class="rb-text"><strong>${meta.label}</strong></span>
              ${isAuthor && status !== 'resolved' ? `<button class="rb-btn" onclick="markStoryResolved(${o.id}, ${r.id}); document.getElementById('officerModal').classList.remove('show'); setTimeout(()=>openOfficer(${o.id}), 80);">✓ Mark resolved</button>` : ''}
            </div>
            ${reactionTotalsHtml(o.id, r.id)}
            <div class="mr-actions">
              <button class="sp-action up" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="up" onclick="reactTo(this, event)" title="I had the same experience">🙋 Me too</button>
              <button class="sp-action down" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="down" onclick="reactTo(this, event)" title="My experience was different">👎 Not me</button>
              <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="thanks" onclick="reactTo(this, event)" title="Thank you">🙏</button>
              <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="strong" onclick="reactTo(this, event)" title="Strong / powerful">💪</button>
              <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="curious" onclick="reactTo(this, event)" title="Curious — want to know more">🤔</button>
              <button class="sp-action" onclick="document.getElementById('officerModal').classList.remove('show'); setTimeout(()=>openStoryDetail(${o.id}, ${r.id}), 80);">💬 ${replyCount}</button>
              <button class="sp-action" onclick="shareStoryCard(${o.id}, ${r.id})">🔗 Share card</button>
            </div>
          </div>
        `;
      }).join('')}
      ${(() => {
        // Only the original author of a story on this profile sees the "Send to agency" button.
        // Non-authors see NOTHING about messaging — they can share, react, or post their own story.
        const u = getCurrentUser();
        const myHandle = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : null;
        const myReviews = (o.reviews || []).filter(r => (r.author_display || _legacyAuthor(o.id, r.id)) === myHandle);
        if (myHandle && myReviews.length) {
          return `<button class="submit-main" style="margin-top:18px;" onclick="document.getElementById('officerModal').classList.remove('show'); nav('complaint');">&#9993;&#65039; Send a message to ${escapeHtml(o.department || 'this agency')} about your story &rarr;</button>`;
        }
        return '';  // silent — non-authors get the React/Share/Post-your-own paths via the action row
      })()}
    `;
  } catch (err) {
    modal.innerHTML = `<div style="color:var(--red);padding:30px 0;text-align:center;">
      <div style="font-size:1.6rem;margin-bottom:10px;">😕</div>
      <strong>This profile couldn't be loaded.</strong>
      <div style="font-size:0.85rem;color:var(--gray);margin-top:6px;">${escapeHtml(err.message || 'Unknown error')}</div>
      <button class="btn-ghost" style="margin-top:18px;" onclick="document.getElementById('officerModal').classList.remove('show'); nav('officers');">Back to Stories</button>
    </div>`;
  }
}

function closeModal(e) {
  if (e.target.id === 'officerModal') document.getElementById('officerModal').classList.remove('show');
}

function searchOfficers() { applyFilters(); }

// ── PULSE — substantive, one-at-a-time activity feed sorted by momentum ──
let _pulseFilter = 'all';
let _pulseItems = [];
let _pulseIdx = 0;

function setPulseFilter(el, key) {
  document.querySelectorAll('#pulse .pulse-filters .pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  _pulseFilter = key;
  renderPulse();
}
// Programmatic version for empty-state CTAs
function _setPulseFilter(key) {
  const target = document.querySelector(`#pulse .pulse-filters .pill[data-pfilter="${key}"]`);
  if (target) { setPulseFilter(target, key); return; }
  // Fallback: just set state
  _pulseFilter = key;
  renderPulse();
}

// ── Pulse preference learning — what does THIS user actually engage with? ──
function _readPulsePrefs() { try { return JSON.parse(localStorage.getItem(PULSE_PREFS_KEY) || '{}'); } catch { return {}; } }
function _writePulsePrefs(p) { localStorage.setItem(PULSE_PREFS_KEY, JSON.stringify(p)); }
function recordPulsePreference(type, key) {
  if (!key) return;
  const p = _readPulsePrefs();
  p[type] = p[type] || {};
  p[type][key] = (p[type][key] || 0) + 1;
  _writePulsePrefs(p);
}
function getPulsePreferenceScore(type, key) {
  const p = _readPulsePrefs();
  return (p[type] && p[type][key]) || 0;
}

// Cached preference totals for normalization (refreshed each render)
let _pulsePrefCache = null;
function _refreshPulsePrefCache() {
  const p = _readPulsePrefs();
  const sum = (obj) => Object.values(obj || {}).reduce((s, n) => s + n, 0);
  _pulsePrefCache = {
    prefs: p,
    totalRole: sum(p.role) || 1,
    totalSent: sum(p.sentiment) || 1,
    totalAgency: sum(p.agency) || 1,
  };
}

function _pulseMomentum(it) {
  const r = it.review;
  if (!_pulsePrefCache) _refreshPulsePrefCache();
  const { prefs, totalRole, totalSent, totalAgency } = _pulsePrefCache;

  // Base momentum — story-intrinsic signals
  const ageHours = Math.max(1, (Date.now() - new Date(r.created_at || 0).getTime()) / 3600000);
  const recencyScore = Math.max(0, 100 - Math.log2(ageHours) * 10);   // log-decay: doesn't punish older too hard
  const replyScore   = Math.min(40, getReplyCount(it.officer.id, r.id) * 6);
  const ackScore     = getResolutionStatus(it.officer.id, r.id, r) === 'acknowledged' ? 12 : 0;
  const verifiedBoost= r.upload_url ? 4 : 0;

  // Personalization signals — all *normalized* (share of your engagement), not raw counts.
  // So nothing gets a fat thumb on the scale just because you clicked it once.
  const rolePct   = (prefs.role?.[it.role] || 0) / totalRole;                            // 0..1
  const sentPct   = (prefs.sentiment?.[r.verdict] || 0) / totalSent;                     // 0..1
  const agencyPct = (prefs.agency?.[it.officer.department] || 0) / totalAgency;          // 0..1

  // Cap each personalization signal at +18 max — none can dominate.
  const rolePref   = rolePct * 18;
  const sentPref   = sentPct * 10;
  const agencyPref = agencyPct * 18;

  // Subscriptions are just one more signal (+6), not a flat dominator.
  const subPref = getSubs().includes(it.officer.department) ? 6 : 0;

  return recencyScore + replyScore + ackScore + verifiedBoost
       + rolePref + sentPref + agencyPref + subPref;
}

// Category-mix: no more than 2 in a row of the same role. Keeps the feed varied
// so police doesn't drown out EMT / Fire / DMV / Hospital / Gov't.
function _mixByCategory(sortedItems, windowSize = 2) {
  const result = [];
  const pool = sortedItems.slice();
  while (pool.length) {
    const recent = result.slice(-windowSize).map(it => it.role);
    let pickedIdx = pool.findIndex(it => !recent.includes(it.role));
    if (pickedIdx === -1) pickedIdx = 0;  // ran out of variety — just take the next
    result.push(pool.splice(pickedIdx, 1)[0]);
  }
  return result;
}

function _renderOnePulseCard(it) {
  const o = it.officer, r = it.review;
  const author = r.author_display || _legacyAuthor(o.id, r.id);
  const isPos = r.verdict === 'fair';
  const status = getResolutionStatus(o.id, r.id, r);
  const meta = RES_META[status];
  const replyCount = getReplyCount(o.id, r.id);
  const trust = computeTrustScore(author);
  const story = (r.story || '').trim() || '(No description.)';
  const tags = r.tags || [];
  // "Hot right now" badge — strict: must be VERY recent (last 24h) AND have real engagement.
  // Without that, every seed story would look "Hot" because they're 5-star by default.
  const ageHours = (Date.now() - new Date(r.created_at || 0).getTime()) / 3600000;
  const isHot = ageHours < 24 && (replyCount >= 1 || (r._reactions && r._reactions > 0));
  return `
    <article class="pulse-card role-${it.role}" data-story-context data-officer-id="${o.id}" data-review-id="${r.id}" onclick="openStoryDetail(${o.id}, ${r.id})">
      <div class="pulse-card-head">
        <div class="pulse-card-role">
          <span class="pulse-role-icon">${ROLE_ICON[it.role] || '👤'}</span>
          <span class="pulse-role-name role-tinted-${it.role}">${ROLE_NAME[it.role] || ''}</span>
          ${isHot ? '<span class="hot-badge">Hot</span>' : ''}
        </div>
        <div class="pulse-sent ${isPos ? 'pos' : 'neg'}">
          <span class="pulse-stars">${starsStr(r.stars || 3)}</span>
          <span class="pulse-sent-tag">${isPos ? '★ Recognition' : '⚠ Concern'}</span>
        </div>
      </div>
      <h3 class="pulse-name" onclick="event.stopPropagation(); openOfficer(${o.id})">${escapeHtml(o.name || 'Unknown')}</h3>
      <div class="pulse-agency">${escapeHtml(o.department || 'Unknown agency')}${r.location ? ' · ' + escapeHtml(r.location) : ''} · ${formatDate(r.created_at)}</div>

      <div class="pulse-body">${escapeHtml(story.slice(0, 480))}${story.length > 480 ? '…' : ''}</div>

      ${tags.length ? `<div class="sp-tags-row" style="margin:8px 0 14px;">${tags.slice(0, 6).map(t => `<span class="spt">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}

      <div class="pulse-byline">
        <span class="pulse-author" onclick="event.stopPropagation(); openAuthorProfile('${escapeHtml(author).replace(/'/g, "\\'")}');"><span class="sp-author-avatar">${escapeHtml(author.charAt(0).toUpperCase())}</span>${escapeHtml(author)} · Trust ${trust.score}/100</span>
      </div>

      <div class="resolution-banner" style="background:${meta.bg};border:1px solid ${meta.border};color:${meta.color};margin-top:14px;">
        <span class="rb-icon">${meta.icon}</span>
        <span class="rb-text"><strong>${meta.label}</strong></span>
      </div>

      ${reactionTotalsHtml(o.id, r.id)}
      <div class="reaction-legend" onclick="event.stopPropagation();">
        How does this story land with you? <span class="rl-key">🙋 Me too · 👎 Not me · 🙏 Thanks · 💪 Strong · 🤔 Curious</span>
      </div>
      <div class="pulse-actions">
        <button class="sp-action up" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="up" onclick="reactTo(this, event)" title="I had the same experience">🙋 Me too</button>
        <button class="sp-action down" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="down" onclick="reactTo(this, event)" title="My experience was different">👎 Not me</button>
        <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="thanks" onclick="reactTo(this, event)" title="Thank you to the person in this story">🙏 Thanks</button>
        <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="strong" onclick="reactTo(this, event)" title="This story is powerful / strong">💪 Strong</button>
        <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="curious" onclick="reactTo(this, event)" title="I want to know more about this">🤔 Curious</button>
        <button class="sp-action" onclick="event.stopPropagation(); openStoryDetail(${o.id}, ${r.id})">💬 ${replyCount}</button>
        <button class="sp-action" onclick="event.stopPropagation(); shareStoryCard(${o.id}, ${r.id})">🔗 Share</button>
      </div>
    </article>
  `;
}

function renderPulse() {
  const stage = document.getElementById('pulseStage');
  if (!stage) return;
  _refreshPulsePrefCache();
  // Gather all reviews
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const approved = getApprovedAsOfficers();
  const all = [...approved, ...officers];
  let items = [];
  for (const o of all) {
    for (const r of (o.reviews || [])) {
      items.push({ officer: o, review: r, role: inferRole(o) });
      _streamIndex[`${o.id}:${r.id}`] = { officer: o, review: r, role: inferRole(o) };
    }
  }
  // Filter
  const subs = getSubs();
  if (_pulseFilter === 'recognitions') items = items.filter(it => it.review.verdict === 'fair');
  else if (_pulseFilter === 'concerns') items = items.filter(it => it.review.verdict === 'unfair');
  else if (_pulseFilter === 'open')      items = items.filter(it => getResolutionStatus(it.officer.id, it.review.id, it.review) === 'open');
  else if (_pulseFilter === 'subscribed') items = items.filter(it => subs.includes(it.officer.department));
  // Sort by momentum (recency + reactions + your prefs + subscriptions)
  items.sort((a, b) => _pulseMomentum(b) - _pulseMomentum(a));
  // Mix categories so no role dominates — interleave Police / EMT / Fire / DMV / Hospital / Gov't
  items = _mixByCategory(items, 2);
  items = items.slice(0, 100);
  // Interleave polls into the feed — every 4th slot when filter is 'all', or polls-only when filter='polls'
  const allPolls = [..._readApprovedPolls(), ...POLLS_SEED].map(p => ({ kind: 'poll', poll: p }));
  if (_pulseFilter === 'polls') {
    items = allPolls;
  } else if (_pulseFilter === 'all' && allPolls.length) {
    const mixed = [];
    let polli = 0;
    items.forEach((it, i) => {
      mixed.push({ kind: 'story', ...it });
      if ((i + 1) % 3 === 0 && polli < allPolls.length) {
        mixed.push(allPolls[polli++]);
      }
    });
    items = mixed;
  } else {
    items = items.map(it => ({ kind: 'story', ...it }));
  }
  _pulseItems = items;
  if (!items.length) {
    // Filter-aware empty state with a clear next action
    const emptyByFilter = {
      subscribed: `
        <div class="pulse-empty">
          <div class="pe-icon">🔔</div>
          <div class="pe-title">You're not subscribed to any agencies yet.</div>
          <div class="pe-sub">Subscriptions let you follow specific agencies (a precinct, your local school board, an ER) and see only their stories here.</div>
          <div class="pe-actions">
            <button class="btn-gold" onclick="nav('officers')">Browse Stories</button>
            <button class="btn-ghost" onclick="nav('complaint')">Browse Agencies</button>
          </div>
          <div class="pe-howto">Open any agency or person → tap <strong>🔔 Subscribe</strong> on their card. Come back here to see only their stories.</div>
        </div>`,
      recognitions: `<div class="pulse-empty"><div class="pe-icon">⭐</div><div class="pe-title">No recognitions match yet.</div><div class="pe-sub">Try "All" or share one of your own.</div><div class="pe-actions"><button class="btn-gold" onclick="_setPulseFilter('all')">Show all</button><button class="btn-ghost" onclick="nav('share')">Share a story</button></div></div>`,
      concerns:     `<div class="pulse-empty"><div class="pe-icon">⚠️</div><div class="pe-title">No concerns match yet.</div><div class="pe-sub">Try "All" or document one you witnessed.</div><div class="pe-actions"><button class="btn-gold" onclick="_setPulseFilter('all')">Show all</button><button class="btn-ghost" onclick="nav('share')">Share a story</button></div></div>`,
      open:         `<div class="pulse-empty"><div class="pe-icon">⏳</div><div class="pe-title">No open stories right now.</div><div class="pe-sub">Open = waiting on an agency response. They've all been acknowledged or resolved.</div><div class="pe-actions"><button class="btn-gold" onclick="_setPulseFilter('all')">Show all</button></div></div>`,
      all:          `<div class="pulse-empty"><div class="pe-icon">📭</div><div class="pe-title">No stories yet.</div><div class="pe-sub">Be the first.</div><div class="pe-actions"><button class="btn-gold" onclick="nav('share')">Share a story</button></div></div>`,
      polls:        `<div class="pulse-empty"><div class="pe-icon">🗳️</div><div class="pe-title">No polls yet.</div><div class="pe-sub">Open the Polls page or submit your own.</div><div class="pe-actions"><button class="btn-gold" onclick="nav('polls')">Open Polls</button><button class="btn-ghost" onclick="openSubmitPoll()">Submit a poll</button></div></div>`,
    };
    stage.innerHTML = emptyByFilter[_pulseFilter] || emptyByFilter.all;
    document.getElementById('pulsePos').textContent = 0;
    document.getElementById('pulseTotal').textContent = 0;
    return;
  }
  // Render every card stacked vertically — scroll snaps each into view. Mix of stories + polls.
  const topRail = _renderTopReactedRail();
  stage.innerHTML = (topRail || '') + items.map(it => it.kind === 'poll' ? _renderOnePulsePollCard(it.poll) : _renderOnePulseCard(it)).join('');
  document.getElementById('pulseTotal').textContent = items.length;
  document.getElementById('pulsePos').textContent = 1;
  // Track which card is on-screen for the position counter
  _attachPulseScrollObserver();
  // Reset scroll to top when filter changes
  stage.scrollTop = 0;
}

let _pulseObserver = null;
// "Top reacted" rail at the top of Pulse — three most-reacted stories of the last 7 days.
// Shows social proof and creates "what's everyone talking about" gravity. Hidden if nothing has 3+ reactions.
function _renderTopReactedRail() {
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  const approved = getApprovedAsOfficers();
  const all = [...approved, ...officers];
  const items = [];
  const now = Date.now();
  for (const o of all) {
    for (const r of (o.reviews || [])) {
      const age = (now - new Date(r.created_at || 0).getTime()) / (1000 * 60 * 60 * 24);
      if (age > 14) continue;  // last 14 days
      const c = getReactionCounts(o.id, r.id);
      const total = c.up + c.down + c.thanks + c.strong + c.curious;
      if (total < 3) continue;
      items.push({ o, r, total, role: inferRole(o) });
    }
  }
  if (!items.length) return '';
  items.sort((a, b) => b.total - a.total);
  const top3 = items.slice(0, 3);
  return `
    <div class="top-reacted-rail" onclick="event.stopPropagation();">
      <div class="trr-head">
        <span class="trr-title">🔥 Top reacted right now</span>
        <span class="trr-sub">What people are responding to this week</span>
      </div>
      <div class="trr-list">
        ${top3.map(({ o, r, total, role }) => `
          <div class="trr-card" onclick="event.stopPropagation(); openStoryDetail(${o.id}, ${r.id})">
            <div class="trr-eyebrow role-tinted-${role}">${ROLE_ICON[role] || '👤'} ${ROLE_NAME[role] || ''}</div>
            <div class="trr-name">${escapeHtml(o.name || 'Unknown')}</div>
            <div class="trr-snippet">${escapeHtml((r.story || '').slice(0, 90))}${(r.story || '').length > 90 ? '…' : ''}</div>
            <div class="trr-total">${total} reactions</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// Render a poll inline in the Pulse feed — same height/feel as a story card
function _renderOnePulsePollCard(p) {
  const my = _readPollsMy();
  const myVote = my[p.id];
  const counts = _readPollsVotes()[p.id] || _seedPollCounts(p.id);
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  const optionsHtml = p.options.map(o => {
    const c = counts[o.id] || 0;
    const pct = Math.round((c / total) * 100);
    const isMine = myVote === o.id;
    return `
      <div class="poll-opt ${isMine ? 'voted' : ''}" onclick="event.stopPropagation(); votePoll('${p.id}','${o.id}')">
        <div class="po-bar" style="width:${myVote ? pct : 0}%;"></div>
        <span class="po-label">${escapeHtml(o.label)}${isMine ? ' &middot; <strong style="color:var(--accent);">your vote</strong>' : ''}</span>
        ${myVote ? `<span class="po-pct">${pct}%</span>` : ''}
      </div>`;
  }).join('');
  return `
    <article class="pulse-card pulse-poll-card" data-poll-id="${p.id}" onclick="event.stopPropagation(); nav('polls');">
      <div class="pulse-card-head">
        <div class="pulse-card-role">
          <span class="pulse-role-icon">🗳️</span>
          <span class="pulse-role-name role-tinted-gov">POLL · ${escapeHtml(p.cat)}</span>
        </div>
        <div class="pulse-sent pos">
          <span class="pulse-sent-tag">${total.toLocaleString()} takes</span>
        </div>
      </div>
      <h3 class="pulse-name" style="font-size:1.85rem;">${escapeHtml(p.q)}</h3>
      <div class="pulse-agency">Take your stand. Anonymous. Results live.</div>
      <div class="poll-options" style="margin:14px 0 18px;">${optionsHtml}</div>
      <div class="pulse-actions">
        <button class="sp-action" onclick="event.stopPropagation(); nav('polls');">🗳️ Open in Polls</button>
        <button class="sp-action" onclick="event.stopPropagation(); openSubmitPoll();">✍️ Submit your own</button>
      </div>
    </article>
  `;
}

// Swipe gestures on Pulse — left = next, right = previous. Vertical scroll still works.
// Also pull-to-refresh — drag down from top of page → release → reload feed.
function _attachPulseSwipe() {
  const stage = document.getElementById('pulseStage');
  if (!stage) return;
  let startX = 0, startY = 0, startT = 0;
  let ptrStartY = 0, ptrActive = false;
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
    // Pull-to-refresh only triggers when page is at top
    if (window.scrollY <= 4 && document.body.classList.contains('on-pulse')) {
      ptrStartY = e.touches[0].clientY;
      ptrActive = true;
    }
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (!ptrActive) return;
    const dy = e.touches[0].clientY - ptrStartY;
    if (dy > 12 && window.scrollY <= 4) {
      _showPtrIndicator(dy >= 70 ? 'release' : 'pull');
    } else if (dy <= 12) {
      _hidePtrIndicator();
    }
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (!startT) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startT;
    startT = 0;
    if (ptrActive) {
      ptrActive = false;
      if (dy > 70 && window.scrollY <= 4) {
        _doPtrRefresh();
      } else {
        _hidePtrIndicator();
      }
      return;
    }
    // Horizontal swipe (left/right) between cards
    if (Math.abs(dx) < 60 || dt > 500 || Math.abs(dy) > 40) return;
    if (dx < 0) pulseNext(); else pulsePrev();
  }, { passive: true });
}
function _showPtrIndicator(state) {
  let el = document.getElementById('ptrIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ptrIndicator';
    el.className = 'ptr-indicator';
    el.innerHTML = '<span class="ptr-icon">🔄</span><span class="ptr-text">Pull to refresh</span>';
    document.body.appendChild(el);
  }
  el.classList.add('pulling');
  el.querySelector('.ptr-text').textContent = state === 'release' ? 'Release to refresh' : 'Pull to refresh';
}
function _hidePtrIndicator() {
  const el = document.getElementById('ptrIndicator');
  if (el) el.classList.remove('pulling', 'refreshing');
}
function _doPtrRefresh() {
  const el = document.getElementById('ptrIndicator');
  if (el) { el.classList.remove('pulling'); el.classList.add('refreshing'); el.querySelector('.ptr-text').textContent = 'Refreshing…'; }
  // Soft haptic on refresh
  if (navigator.vibrate) try { navigator.vibrate([15, 40, 15]); } catch {}
  setTimeout(() => { renderPulse(); _hidePtrIndicator(); }, 350);
}

function _attachPulseScrollObserver() {
  if (_pulseObserver) _pulseObserver.disconnect();
  const stage = document.getElementById('pulseStage');
  if (!stage) return;
  const cards = stage.querySelectorAll('.pulse-card');
  _pulseObserver = new IntersectionObserver((entries) => {
    // Find the entry closest to centre (highest intersection ratio)
    let best = null;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
    }
    if (best) {
      const idx = Array.from(cards).indexOf(best.target);
      if (idx >= 0) document.getElementById('pulsePos').textContent = idx + 1;
    }
  }, { root: stage, threshold: [0.4, 0.6, 0.8] });
  cards.forEach(c => _pulseObserver.observe(c));
}

function pulseNext() {
  const stage = document.getElementById('pulseStage');
  if (!stage) return;
  const cards = stage.querySelectorAll('.pulse-card');
  const idx = Math.min(cards.length - 1, parseInt(document.getElementById('pulsePos').textContent || '1', 10));
  cards[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function pulsePrev() {
  const stage = document.getElementById('pulseStage');
  if (!stage) return;
  const cards = stage.querySelectorAll('.pulse-card');
  const idx = Math.max(0, parseInt(document.getElementById('pulsePos').textContent || '1', 10) - 2);
  cards[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Keyboard nav on Pulse — also natural scroll works
document.addEventListener('keydown', (e) => {
  const onPulse = document.getElementById('pulse')?.classList.contains('active');
  if (!onPulse) return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); pulseNext(); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); pulsePrev(); }
});

// ── CONTRIBUTORS / COMMUNITY page ──
let _contribSort = 'recent';
function setContributorSort(el, key) {
  document.querySelectorAll('#contributors .pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  _contribSort = key;
  renderContributors();
}
function renderContributors() {
  const grid = document.getElementById('contributorGrid');
  if (!grid) return;
  // Build a map: handle → { stories[], fair, total, avgStars, lastDate }
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const approved = getApprovedAsOfficers();
  const all = [...approved, ...officers];
  const map = new Map();
  for (const o of all) {
    for (const r of (o.reviews || [])) {
      const handle = r.author_display || _legacyAuthor(o.id, r.id);
      if (!map.has(handle)) map.set(handle, { handle, total: 0, fair: 0, unfair: 0, sumStars: 0, lastDate: null });
      const entry = map.get(handle);
      entry.total++;
      if (r.verdict === 'fair') entry.fair++; else entry.unfair++;
      entry.sumStars += (r.stars || 3);
      const d = new Date(r.created_at || 0);
      if (!entry.lastDate || d > entry.lastDate) entry.lastDate = d;
    }
  }
  let list = Array.from(map.values()).map(e => ({ ...e, avgStars: e.total ? e.sumStars / e.total : 0 }));

  // Filter by search
  const q = (document.getElementById('contributorSearch')?.value || '').toLowerCase().trim();
  if (q) list = list.filter(c => c.handle.toLowerCase().includes(q));

  // Sort
  if (_contribSort === 'most')          list.sort((a, b) => b.total - a.total);
  else if (_contribSort === 'positive') list.sort((a, b) => b.fair - a.fair);
  else                                  list.sort((a, b) => (b.lastDate || 0) - (a.lastDate || 0));
  list = list.slice(0, 120);

  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--gray);text-align:center;padding:40px 0;grid-column:1/-1;">No contributors found.</div>';
    return;
  }

  grid.innerHTML = list.map(c => {
    const trust = computeTrustScore(c.handle);
    const initial = c.handle.charAt(0).toUpperCase();
    return `
      <div class="officer-card role-contributor" onclick="openAuthorProfile('${escapeHtml(c.handle).replace(/'/g, "\\'")}');">
        <div class="oc-eyebrow" style="color:${trust.tier.color};">${trust.tier.label} · TRUST ${trust.score}/100</div>
        <div class="oc-name" style="display:flex;align-items:center;gap:10px;">
          <span class="oc-initial" style="background:${trust.tier.color}22;color:${trust.tier.color};">${escapeHtml(initial)}</span>
          ${escapeHtml(c.handle)}
        </div>
        <div class="oc-dept">Average rating given: ${c.avgStars.toFixed(1)}★</div>
        <div class="oc-stat-row">
          <span class="oc-stars">${starsStr(Math.round(c.avgStars))}</span>
          <span class="oc-avg">${c.avgStars.toFixed(1)}</span>
        </div>
        <div class="oc-meta">
          <span class="oc-chip fair">★ ${c.fair} recognitions</span>
          ${c.unfair > 0 ? `<span class="oc-chip unfair">⚠ ${c.unfair} concerns</span>` : ''}
        </div>
        <button class="oc-view">View stories &rarr;</button>
      </div>
    `;
  }).join('');
}

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
  if (o.role) return o.role;  // explicit role wins (used for elected officials, school board, etc.)
  const d = (o.department || '').toLowerCase();
  const n = (o.name || '').toLowerCase();
  if (/\b(school board|board of ed|district)\b/.test(d) || /\b(trustee|board member|superintendent)\b/.test(n)) return 'school';
  if (/\b(village|town|city council|county legislat|mayor's office|board of trustees)\b/.test(d) || /\b(mayor|trustee|councilmember|legislator|supervisor)\b/.test(n)) return 'elected';
  if (/\b(senate|congress|governor's office|white house|u\.s\.|federal)\b/.test(d) || /\b(senator|congress|governor|president|representative)\b/.test(n)) return 'federal';
  if (/\b(ems|ambulance|paramedic)\b/.test(d) || /\b(emt|paramedic|lt\. paramedic)\b/.test(n)) return 'emt';
  if (/\b(fire|fd|engine|hose)\b/.test(d) || /\b(firefighter|capt\.|lt\. firefighter)\b/.test(n)) return 'fire';
  if (/\bdmv\b/.test(d) || /\b(clerk|window)\b/.test(n)) return 'dmv';
  if (/\b(hospital|medical|sinai|montefiore|good samaritan|langone|nyack hospital)\b/.test(d) || /\b(nurse|rn|pa|tech|admissions)\b/.test(n)) return 'hospital';
  if (/\b(tax|hra|housing|unemployment|county clerk|dept of)\b/.test(d) || /\b(caseworker|case manager|inspector|specialist)\b/.test(n)) return 'gov';
  return 'police';
}

function applyFilters() {
  let list = [...officerCache];
  const rawQ = document.getElementById('officerSearch').value.trim();
  const q = rawQ.toLowerCase();
  if (q) {
    // Author search — when query starts with @ (e.g. "@Anonymous-4791"), filter to officers
    // who have at least one story by that handle. Stream view will further refine to just their stories.
    if (q.startsWith('@')) {
      const handleQ = q.slice(1);
      list = list.filter(o => (o.reviews || []).some(r => {
        const a = (r.author_display || _legacyAuthor(o.id, r.id)).toLowerCase();
        return a.includes(handleQ);
      }));
      // Force stream view so author's stories are visible chronologically
      const stream = document.getElementById('storyStream');
      const grid = document.getElementById('officerGrid');
      if (stream && grid) {
        stream.style.display = 'flex';
        grid.style.display = 'none';
        document.querySelectorAll('.vt-btn').forEach(b => b.classList.toggle('on', b.dataset.view === 'stream'));
      }
    } else {
      list = list.filter(o =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.badge || '').toLowerCase().includes(q) ||
        (o.department || '').toLowerCase().includes(q)
      );
    }
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

const ROLE_ICON = { police:'🚔', emt:'🚑', fire:'🚒', dmv:'🪪', hospital:'🏥', gov:'👨‍💼', school:'🎓', elected:'🏛️', federal:'🇺🇸' };
const ROLE_NAME = { police:'POLICE', emt:'EMT', fire:'FIRE', dmv:'DMV', hospital:'HOSPITAL', gov:'GOV\'T', school:'SCHOOL BOARD', elected:'LOCAL ELECTED', federal:'STATE / FEDERAL' };
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
        ${reactionTotalsHtml(o.id, r.id)}
        <div class="sp-foot">
          <div class="sp-actions">
            <button class="sp-action up" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="up" onclick="reactTo(this, event)" title="I had this same experience">🙋 Me too</button>
            <button class="sp-action down" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="down" onclick="reactTo(this, event)" title="My experience was different">👎 Not me</button>
            <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="thanks" onclick="reactTo(this, event)" title="Thank you">🙏</button>
            <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="strong" onclick="reactTo(this, event)" title="Strong / powerful">💪</button>
            <button class="sp-action" data-officer-id="${o.id}" data-review-id="${r.id}" data-kind="curious" onclick="reactTo(this, event)" title="Curious — want to know more">🤔</button>
            ${getReplyCount(o.id, r.id) > 0 ? `<button class="sp-action" onclick="event.stopPropagation(); openStoryDetail(${o.id}, ${r.id})">💬 ${getReplyCount(o.id, r.id)}</button>` : ''}
            <button class="sp-action" onclick="event.stopPropagation(); shareStoryCard(${o.id}, ${r.id})">🔗 Share</button>
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
  recordEngagement('story-view');
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
    ${(() => {
      const status = getResolutionStatus(o.id, r.id, r);
      const meta = RES_META[status];
      const u = getCurrentUser();
      const myHandle = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : null;
      const isAuthor = myHandle && myHandle === author;
      const canMarkResolved = isAuthor && status !== 'resolved';
      return `
        <div class="resolution-banner" style="background:${meta.bg};border:1px solid ${meta.border};color:${meta.color};">
          <span class="rb-icon">${meta.icon}</span>
          <span class="rb-text"><strong>Status: ${meta.label}</strong>${status === 'open' ? ' — waiting for the agency to respond' : status === 'acknowledged' ? ' — the agency has responded in the thread below' : status === 'resolved' ? ' — the author marked this resolved' : ' — no response from the agency after 30+ days'}</span>
          ${canMarkResolved ? `<button class="rb-btn" onclick="markStoryResolved(${o.id}, ${r.id})">✓ Mark resolved</button>` : ''}
        </div>
      `;
    })()}
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
      <button class="sp-action up" data-officer-id="${o.id}" data-review-id="${r.id}" onclick="thanksTo(this, event)">👍 Same here</button>
      <button class="sp-action" onclick="shareStoryCard(${o.id}, ${r.id})">🔗 Share card</button>
      ${(() => {
        const u = getCurrentUser();
        const myHandle = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : null;
        const isMine = myHandle && myHandle === author;
        return isMine
          ? `<button class="sp-action primary" onclick="closeStoryDetail(); nav('complaint');">&#9993;&#65039; Send to agency</button>`
          : `<button class="sp-action primary" onclick="closeStoryDetail(); openOfficer(${o.id})">View full profile →</button>`;
      })()}
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

  // Notify the original author (unless it's the user replying to their own story)
  const it = _streamIndex[`${officerId}:${reviewId}`];
  if (it) {
    const author = it.review.author_display || _legacyAuthor(it.officer.id, it.review.id);
    const myHandle = user.anonymous ? user.handle : (user.displayName || user.handle);
    if (author !== myHandle) {
      addNotification(author, {
        type: org && org.verified ? 'agency' : 'reply',
        story: { officer_id: officerId, review_id: reviewId, name: it.officer.name },
        from: org && org.verified ? org.agency_name : myHandle,
      });
    }
    // If this is a verified agency reply, auto-bump resolution to acknowledged
    if (org && org.verified) {
      setResolutionStatus(officerId, reviewId, 'acknowledged', org.agency_name);
    }
  }
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
  // Gather every story attributed to this handle — seed data AND user submissions (approved)
  const seedOfficers = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  const approvedOfficers = getApprovedAsOfficers();
  const allOfficers = [...approvedOfficers, ...seedOfficers, ...officerCache];
  // De-dupe by id (a user-submission officer may appear in both approved + officerCache)
  const seen = new Set();
  const officers = [];
  for (const o of allOfficers) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    officers.push(o);
  }
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
      <div class="sd-icon" style="background:var(--accent-soft);color:var(--accent);font-family:'Bricolage Grotesque','Syne',sans-serif;font-weight:800;font-size:1.6rem;">${escapeHtml(initial)}</div>
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
            <span style="flex:1 1 100%;min-width:0;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden;">
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

// ── RESOLUTION TRACKING ──
// Each story carries a status: open | acknowledged | resolved | no_response (auto after 30d open)
function _readResolutions() {
  try { return JSON.parse(localStorage.getItem(RESOLUTIONS_KEY) || '{}'); } catch { return {}; }
}
function _writeResolutions(m) { localStorage.setItem(RESOLUTIONS_KEY, JSON.stringify(m)); }

function getResolutionStatus(officerId, reviewId, review) {
  const key = `${officerId}:${reviewId}`;
  const overrides = _readResolutions();
  if (overrides[key]) return overrides[key];
  // Auto-derive:
  //   - any agency-verified reply → acknowledged
  //   - older than 30 days with no replies → no_response
  //   - else open
  const replies = getReplies(officerId, reviewId);
  if (replies.some(r => r.is_agency_response)) return 'acknowledged';
  if (review && review.created_at) {
    const ageDays = (Date.now() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 30) return 'no_response';
  }
  return 'open';
}
function setResolutionStatus(officerId, reviewId, status, byHandle) {
  const key = `${officerId}:${reviewId}`;
  const m = _readResolutions();
  m[key] = status;
  _writeResolutions(m);
  // Notify the author when status changes (if author isn't us)
  const it = _streamIndex[key];
  if (it) {
    const r = it.review;
    const author = r.author_display || _legacyAuthor(it.officer.id, r.id);
    addNotification(author, {
      type: 'resolution',
      story: { officer_id: it.officer.id, review_id: r.id, name: it.officer.name },
      status,
      from: byHandle || 'CivicVoice',
    });
  }
}
function markStoryResolved(officerId, reviewId) {
  if (!requireAuth(() => markStoryResolved(officerId, reviewId), 'Sign in to mark resolved')) return;
  const u = getCurrentUser();
  const myHandle = u.anonymous ? u.handle : (u.displayName || u.handle);
  setResolutionStatus(officerId, reviewId, 'resolved', myHandle);
  // Re-render the open story detail
  openStoryDetail(officerId, reviewId);
}

const RES_META = {
  open:         { label: 'Open',                color: 'var(--accent)',  bg: 'rgba(184,148,30,0.08)',  border: 'rgba(184,148,30,0.3)', icon: '⏳' },
  acknowledged: { label: 'Agency acknowledged', color: 'var(--blue)',    bg: 'rgba(37,109,217,0.08)',  border: 'rgba(37,109,217,0.32)',icon: '💬' },
  resolved:     { label: 'Resolved',            color: 'var(--green)',   bg: 'rgba(31,140,95,0.1)',    border: 'rgba(31,140,95,0.35)', icon: '✅' },
  no_response:  { label: 'No response',         color: 'var(--red)',     bg: 'rgba(201,52,52,0.08)',   border: 'rgba(201,52,52,0.32)', icon: '⚠️' },
};

// Per-agency resolution stats
function computeAgencyResolutionStats(deptName) {
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const approved = getApprovedAsOfficers();
  const matches = [...approved, ...officers].filter(o => o.department === deptName);
  let total = 0, acknowledged = 0, resolved = 0, open = 0, noResponse = 0;
  for (const o of matches) {
    for (const r of (o.reviews || [])) {
      total++;
      const s = getResolutionStatus(o.id, r.id, r);
      if (s === 'acknowledged') acknowledged++;
      else if (s === 'resolved') resolved++;
      else if (s === 'no_response') noResponse++;
      else open++;
    }
  }
  const responded = acknowledged + resolved;
  return {
    total, acknowledged, resolved, open, noResponse,
    responseRate: total ? Math.round((responded / total) * 100) : 0,
  };
}

// ── NOTIFICATIONS ──
function _allNotifs() { try { return JSON.parse(localStorage.getItem(NOTIFS_KEY) || '{}'); } catch { return {}; } }
function _writeAllNotifs(m) { localStorage.setItem(NOTIFS_KEY, JSON.stringify(m)); }
function _myNotifs() {
  const u = getCurrentUser();
  if (!u) return [];
  const all = _allNotifs();
  const me = u.anonymous ? u.handle : (u.displayName || u.handle);
  return all[me] || [];
}
function _saveMyNotifs(arr) {
  const u = getCurrentUser();
  if (!u) return;
  const all = _allNotifs();
  const me = u.anonymous ? u.handle : (u.displayName || u.handle);
  all[me] = arr;
  _writeAllNotifs(all);
}
function addNotification(toHandle, payload) {
  if (!toHandle) return;
  const all = _allNotifs();
  all[toHandle] = all[toHandle] || [];
  all[toHandle].unshift({
    id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5),
    ts: new Date().toISOString(),
    read: false,
    ...payload,
  });
  // Cap at 50
  all[toHandle] = all[toHandle].slice(0, 50);
  _writeAllNotifs(all);
  renderBellState();
  // Also fire a browser notification if user has opted in
  if (getPushPref() && 'Notification' in window && Notification.permission === 'granted') {
    const u = getCurrentUser();
    const me = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : null;
    if (me === toHandle) {
      const text = _notifText(payload);
      try { new Notification('CivicVoice', { body: text, icon: 'icon-192.png' }); } catch {}
    }
  }
}
function _notifText(n) {
  if (n.type === 'same_here') return `${n.from} said "same here" on your story about ${n.story.name || 'a public servant'}`;
  if (n.type === 'reply')     return `${n.from} replied to your story about ${n.story.name || 'a public servant'}`;
  if (n.type === 'agency')    return `${n.from} (verified agency) responded to your story`;
  if (n.type === 'resolution')return `Status changed to ${RES_META[n.status]?.label || n.status}: ${n.story.name || 'a story'}`;
  if (n.type === 'subscription') return `New story in ${n.agency} (you subscribe)`;
  return 'Activity on your story';
}
function unreadNotifCount() { return _myNotifs().filter(n => !n.read).length; }
function markAllNotifsRead() {
  const arr = _myNotifs().map(n => ({ ...n, read: true }));
  _saveMyNotifs(arr);
  renderBellState();
  renderBellDropdown();
}
function clearNotifs() {
  _saveMyNotifs([]);
  renderBellState();
  renderBellDropdown();
}

// ── NOTIFICATION PREFS ──
const DEFAULT_NOTIF_PREFS = {
  same_here:    { bell: true,  push: false, email: false },
  reply:        { bell: true,  push: true,  email: false },
  agency:       { bell: true,  push: true,  email: true  },
  resolution:   { bell: true,  push: false, email: false },
  subscription: { bell: true,  push: false, email: true  },
};
function getNotifPrefs() {
  try { return { ...DEFAULT_NOTIF_PREFS, ...(JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}')) }; }
  catch { return DEFAULT_NOTIF_PREFS; }
}
function setNotifPref(event, channel, on) {
  const p = getNotifPrefs();
  p[event] = { ...p[event], [channel]: on };
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p));
  renderNotifPrefs();
}
function openNotifPrefs() {
  closeUserMenu();
  if (!requireAuth(() => openNotifPrefs(), 'Sign in to set notification preferences')) return;
  document.getElementById('notifPrefsModal').classList.add('show');
  renderNotifPrefs();
}
function closeNotifPrefs() {
  document.getElementById('notifPrefsModal').classList.remove('show');
}
function renderNotifPrefs() {
  const body = document.getElementById('notifPrefsBody');
  if (!body) return;
  const prefs = getNotifPrefs();
  const EVENTS = [
    { key: 'same_here',    label: 'Someone says "same here" on my story' },
    { key: 'reply',        label: 'Someone replies to my story' },
    { key: 'agency',       label: 'A verified agency responds to my story' },
    { key: 'resolution',   label: 'My story\'s status changes' },
    { key: 'subscription', label: 'New story in an agency I subscribe to' },
  ];
  body.innerHTML = `
    <div class="np-grid-head">
      <div></div>
      <div>🔔 Bell</div>
      <div>📱 Push</div>
      <div>✉️ Email</div>
    </div>
    ${EVENTS.map(e => `
      <div class="np-grid-row">
        <div class="np-event">${escapeHtml(e.label)}</div>
        ${['bell', 'push', 'email'].map(ch => `
          <label class="np-cell">
            <input type="checkbox" ${prefs[e.key]?.[ch] ? 'checked' : ''} onchange="setNotifPref('${e.key}','${ch}', this.checked)">
            <span class="np-box"></span>
          </label>
        `).join('')}
      </div>
    `).join('')}
    <div style="font-size:0.78rem;color:var(--gray);margin-top:14px;padding-top:14px;border-top:1px solid var(--border);line-height:1.55;">
      Push and email channels are wired and will activate once the backend is deployed. Bell works now.
    </div>
  `;
}

// ── BELL ──
function toggleBellDropdown() {
  const d = document.getElementById('bellDropdown');
  d.classList.toggle('show');
  if (d.classList.contains('show')) {
    renderBellDropdown();
    // Auto-mark all as read 1 sec after opening
    setTimeout(() => markAllNotifsRead(), 1200);
  }
}
function closeBellDropdown() {
  document.getElementById('bellDropdown')?.classList.remove('show');
}
function renderBellState() {
  const badge = document.getElementById('bellBadge');
  if (!badge) return;
  const count = unreadNotifCount();
  if (count > 0) {
    badge.style.display = 'inline-flex';
    badge.textContent = count > 9 ? '9+' : count;
  } else {
    badge.style.display = 'none';
  }
}
function renderBellDropdown() {
  const list = document.getElementById('bellList');
  if (!list) return;
  const u = getCurrentUser();
  if (!u) {
    list.innerHTML = '<div style="color:var(--gray);padding:18px;text-align:center;font-size:0.86rem;">Sign in to see notifications.</div>';
    return;
  }
  const arr = _myNotifs();
  if (!arr.length) {
    list.innerHTML = '<div style="color:var(--gray);padding:30px 18px;text-align:center;font-size:0.86rem;">No notifications yet.<br><span style="font-size:0.76rem;">When someone reacts to or replies to your stories, you\'ll see it here.</span></div>';
    return;
  }
  list.innerHTML = arr.slice(0, 20).map(n => `
    <div class="bell-item ${n.read ? '' : 'unread'}" ${n.story ? `onclick="closeBellDropdown(); openStoryDetail(${n.story.officer_id}, ${n.story.review_id});"` : ''}>
      <div class="bell-text">${_notifText(n)}</div>
      <div class="bell-time">${formatDate(n.ts)}</div>
    </div>
  `).join('');
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
      <div class="sd-icon" style="background:var(--accent-soft);color:var(--accent);font-family:'Bricolage Grotesque','Syne',sans-serif;font-weight:800;font-size:1.4rem;">${escapeHtml(myHandle.charAt(0).toUpperCase())}</div>
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
      <div class="sd-icon" style="background:var(--accent-soft);color:var(--accent);font-family:'Bricolage Grotesque','Syne',sans-serif;font-weight:800;font-size:1.4rem;">${escapeHtml(otherHandle.charAt(0).toUpperCase())}</div>
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
    const md = document.getElementById('mobileDrawer');
    if (md && md.classList.contains('show')) closeMobileDrawer();
  }
});

// Lightweight engagement signal — increments a "same here" counter on the button.
// Requires sign-in (you can read without an account, but engaging requires one).
// Notifies the original author.
// Reaction handler — handles all 5 reactions (🙋 👎 🙏 💪 🤔) with tap burst animation + haptics.
// One reaction per kind per user per story — second tap is a no-op (prevents spam).
const REACTION_STYLES = {
  up:      { emoji:'🙋', label:'Me too',      color:'var(--green)', bd:'rgba(31,140,95,0.5)',  bg:'rgba(31,140,95,0.12)'  },
  down:    { emoji:'👎', label:'Not me',      color:'var(--red)',   bd:'rgba(201,52,52,0.5)',  bg:'rgba(201,52,52,0.10)'  },
  thanks:  { emoji:'🙏', label:'Thank you',   color:'#7a51c8',      bd:'rgba(122,81,200,0.5)', bg:'rgba(122,81,200,0.12)' },
  strong:  { emoji:'💪', label:'Strong',      color:'#e07a1a',      bd:'rgba(224,122,26,0.5)', bg:'rgba(224,122,26,0.12)' },
  curious: { emoji:'🤔', label:'Curious',     color:'#2563d9',      bd:'rgba(37,109,217,0.5)', bg:'rgba(37,109,217,0.10)' },
};
function reactTo(btn, evt) {
  if (evt) evt.stopPropagation();
  if (!requireAuth(() => reactTo(btn), 'Sign in to react')) return;
  const kind = btn.dataset.kind || 'up';
  const oid = btn.dataset.officerId;
  const rid = btn.dataset.reviewId;
  // ONE per kind per user per story — block second tap
  const mine = _readMyReactions();
  const key = `${oid}:${rid}`;
  if (mine[key] && mine[key][kind]) {
    // Already reacted this way — give a soft "already counted" shake, don't bump count
    btn.classList.add('tap-pulse');
    setTimeout(() => btn.classList.remove('tap-pulse'), 280);
    return;
  }
  // Me-too and Not-me are mutually exclusive — tapping one clears the other for THIS user
  // (we don't subtract counts; we just don't allow flip-flopping to inflate)
  if ((kind === 'up' || kind === 'down') && mine[key]) {
    const opp = kind === 'up' ? 'down' : 'up';
    if (mine[key][opp]) {
      // Already picked the opposite — block it. Mutually exclusive.
      btn.classList.add('tap-pulse');
      setTimeout(() => btn.classList.remove('tap-pulse'), 280);
      _showStreakToast(`You already marked "${REACTION_STYLES[opp].label}" on this story. One stance per story.`);
      return;
    }
  }
  recordEngagement('react');
  if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
  playReactionSound();
  if (oid && rid) _bumpReactionCount(oid, rid, kind);
  const s = REACTION_STYLES[kind] || REACTION_STYLES.up;
  const counts = getReactionCounts(oid, rid);
  const n = counts[kind];
  // Render: full label for up/down (they're the headline reactions); compact for the rest
  btn.innerHTML = (kind === 'up' || kind === 'down') ? `${s.emoji} ${s.label} · ${n}` : `${s.emoji} ${n}`;
  btn.style.color = s.color;
  btn.style.borderColor = s.bd;
  btn.style.background = s.bg;
  btn.classList.add('reacted');
  btn.title = 'You already reacted this way';
  _emojiBurst(btn, s.emoji);
  btn.classList.add('tap-pulse');
  setTimeout(() => btn.classList.remove('tap-pulse'), 320);
  if (kind === 'up' || kind === 'thanks' || kind === 'strong') _legacyThanksFollowup(btn);
  _checkStreakMilestones();
  // Re-render the visible reaction summary on this card so counts update immediately
  _refreshReactionSummary(btn);
}

// Update the visible reaction-summary block next to this card after a reaction
function _refreshReactionSummary(btn) {
  const oid = btn.dataset.officerId;
  const rid = btn.dataset.reviewId;
  if (!oid || !rid) return;
  // Find the nearest container that has this story's summary
  const card = btn.closest('.pulse-card, .story-post, .mo-review');
  if (!card) return;
  const summary = card.querySelector('.reaction-summary');
  const fresh = reactionTotalsHtml(oid, rid);
  if (!fresh) return;
  if (summary) summary.outerHTML = fresh;
}

// Celebrate when user hits 3, 10, or 25 engagements today, or 7-day streak
function _checkStreakMilestones() {
  const c = _streakCounts();
  const seenKey = 'civicvoice_seen_milestones_v1';
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch {}
  const today = _todayKey();
  const milestones = [
    { id: `${today}-3`,  trigger: c.today === 3,  msg: "🔥 3 today. You're paying attention." },
    { id: `${today}-10`, trigger: c.today === 10, msg: "💥 10 today. That's how communities actually change." },
    { id: `${today}-25`, trigger: c.today === 25, msg: "🚀 25 today. You're the kind of citizen this country needs." },
  ];
  for (const m of milestones) {
    if (m.trigger && !seen.includes(m.id)) {
      seen.push(m.id);
      localStorage.setItem(seenKey, JSON.stringify(seen));
      _showStreakToast(m.msg);
    }
  }
}
function _showStreakToast(msg) {
  const t = document.createElement('div');
  t.className = 'streak-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 30);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}
function _emojiBurst(btn, emoji) {
  const rect = btn.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const e = document.createElement('span');
    e.className = 'emoji-burst';
    e.textContent = emoji;
    e.style.left = (rect.left + rect.width / 2 + (Math.random() * 40 - 20)) + 'px';
    e.style.top = (rect.top + 8) + 'px';
    e.style.animationDelay = (i * 35) + 'ms';
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 1100);
  }
}
// Back-compat: older HTML may still call thanksTo() — keep as an 'up' alias for reactTo
function thanksTo(btn, evt) {
  btn.dataset.kind = 'up';
  return reactTo(btn, evt);
}
function _legacyThanksFollowup(btn) {
  // Notify the author
  const ctx = btn.closest('[data-story-context]');
  const oid = ctx ? +ctx.dataset.officerId : btn.dataset.officerId;
  const rid = ctx ? +ctx.dataset.reviewId  : btn.dataset.reviewId;
  if (oid && rid) {
    const it = _streamIndex[`${oid}:${rid}`];
    if (it) {
      const author = it.review.author_display || _legacyAuthor(it.officer.id, it.review.id);
      const u = getCurrentUser();
      const me = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : 'Anonymous';
      // Learn what this user engages with — boosts similar stories in Pulse
      recordPulsePreference('role', it.role);
      recordPulsePreference('sentiment', it.review.verdict);
      recordPulsePreference('agency', it.officer.department);
      if (author !== me) {
        addNotification(author, {
          type: 'same_here',
          story: { officer_id: oid, review_id: rid, name: it.officer.name },
          from: me,
        });
      }
    }
  }
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
  if (d.role) return d.role;  // explicit override wins
  const name = (d.name || '').toLowerCase();
  if (/\b(ems|ambulance|paramedic)\b/.test(name)) return 'emt';
  if (/\b(fire|fd|hose|engine|truck co)\b/.test(name)) return 'fire';
  if (/\bdmv\b/.test(name)) return 'dmv';
  if (/\b(hospital|medical center|sinai|montefiore|good samaritan|langone)\b/.test(name)) return 'hospital';
  if (/\b(school district|csd|school board|board of education|superintendent)\b/.test(name)) return 'school';
  if (/\b(village of|town of|county legislature|mayor|trustee|council)\b/.test(name)) return 'elected';
  if (/\b(governor|senate|congress|white house|federal)\b/.test(name)) return 'federal';
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
    const approvedExtra = _readApproved().length;
    const moments = (s.total_reviews || 0) + approvedExtra;
    document.getElementById('statMoments').textContent      = moments.toLocaleString() + (moments >= 100 ? '+' : '');
    document.getElementById('statRecognized').textContent   = (recognizedCount + _readApproved().filter(a => a.payload.verdict === 'fair').length).toLocaleString();
    document.getElementById('statDepartments').textContent  = deptCount.toLocaleString();
    document.getElementById('statOfficers').textContent     = ((s.officer_count || 0) + approvedExtra).toLocaleString();
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
updateStreakChip();    // show streak in topbar if user has any engagement
_attachPulseSwipe();   // left/right swipe between cards on phone
_seedReactionsIfNeeded();  // seed plausible reaction counts on first load
_maybeFireDailyNotif();    // daily local push notification if >24h since last open
_initSoundToggle();        // wire reaction-sound toggle

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

// ─── PENDING / APPROVED REVIEW QUEUES (real moderation flow) ───
function _readPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } }
function _writePending(arr) { localStorage.setItem(PENDING_KEY, JSON.stringify(arr)); }
function _readApproved() { try { return JSON.parse(localStorage.getItem(APPROVED_KEY) || '[]'); } catch { return []; } }
function _writeApproved(arr) { localStorage.setItem(APPROVED_KEY, JSON.stringify(arr)); }

function _addToPendingQueue(payload) {
  const pending = _readPending();
  const user = getCurrentUser();
  pending.unshift({
    pending_id: 'p' + Date.now(),
    payload,
    author_handle: user?.handle || 'Anonymous',
    author_display: payload.reviewer_name || (user ? (user.anonymous ? user.handle : (user.displayName || user.handle)) : 'Anonymous'),
    submitted_at: new Date().toISOString(),
  });
  _writePending(pending);
}

// Approved user submissions get folded into the stories feed (alongside seed data).
// We return them as synthetic "officers" with one review each, so the existing render
// code Just Works without changes.
function getApprovedAsOfficers() {
  const approved = _readApproved();
  return approved.map((a, idx) => {
    const p = a.payload;
    const id = 1000000 + idx;  // synthetic ID — won't collide with seed
    return {
      id,
      name: p.officer_name || (p.role === 'police' ? 'Unknown Officer' : 'Unknown'),
      badge: p.officer_badge || null,
      department: p.department || 'Unknown agency',
      avg_stars: p.stars || 3,
      review_count: 1,
      fair_count: p.verdict === 'fair' ? 1 : 0,
      unfair_count: p.verdict === 'unfair' ? 1 : 0,
      reviews: [{
        id: 50000 + idx,
        verdict: p.verdict || 'fair',
        stars: p.stars || 3,
        story: p.story,
        location: p.location,
        ticket_amount: p.ticket_amount,
        ticket_violation: p.ticket_violation,
        upload_url: p.upload_url,
        evidence_type: p.evidence_type,
        tags: p.tags || [],
        author_display: a.author_display,
        author_handle: a.author_handle,
        created_at: a.approved_at || a.submitted_at,
      }],
    };
  });
}

// ─── MODERATION DASHBOARD (admin only — access via ?admin=1) ───
//
// What the admin sees here is a real moderation tool: compact pending list at the top,
// click-into-detail for every item showing the author's history, the officer's recent
// submission rate, and computed abuse signals.

// Aggregate the author's full activity (stories + sentiment + recent volume + trust)
function _adminAuthorActivity(handle) {
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const approved = getApprovedAsOfficers();
  const all = [...approved, ...officers];
  let total = 0, fair = 0, unfair = 0, recentCount = 0;
  const oneDayAgo = Date.now() - 86400000;
  const recent = [];
  for (const o of all) {
    for (const r of (o.reviews || [])) {
      const author = r.author_display || _legacyAuthor(o.id, r.id);
      if (author === handle) {
        total++;
        if (r.verdict === 'fair') fair++; else unfair++;
        if (new Date(r.created_at).getTime() > oneDayAgo) recentCount++;
        recent.push({ officer: o, review: r });
      }
    }
  }
  const pendingFromAuthor = _readPending().filter(p => p.author_display === handle);
  recent.sort((a, b) => new Date(b.review.created_at) - new Date(a.review.created_at));
  return {
    total, fair, unfair, recentCount,
    pendingCount: pendingFromAuthor.length,
    recent: recent.slice(0, 5),
    trust: computeTrustScore(handle),
  };
}

// How often this specific officer is mentioned in recent submissions (brigading detector)
function _adminOfficerRate(officerName, department) {
  const pending = _readPending();
  const approved = _readApproved();
  const oneDayAgo = Date.now() - 86400000;
  const oneWeekAgo = Date.now() - 604800000;
  let today = 0, week = 0;
  for (const a of [...pending, ...approved]) {
    const p = a.payload;
    const matchName = (p.officer_name || '').toLowerCase().trim() === (officerName || '').toLowerCase().trim();
    const matchDept = (p.department || '').toLowerCase().trim() === (department || '').toLowerCase().trim();
    if (matchName && matchDept) {
      const ts = new Date(a.submitted_at || a.approved_at || 0).getTime();
      if (ts > oneDayAgo) today++;
      if (ts > oneWeekAgo) week++;
    }
  }
  return { today, week };
}

// Compute abuse / quality signals to surface for the admin
function _adminAbuseSignals(payload, authorActivity, officerRate) {
  const sigs = [];
  if (authorActivity.trust.score < 30) {
    sigs.push({ level: 'warning', text: `Low trust score: <strong>${authorActivity.trust.score}/100</strong> (${authorActivity.trust.tier.label} contributor)` });
  }
  if (authorActivity.pendingCount >= 3) {
    sigs.push({ level: 'warning', text: `<strong>${authorActivity.pendingCount}</strong> pending submissions from this author — high volume` });
  }
  if (authorActivity.recentCount >= 5) {
    sigs.push({ level: 'alert', text: `<strong>${authorActivity.recentCount}</strong> stories from this author in the last 24h` });
  }
  if (officerRate.today >= 3) {
    sigs.push({ level: 'alert', text: `<strong>${officerRate.today}</strong> submissions about this person in 24h — possible brigading` });
  }
  if (officerRate.week >= 8) {
    sigs.push({ level: 'warning', text: `${officerRate.week} submissions about this person this week — unusual volume` });
  }
  if (!payload.story || payload.story.length < 30) {
    sigs.push({ level: 'info', text: 'Very short story — may lack context for readers' });
  }
  if (payload.story && /[A-Z\s!?]{15,}/.test(payload.story) && /[A-Z]{8,}/.test(payload.story)) {
    sigs.push({ level: 'info', text: 'Heavy uppercase — emotionally charged language' });
  }
  if (!payload.upload_url) {
    sigs.push({ level: 'info', text: 'No photo / evidence attached' });
  }
  if (authorActivity.total === 0) {
    sigs.push({ level: 'info', text: 'First-ever submission from this author' });
  }
  if (authorActivity.total >= 5) {
    const negPct = authorActivity.unfair / authorActivity.total;
    if (negPct >= 0.85) sigs.push({ level: 'warning', text: `<strong>${Math.round(negPct * 100)}%</strong> of their past stories are concerns — possible bias` });
  }
  if (sigs.length === 0) sigs.push({ level: 'good', text: 'No red flags. Submission looks clean.' });
  return sigs;
}

// ── ADMIN CONSOLE — multi-tab ──
// Tabs: Stories (mod) · Polls (mod) · Users · Engagement · Activity log · Notify list
let _adminTab = 'stories';
function setAdminTab(name) {
  _adminTab = name;
  document.querySelectorAll('#adminTabs .adm-tab').forEach(b => b.classList.toggle('on', b.dataset.atab === name));
  document.querySelectorAll('.adm-pane').forEach(p => p.style.display = 'none');
  const map = { stories:'admStories', polls:'admPolls', users:'admUsers', engagement:'admEngagement', activity:'admActivity', notify:'admNotify' };
  const el = document.getElementById(map[name]);
  if (el) el.style.display = 'block';
  // Render the active tab
  if (name === 'stories')    renderModQueue();
  if (name === 'polls')      renderAdmPolls();
  if (name === 'users')      renderAdmUsers();
  if (name === 'engagement') renderAdmEngagement();
  if (name === 'activity')   renderAdmActivity();
  if (name === 'notify')     renderAdmNotify();
  _refreshAdminBadges();
}
function _refreshAdminBadges() {
  const pending = _readPending();
  const pollsP = _readPendingPolls();
  const notifyL = JSON.parse(localStorage.getItem(NOTIFY_LIST_KEY) || '[]');
  const usersCount = _collectAllHandles().length;
  const $ = id => document.getElementById(id);
  if ($('admBadgeStories')) $('admBadgeStories').textContent = pending.length;
  if ($('admBadgePolls'))   $('admBadgePolls').textContent = pollsP.length;
  if ($('admBadgeUsers'))   $('admBadgeUsers').textContent = usersCount;
  if ($('admBadgeNotify'))  $('admBadgeNotify').textContent = notifyL.length;
}

// Collect every unique handle that's appeared in the system
function _collectAllHandles() {
  const handles = new Set();
  const seed = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  const approved = getApprovedAsOfficers();
  [...seed, ...approved, ...officerCache].forEach(o => (o.reviews || []).forEach(r => {
    const a = r.author_display || _legacyAuthor(o.id, r.id);
    if (a) handles.add(a);
  }));
  // Add anyone who voted on polls
  const bd = _readPollsBreakdown();
  Object.values(bd).forEach(byAffil => Object.keys(byAffil).forEach(a => {}));
  // Current user
  const u = getCurrentUser();
  if (u) handles.add(u.anonymous ? u.handle : (u.displayName || u.handle));
  return Array.from(handles);
}

// ── ADMIN: POLLS MODERATION ──
function renderAdmPolls() {
  const wrap = document.getElementById('admPollsList');
  if (!wrap) return;
  const pending = _readPendingPolls();
  const approved = _readApprovedPolls();
  if (!pending.length && !approved.length) {
    wrap.innerHTML = `<div style="text-align:center;color:var(--gray);padding:40px 20px;">No poll submissions yet.</div>`;
    return;
  }
  let html = '';
  if (pending.length) {
    html += `<h3 style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.05rem;font-weight:800;margin-bottom:12px;">Pending review (${pending.length})</h3>`;
    html += pending.map(p => `
      <div style="background:var(--card);border:1.5px solid rgba(184,148,30,0.42);border-radius:14px;padding:18px;margin-bottom:12px;">
        <div style="font-size:0.66rem;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent);font-weight:800;margin-bottom:6px;">${escapeHtml(p.cat)}</div>
        <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.1rem;font-weight:800;color:var(--ink);margin-bottom:10px;line-height:1.3;">${escapeHtml(p.q)}</div>
        <ul style="margin:0 0 14px 22px;color:var(--light);font-size:0.9rem;line-height:1.7;">
          ${p.options.map(o => `<li>${escapeHtml(o.label)}</li>`).join('')}
        </ul>
        <div style="font-size:0.78rem;color:var(--gray);margin-bottom:12px;">Submitted by <strong style="color:var(--ink);">${escapeHtml(p.submitted_by)}</strong> &middot; ${formatDate(p.submitted_at)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="ac-btn" onclick="admApprovePoll('${escapeHtml(p.id)}')">&#10003; Approve</button>
          <button class="btn-ghost" style="padding:11px 20px;border-radius:10px;" onclick="admRejectPoll('${escapeHtml(p.id)}')">&#10005; Reject</button>
        </div>
      </div>`).join('');
  }
  if (approved.length) {
    html += `<h3 style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.05rem;font-weight:800;margin:24px 0 12px;">Approved (${approved.length})</h3>`;
    html += approved.map(p => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;">
        <div style="font-size:0.66rem;text-transform:uppercase;letter-spacing:1.4px;color:var(--green);font-weight:800;margin-bottom:4px;">${escapeHtml(p.cat)} &middot; LIVE</div>
        <div style="font-size:0.94rem;font-weight:600;color:var(--ink);">${escapeHtml(p.q)}</div>
      </div>`).join('');
  }
  wrap.innerHTML = html;
}
function admApprovePoll(id) {
  const pending = _readPendingPolls();
  const idx = pending.findIndex(p => p.id === id);
  if (idx < 0) return;
  const poll = pending[idx];
  poll.status = 'approved';
  pending.splice(idx, 1);
  localStorage.setItem(POLLS_PENDING_KEY, JSON.stringify(pending));
  const approved = _readApprovedPolls();
  approved.unshift(poll);
  localStorage.setItem(POLLS_APPROVED_KEY, JSON.stringify(approved));
  renderAdmPolls();
  _refreshAdminBadges();
}
function admRejectPoll(id) {
  const pending = _readPendingPolls();
  const idx = pending.findIndex(p => p.id === id);
  if (idx < 0) return;
  pending.splice(idx, 1);
  localStorage.setItem(POLLS_PENDING_KEY, JSON.stringify(pending));
  renderAdmPolls();
  _refreshAdminBadges();
}

// ── ADMIN: USERS ──
function renderAdmUsers() {
  const wrap = document.getElementById('admUsersList');
  if (!wrap) return;
  const handles = _collectAllHandles();
  if (!handles.length) { wrap.innerHTML = `<div style="text-align:center;color:var(--gray);padding:40px 20px;">No users yet.</div>`; return; }
  const rows = handles.map(h => {
    const activity = _adminAuthorActivity ? _adminAuthorActivity(h) : { storiesTotal: 0, fair: 0, unfair: 0 };
    const trust = computeTrustScore(h);
    return { handle: h, storiesTotal: activity.storiesTotal || 0, fair: activity.fair || 0, unfair: activity.unfair || 0, trust: trust.score, tier: trust.tier.label };
  }).sort((a, b) => b.storiesTotal - a.storiesTotal);
  wrap.innerHTML = `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
      <thead><tr style="border-bottom:2px solid var(--border);">
        <th style="text-align:left;padding:10px 8px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Handle</th>
        <th style="text-align:right;padding:10px 8px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Stories</th>
        <th style="text-align:right;padding:10px 8px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">★</th>
        <th style="text-align:right;padding:10px 8px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">⚠</th>
        <th style="text-align:right;padding:10px 8px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Trust</th>
        <th style="text-align:left;padding:10px 8px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Tier</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="openAuthorProfile('${escapeHtml(r.handle).replace(/'/g,"\\'")}');">
            <td style="padding:10px 8px;font-weight:600;">${escapeHtml(r.handle)}</td>
            <td style="text-align:right;padding:10px 8px;">${r.storiesTotal}</td>
            <td style="text-align:right;padding:10px 8px;color:var(--green);">${r.fair}</td>
            <td style="text-align:right;padding:10px 8px;color:var(--red);">${r.unfair}</td>
            <td style="text-align:right;padding:10px 8px;font-weight:800;">${r.trust}</td>
            <td style="padding:10px 8px;font-size:0.78rem;color:var(--gray);">${escapeHtml(r.tier)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div style="font-size:0.78rem;color:var(--gray);margin-top:12px;text-align:right;">${rows.length} users &middot; tap a row to see their full profile</div>
  `;
}

// ── ADMIN: ENGAGEMENT DASHBOARD ──
function renderAdmEngagement() {
  const wrap = document.getElementById('admEngagementBody');
  if (!wrap) return;
  const handles = _collectAllHandles();
  const pollVotes = _readPollsVotes();
  const totalVotes = Object.values(pollVotes).reduce((s, m) => s + Object.values(m).reduce((a, b) => a + b, 0), 0);
  const totalPolls = POLLS_SEED.length + _readApprovedPolls().length;
  const seed = (window.STATIC_DATA && window.STATIC_DATA.officers) || [];
  const approved = getApprovedAsOfficers();
  const totalStories = [...seed, ...approved].reduce((s, o) => s + (o.reviews || []).length, 0);
  const pendingStories = _readPending().length;
  const pendingPolls = _readPendingPolls().length;
  const notifyList = JSON.parse(localStorage.getItem(NOTIFY_LIST_KEY) || '[]');
  const streak = _readStreak();
  // Hot stories — top 5 by reaction count (currently tracked locally via dataset.count on buttons; rough proxy: review_count for now)
  const allStories = [];
  for (const o of [...seed, ...approved]) {
    for (const r of (o.reviews || [])) allStories.push({ o, r, score: (r.stars || 0) * 10 });
  }
  allStories.sort((a, b) => b.score - a.score);
  const hot = allStories.slice(0, 5);

  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
      ${_admStatCard('Users', handles.length, '👥')}
      ${_admStatCard('Stories', totalStories, '📚')}
      ${_admStatCard('Polls', totalPolls, '🗳️')}
      ${_admStatCard('Votes cast', totalVotes, '✅')}
      ${_admStatCard('Pending stories', pendingStories, '⏳', pendingStories ? 'var(--accent)' : null)}
      ${_admStatCard('Pending polls', pendingPolls, '⏳', pendingPolls ? 'var(--accent)' : null)}
      ${_admStatCard('Notify-me signups', notifyList.length, '📩')}
      ${_admStatCard('Your engagement', streak.total || 0, '🔥')}
    </div>
    <h3 style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.05rem;font-weight:800;margin-bottom:12px;">Hot stories</h3>
    ${hot.map(({ o, r }) => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:pointer;" onclick="openStoryDetail(${o.id}, ${r.id})">
        <div style="font-weight:700;color:var(--ink);font-size:0.94rem;">${escapeHtml(o.name)} &middot; ${escapeHtml(o.department || '')}</div>
        <div style="font-size:0.82rem;color:var(--gray);margin-top:3px;">${escapeHtml((r.story || '').slice(0, 110))}${(r.story || '').length > 110 ? '…' : ''}</div>
      </div>`).join('')}
  `;
}
function _admStatCard(label, value, icon, color) {
  return `<div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:16px 14px;text-align:center;">
    <div style="font-size:1.5rem;margin-bottom:4px;">${icon}</div>
    <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.6rem;font-weight:800;color:${color || 'var(--ink)'};">${value.toLocaleString()}</div>
    <div style="font-size:0.7rem;color:var(--gray);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:3px;">${label}</div>
  </div>`;
}

// ── ADMIN: ACTIVITY LOG ──
function renderAdmActivity() {
  const wrap = document.getElementById('admActivityList');
  if (!wrap) return;
  const events = [];
  // Stories — pending + approved + seed
  _readPending().forEach(p => events.push({ ts: p.submitted_at || p.created_at, kind: 'story', label: `Story submitted by ${p.reviewer_name || 'Anonymous'} on ${p.dept || 'unknown'}`, color: 'var(--accent)' }));
  _readApproved().forEach(a => events.push({ ts: a.approved_at || a.created_at || new Date().toISOString(), kind: 'story-approved', label: `Story approved on ${a.dept || a.officer_name || 'unknown'}`, color: 'var(--green)' }));
  _readPendingPolls().forEach(p => events.push({ ts: p.submitted_at, kind: 'poll', label: `Poll submitted: "${(p.q || '').slice(0, 60)}…"`, color: 'var(--accent)' }));
  _readApprovedPolls().forEach(p => events.push({ ts: p.submitted_at, kind: 'poll-approved', label: `Poll approved: "${(p.q || '').slice(0, 60)}…"`, color: 'var(--green)' }));
  const notifyList = JSON.parse(localStorage.getItem(NOTIFY_LIST_KEY) || '[]');
  notifyList.forEach(n => events.push({ ts: n.ts, kind: 'notify', label: `Notify-me signup: ${n.email} → "${n.topic}"`, color: 'var(--blue)' }));
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (!events.length) { wrap.innerHTML = `<div style="text-align:center;color:var(--gray);padding:40px 20px;">No activity recorded yet.</div>`; return; }
  wrap.innerHTML = events.slice(0, 200).map(e => `
    <div style="display:flex;gap:14px;padding:10px 14px;border-left:3px solid ${e.color};background:var(--bg2);border-radius:0 8px 8px 0;margin-bottom:6px;align-items:flex-start;">
      <span style="font-size:0.74rem;color:var(--gray);min-width:90px;flex-shrink:0;">${formatDate(e.ts)}</span>
      <span style="font-size:0.88rem;color:var(--ink);line-height:1.4;">${escapeHtml(e.label)}</span>
    </div>
  `).join('');
}

// ── ADMIN: NOTIFY-ME LIST ──
function renderAdmNotify() {
  const wrap = document.getElementById('admNotifyList');
  if (!wrap) return;
  const list = JSON.parse(localStorage.getItem(NOTIFY_LIST_KEY) || '[]');
  if (!list.length) { wrap.innerHTML = `<div style="text-align:center;color:var(--gray);padding:40px 20px;">No notify-me signups yet.</div>`; return; }
  const grouped = {};
  list.forEach(n => { grouped[n.topic] = grouped[n.topic] || []; grouped[n.topic].push(n); });
  wrap.innerHTML = Object.entries(grouped).map(([topic, items]) => `
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;">
      <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-weight:800;color:var(--ink);font-size:0.98rem;margin-bottom:8px;">${escapeHtml(topic)} <span style="color:var(--gray);font-weight:600;font-size:0.85rem;">(${items.length})</span></div>
      ${items.map(i => `<div style="font-size:0.85rem;color:var(--light);padding:4px 0;border-top:1px solid var(--border);">${escapeHtml(i.email)} <span style="color:var(--gray);font-size:0.75rem;margin-left:8px;">${formatDate(i.ts)}</span></div>`).join('')}
    </div>
  `).join('');
}

function renderModQueue() {
  const wrap = document.getElementById('modQueueList');
  if (!wrap) return;
  const pending = _readPending();
  const approved = _readApproved();

  if (!pending.length && !approved.length) {
    wrap.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:30px;text-align:center;color:var(--gray);">
        <div style="font-size:2rem;margin-bottom:10px;">&#128226;</div>
        <div style="font-size:0.95rem;color:var(--ink);font-weight:600;margin-bottom:6px;">Queue is empty</div>
        <div style="font-size:0.86rem;line-height:1.55;">Once someone submits a story through the <button onclick="nav('share')" style="background:none;border:none;color:var(--accent);cursor:pointer;text-decoration:underline;">Share form</button>, it'll show up here for your approval.</div>
      </div>
    `;
    return;
  }

  let html = '';

  // Compact pending list
  if (pending.length) {
    html += `<div class="adm-section-head">⏳ Pending review · <strong>${pending.length}</strong></div>`;
    html += `<div class="adm-list">`;
    html += pending.map(p => {
      const r = p.payload;
      const activity = _adminAuthorActivity(p.author_display);
      const officerRate = _adminOfficerRate(r.officer_name, r.department);
      const sigs = _adminAbuseSignals(r, activity, officerRate);
      const warnCount = sigs.filter(s => s.level === 'alert' || s.level === 'warning').length;
      return `
        <div class="adm-row" onclick="openAdminReview('${p.pending_id}')">
          <div class="adm-row-main">
            <div class="adm-row-headline">
              <span class="adm-role">${ROLE_ICON[r.role] || '👤'}</span>
              <span class="adm-target">${escapeHtml(r.officer_name || 'Unknown')}</span>
              <span class="adm-target-sub">· ${escapeHtml(r.department || 'Unknown')}</span>
              <span class="adm-sent ${r.verdict === 'fair' ? 'pos' : 'neg'}">${r.verdict === 'fair' ? '★' : '⚠'}</span>
              ${r.upload_url ? '<span class="adm-evidence" title="Has photo evidence">📎</span>' : ''}
            </div>
            <div class="adm-row-author">
              <strong>${escapeHtml(p.author_display)}</strong>
              · trust <span style="color:${activity.trust.tier.color};font-weight:700;">${activity.trust.score}</span>
              · ${activity.total} prior · ${formatDate(p.submitted_at)}
            </div>
            <div class="adm-row-preview">${escapeHtml((r.story || '(no description)').slice(0, 140))}${(r.story || '').length > 140 ? '…' : ''}</div>
          </div>
          <div class="adm-row-side">
            ${warnCount > 0 ? `<span class="adm-warn" title="${warnCount} signal(s) to review">🚨 ${warnCount}</span>` : '<span class="adm-clean" title="No red flags">✓</span>'}
            <button class="adm-quick adm-approve" onclick="event.stopPropagation(); approvePending('${p.pending_id}')" title="Approve as-is">✓</button>
            <button class="adm-quick adm-reject" onclick="event.stopPropagation(); rejectPending('${p.pending_id}')" title="Reject">✕</button>
          </div>
        </div>
      `;
    }).join('');
    html += `</div>`;
  }

  // Approved log (collapsed list)
  if (approved.length) {
    html += `<div class="adm-section-head" style="margin-top:28px;color:var(--green);">✓ Published · <strong>${approved.length}</strong></div>`;
    html += `<div class="adm-published">`;
    html += approved.slice(0, 20).map(a => {
      const r = a.payload;
      return `
        <div class="adm-pub-row">
          <span class="adm-role">${ROLE_ICON[r.role] || '👤'}</span>
          <strong>${escapeHtml(r.officer_name || 'Unknown')}</strong>
          <span style="color:var(--gray);">· ${escapeHtml(r.department || '')}</span>
          <span class="adm-pub-when">approved ${formatDate(a.approved_at)}</span>
        </div>
      `;
    }).join('');
    html += `</div>`;
  }

  wrap.innerHTML = html;
}

// ── ADMIN DETAIL MODAL — full review with author history + signals + edit ──
function openAdminReview(pendingId) {
  const pending = _readPending();
  const item = pending.find(p => p.pending_id === pendingId);
  if (!item) return;
  const p = item.payload;
  const activity = _adminAuthorActivity(item.author_display);
  const officerRate = _adminOfficerRate(p.officer_name, p.department);
  const signals = _adminAbuseSignals(p, activity, officerRate);

  const body = document.getElementById('storyDetailBody');
  body.innerHTML = `
    <div class="sd-eyebrow" style="color:var(--red);">🛡️ ADMIN REVIEW</div>
    <h3 style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.5rem;font-weight:800;letter-spacing:-0.4px;color:var(--ink);margin-bottom:6px;">Pending submission</h3>
    <div style="color:var(--gray);font-size:0.86rem;margin-bottom:18px;">Submitted ${formatDate(item.submitted_at)} · ID <code style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:0.78rem;background:var(--bg2);padding:2px 6px;border-radius:4px;">${item.pending_id}</code></div>

    <!-- Abuse / quality signals -->
    <div class="adm-signals">
      <div class="adm-block-head">Signals</div>
      ${signals.map(s => `<div class="adm-signal ${s.level}">${s.text}</div>`).join('')}
    </div>

    <!-- Author panel -->
    <div class="adm-block">
      <div class="adm-block-head">Contributor: <strong style="color:var(--ink);">${escapeHtml(item.author_display)}</strong></div>
      <div class="adm-stats-grid">
        <div><span class="adm-stat-n" style="color:${activity.trust.tier.color};">${activity.trust.score}</span><span class="adm-stat-l">Trust score</span></div>
        <div><span class="adm-stat-n">${activity.total}</span><span class="adm-stat-l">Past stories</span></div>
        <div><span class="adm-stat-n" style="color:var(--green);">${activity.fair}</span><span class="adm-stat-l">Recognitions</span></div>
        <div><span class="adm-stat-n" style="color:var(--red);">${activity.unfair}</span><span class="adm-stat-l">Concerns</span></div>
        <div><span class="adm-stat-n" style="color:var(--accent);">${activity.pendingCount}</span><span class="adm-stat-l">Pending now</span></div>
        <div><span class="adm-stat-n" style="color:${activity.recentCount >= 5 ? 'var(--red)' : 'var(--ink)'};">${activity.recentCount}</span><span class="adm-stat-l">Last 24h</span></div>
      </div>
      ${activity.recent.length ? `
        <div class="adm-block-sub">Recent stories from this contributor</div>
        <div class="adm-history">
          ${activity.recent.map(it => `
            <div class="adm-history-row" onclick="closeStoryDetail(); openStoryDetail(${it.officer.id}, ${it.review.id});">
              <span class="adm-role">${ROLE_ICON[inferRole(it.officer)] || '👤'}</span>
              <strong>${escapeHtml(it.officer.name || 'Unknown')}</strong>
              <span style="color:var(--gray);">${escapeHtml(it.officer.department || '')}</span>
              <span class="adm-sent ${it.review.verdict === 'fair' ? 'pos' : 'neg'}">${it.review.verdict === 'fair' ? '★' : '⚠'}</span>
              <span style="color:var(--gray);margin-left:auto;">${formatDate(it.review.created_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<div class="adm-block-sub">No prior stories — this is their first submission.</div>'}
    </div>

    <!-- Officer / target activity -->
    <div class="adm-block">
      <div class="adm-block-head">Target: <strong style="color:var(--ink);">${escapeHtml(p.officer_name || 'Unknown')}</strong> · ${escapeHtml(p.department || 'Unknown agency')}</div>
      <div class="adm-stats-grid" style="grid-template-columns:repeat(2,1fr);">
        <div><span class="adm-stat-n" style="color:${officerRate.today >= 3 ? 'var(--red)' : 'var(--ink)'};">${officerRate.today}</span><span class="adm-stat-l">Submissions today</span></div>
        <div><span class="adm-stat-n" style="color:${officerRate.week >= 8 ? 'var(--red)' : 'var(--ink)'};">${officerRate.week}</span><span class="adm-stat-l">This week</span></div>
      </div>
      ${officerRate.today >= 3 ? '<div class="adm-signal alert" style="margin-top:10px;">⚠ This target has been reported ' + officerRate.today + ' times today. Verify before approving.</div>' : ''}
    </div>

    <!-- Submission content — editable -->
    <div class="adm-block">
      <div class="adm-block-head">Submission content (editable before approval)</div>
      <label class="adm-field-label">Story</label>
      <textarea id="adm-edit-story" rows="6">${escapeHtml(p.story || '')}</textarea>
      <div class="adm-row-fields">
        <div>
          <label class="adm-field-label">Role</label>
          <select id="adm-edit-role">
            ${['police','emt','fire','dmv','hospital','gov','other'].map(role => `<option value="${role}" ${p.role === role ? 'selected' : ''}>${role}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="adm-field-label">Verdict</label>
          <select id="adm-edit-verdict">
            <option value="fair" ${p.verdict === 'fair' ? 'selected' : ''}>Recognition (★)</option>
            <option value="unfair" ${p.verdict === 'unfair' ? 'selected' : ''}>Concern (⚠)</option>
          </select>
        </div>
        <div>
          <label class="adm-field-label">Stars (1–5)</label>
          <input id="adm-edit-stars" type="number" min="1" max="5" value="${p.stars || 3}">
        </div>
      </div>
      <label class="adm-field-label">Tags (comma-separated)</label>
      <input id="adm-edit-tags" type="text" value="${(p.tags || []).join(', ')}">

      ${p.upload_url ? `
        <div class="adm-block-sub">📎 Photo evidence (${escapeHtml(p.evidence_type || 'photo')})</div>
        <div class="adm-photo-frame">
          <div style="font-size:2.6rem;margin-bottom:8px;">📷</div>
          <div style="font-weight:700;color:var(--ink);">${escapeHtml(p.evidence_type || 'Photo')} attached</div>
          <div style="font-size:0.78rem;color:var(--gray);margin-top:4px;">File: <code style="font-family:'JetBrains Mono',ui-monospace,monospace;background:var(--bg2);padding:2px 6px;border-radius:4px;">${escapeHtml(p.upload_url)}</code></div>
          <div style="font-size:0.78rem;color:var(--gray);margin-top:6px;line-height:1.5;">Admin view: in production this would render the <strong>un-redacted original</strong> for moderation review. The user only sees the redacted version they applied before upload.</div>
        </div>
      ` : '<div class="adm-block-sub">No photo / evidence attached.</div>'}
    </div>

    <!-- Action bar -->
    <div class="adm-action-bar">
      <button class="adm-btn adm-btn-approve" onclick="adminApproveWithEdits('${pendingId}')">✓ Approve &amp; publish (with my edits)</button>
      <button class="adm-btn adm-btn-reject" onclick="rejectPending('${pendingId}'); closeStoryDetail();">✕ Reject</button>
      <button class="adm-btn adm-btn-ban" onclick="adminBanAuthor('${escapeHtml(item.author_display).replace(/'/g, "\\'")}'); closeStoryDetail();">⛔ Ban author</button>
    </div>
  `;
  document.getElementById('storyDetailModal').classList.add('show');
}

// Approve with the admin's edits applied
function adminApproveWithEdits(pendingId) {
  const pending = _readPending();
  const idx = pending.findIndex(p => p.pending_id === pendingId);
  if (idx === -1) return;
  const item = pending[idx];
  // Pull edited values from the modal
  item.payload.story = document.getElementById('adm-edit-story')?.value || item.payload.story;
  item.payload.role  = document.getElementById('adm-edit-role')?.value  || item.payload.role;
  item.payload.verdict = document.getElementById('adm-edit-verdict')?.value || item.payload.verdict;
  item.payload.stars = parseInt(document.getElementById('adm-edit-stars')?.value || item.payload.stars, 10) || item.payload.stars;
  const tagsStr = document.getElementById('adm-edit-tags')?.value || '';
  item.payload.tags = tagsStr.split(',').map(s => s.trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
  item.approved_at = new Date().toISOString();
  // Move to approved
  const approved = _readApproved();
  approved.unshift(item);
  _writeApproved(approved);
  pending.splice(idx, 1);
  _writePending(pending);
  closeStoryDetail();
  renderModQueue();
  loadOfficers();
  loadStats();
}

// Soft ban — record handle in localStorage, future submissions from them go to a separate "auto-rejected" lane
function adminBanAuthor(handle) {
  if (!confirm(`Ban ${handle}? Future submissions from this handle will be auto-rejected. (Demo: stored locally.)`)) return;
  const BAN_KEY = 'civicvoice_banned_v1';
  let banned = [];
  try { banned = JSON.parse(localStorage.getItem(BAN_KEY) || '[]'); } catch {}
  if (!banned.includes(handle)) banned.push(handle);
  localStorage.setItem(BAN_KEY, JSON.stringify(banned));
  // Also reject all their pending stories
  const pending = _readPending().filter(p => p.author_display !== handle);
  _writePending(pending);
  renderModQueue();
}
function approvePending(pendingId) {
  const pending = _readPending();
  const idx = pending.findIndex(p => p.pending_id === pendingId);
  if (idx === -1) return;
  const item = pending[idx];
  item.approved_at = new Date().toISOString();
  // Move to approved
  const approved = _readApproved();
  approved.unshift(item);
  _writeApproved(approved);
  // Remove from pending
  pending.splice(idx, 1);
  _writePending(pending);
  // Refresh views
  renderModQueue();
  loadOfficers();
  loadStats();
  // Visual feedback
  alert('✓ Approved and published. Check the Stories tab — it\'s live now.');
}
function rejectPending(pendingId) {
  if (!confirm('Reject this story? It will be removed from the queue.')) return;
  const pending = _readPending().filter(p => p.pending_id !== pendingId);
  _writePending(pending);
  renderModQueue();
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
  if (!cur) {
    // Compute the next Sunday so the message is concrete
    const now = new Date();
    const daysUntilSun = (7 - now.getDay()) % 7 || 7;
    const next = new Date(now); next.setDate(now.getDate() + daysUntilSun);
    const when = next.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
    _showStreakToast(`✓ Weekly digest on. Next one: ${when} morning.`);
  } else {
    _showStreakToast('Weekly digest off.');
  }
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
  rows.forEach((row, i) => row._rank = i + 1);
  rows = rows.slice(0, 40);

  wrap.innerHTML = `
    <div class="rank-row head">
      <div class="rank-pos head">#</div>
      <div>DEPARTMENT</div>
      <div>AVG RATING</div>
      <div class="rk-stories">STORIES</div>
    </div>
    ${rows.map(d => `
      <div class="rank-row" style="cursor:pointer;" onclick="openDepartmentDetail('${escapeHtml(d.name).replace(/'/g, "\\'")}');">
        <div class="rank-pos">${d._rank.toString().padStart(2, '0')}</div>
        <div>
          <div class="rank-name">${escapeHtml(d.name)}</div>
          <div class="rank-name-sub">${d.officer_count} ${d.officer_count === 1 ? 'person' : 'people'} · tap to view</div>
        </div>
        <div class="rank-stars">${'★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg))} <span style="color:var(--gray);font-size:0.78rem;margin-left:4px;">${d.avg.toFixed(1)}</span></div>
        <div class="rank-num rk-stories">${d.review_count}</div>
      </div>
    `).join('')}
  `;
}

// Click a department row → modal with all officers + recent stories from that department
function openDepartmentDetail(deptName) {
  const officers = (window.STATIC_DATA && window.STATIC_DATA.officers) || officerCache || [];
  const approved = getApprovedAsOfficers();
  const matches = [...approved, ...officers].filter(o => o.department === deptName);
  if (!matches.length) return;

  const totalReviews = matches.reduce((s, o) => s + (o.review_count || 0), 0);
  const fair = matches.reduce((s, o) => s + (o.fair_count || 0), 0);
  const unfair = matches.reduce((s, o) => s + (o.unfair_count || 0), 0);
  const avgStars = totalReviews ? matches.reduce((s, o) => s + (o.avg_stars || 0) * (o.review_count || 0), 0) / totalReviews : 0;

  // Latest stories from this dept
  const allStories = [];
  for (const o of matches) {
    for (const r of (o.reviews || [])) {
      allStories.push({ officer: o, review: r });
    }
  }
  allStories.sort((a, b) => new Date(b.review.created_at || 0) - new Date(a.review.created_at || 0));
  const recentStories = allStories.slice(0, 10);

  const resStats = computeAgencyResolutionStats(deptName);
  const body = document.getElementById('storyDetailBody');
  body.innerHTML = `
    <div class="sd-eyebrow">Department record</div>
    <div class="sd-head">
      <div class="sd-icon">&#127970;</div>
      <div class="sd-who">
        <div class="sd-name" style="cursor:default;">${escapeHtml(deptName)}</div>
        <div class="sd-agency">${matches.length} ${matches.length === 1 ? 'person' : 'people'} on record · ${totalReviews} stor${totalReviews === 1 ? 'y' : 'ies'}</div>
        <div class="sd-sent">
          <span class="sd-stars">${'★'.repeat(Math.round(avgStars)) + '☆'.repeat(5 - Math.round(avgStars))}</span>
          <span class="sd-tag pos">${fair} ★</span>
          <span class="sd-tag neg">${unfair} ⚠</span>
          <span class="sd-stars" style="color:var(--gray);font-size:0.85rem;">${avgStars.toFixed(1)} avg</span>
        </div>
      </div>
    </div>

    <!-- Resolution stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:24px;">
      <div style="background:rgba(31,140,95,0.06);border:1px solid rgba(31,140,95,0.32);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.6rem;font-weight:800;color:var(--green);">${resStats.responseRate}%</div>
        <div style="font-size:0.74rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Response rate</div>
      </div>
      <div style="background:rgba(184,148,30,0.06);border:1px solid rgba(184,148,30,0.3);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.6rem;font-weight:800;color:var(--accent);">${resStats.open}</div>
        <div style="font-size:0.74rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Open</div>
      </div>
      <div style="background:rgba(37,109,217,0.06);border:1px solid rgba(37,109,217,0.32);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.6rem;font-weight:800;color:var(--blue);">${resStats.acknowledged}</div>
        <div style="font-size:0.74rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Acknowledged</div>
      </div>
      <div style="background:rgba(31,140,95,0.06);border:1px solid rgba(31,140,95,0.32);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:1.6rem;font-weight:800;color:var(--green);">${resStats.resolved}</div>
        <div style="font-size:0.74rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Resolved</div>
      </div>
    </div>

    <h4 style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:0.95rem;font-weight:800;margin-bottom:12px;">People (${matches.length})</h4>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
      ${matches.slice(0, 12).map(o => {
        const role = inferRole(o);
        return `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;" onclick="closeStoryDetail(); openOfficer(${o.id});">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <span style="font-size:1.2rem;">${ROLE_ICON[role] || '👤'}</span>
              <span style="font-weight:600;font-size:0.92rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.name || 'Unknown')}</span>
            </div>
            <div style="display:flex;gap:10px;font-size:0.8rem;align-items:center;">
              <span style="color:var(--accent);">${'★'.repeat(Math.round(o.avg_stars || 0))}</span>
              <span style="color:var(--gray);">${o.review_count} stor${o.review_count === 1 ? 'y' : 'ies'}</span>
            </div>
          </div>
        `;
      }).join('')}
      ${matches.length > 12 ? `<div style="font-size:0.82rem;color:var(--gray);text-align:center;padding:6px;">+ ${matches.length - 12} more</div>` : ''}
    </div>

    <h4 style="font-family:'Bricolage Grotesque','Syne',sans-serif;font-size:0.95rem;font-weight:800;margin-bottom:12px;">Latest stories</h4>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${recentStories.map(it => {
        const o = it.officer;
        const r = it.review;
        const isPos = r.verdict === 'fair';
        return `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;" onclick="closeStoryDetail(); openStoryDetail(${o.id}, ${r.id});">
            <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">
              <strong style="font-size:0.88rem;color:var(--ink);">${escapeHtml(o.name || 'Unknown')}</strong>
              <span style="font-size:0.7rem;color:${isPos ? 'var(--green)' : 'var(--red)'};font-weight:700;">${isPos ? '★ Recognition' : '⚠ Concern'}</span>
            </div>
            <div style="font-size:0.88rem;color:var(--light);line-height:1.55;">${escapeHtml((r.story || '').slice(0, 160))}${(r.story || '').length > 160 ? '…' : ''}</div>
            <div style="font-size:0.72rem;color:var(--gray);margin-top:4px;">${formatDate(r.created_at)}</div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="sd-foot" style="margin-top:18px;">
      <button class="sp-action primary" onclick="closeStoryDetail(); nav('complaint');">&#9993;&#65039; Reach out to this agency</button>
    </div>
  `;
  document.getElementById('storyDetailModal').classList.add('show');
}

// Show the demo badge if running without a backend
if (window.api && window.api.isStatic && window.api.isStatic()) {
  const badge = document.getElementById('demoBadge');
  if (badge) badge.classList.add('show');
}

// ── ENGAGEMENT STREAK ──
// Counts unique stories/polls you engaged with today, this week, all-time.
// Shown as a small flame chip in the topbar. Tap → modal with breakdown.
// Civic encouragement, not dopamine — we're tracking "voices heard", not "swipes."
const STREAK_KEY = 'civicvoice_streak_v1';
function _readStreak() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY) || '{"days":{}, "total":0}'); }
  catch { return { days:{}, total:0 }; }
}
function _todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function recordEngagement(kind) {
  // kind: 'story-view' | 'poll-vote' | 'react' | 'share'
  const s = _readStreak();
  const day = _todayKey();
  s.days[day] = s.days[day] || { story:0, poll:0, react:0, share:0 };
  if (kind === 'story-view') s.days[day].story++;
  if (kind === 'poll-vote')  s.days[day].poll++;
  if (kind === 'react')      s.days[day].react++;
  if (kind === 'share')      s.days[day].share++;
  s.total = (s.total || 0) + 1;
  // Prune older than 30 days to keep localStorage small
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  Object.keys(s.days).forEach(k => { if (new Date(k) < cutoff) delete s.days[k]; });
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  updateStreakChip();
}
// Count distinct days with any engagement — never resets, only goes up. Civic consistency.
function _activeDays() {
  const s = _readStreak();
  return Object.keys(s.days || {}).filter(k => {
    const v = s.days[k] || {};
    return ((v.story || 0) + (v.poll || 0) + (v.react || 0) + (v.share || 0)) > 0;
  }).length;
}
function _streakCounts() {
  const s = _readStreak();
  const today = s.days[_todayKey()] || {};
  const todayTotal = (today.story || 0) + (today.poll || 0) + (today.react || 0) + (today.share || 0);
  const weekCutoff = new Date(); weekCutoff.setDate(weekCutoff.getDate() - 7);
  let weekTotal = 0;
  Object.entries(s.days).forEach(([k, v]) => {
    if (new Date(k) >= weekCutoff) {
      weekTotal += (v.story || 0) + (v.poll || 0) + (v.react || 0) + (v.share || 0);
    }
  });
  return { today: todayTotal, week: weekTotal, all: s.total || 0 };
}
function updateStreakChip() {
  const c = _streakCounts();
  const days = _activeDays();
  const chip = document.getElementById('streakChip');
  const num = document.getElementById('streakNum');
  const flame = chip ? chip.querySelector('.streak-flame') : null;
  if (!chip || !num) return;
  if (c.today > 0) {
    // Active right now — fire + today's count
    chip.style.display = 'inline-flex';
    chip.style.opacity = '1';
    if (flame) flame.textContent = '🔥';
    num.textContent = c.today;
    chip.title = `${c.today} today · ${days} days on the record`;
  } else if (days >= 3) {
    // Quiet day but consistent overall — civic star + total active days (no panic, no streak break)
    chip.style.display = 'inline-flex';
    chip.style.opacity = '0.9';
    if (flame) flame.textContent = '✨';
    num.textContent = days;
    chip.title = `${days} days on the record — communities run on this kind of attention`;
  } else if (c.all > 0) {
    chip.style.display = 'inline-flex';
    chip.style.opacity = '0.65';
    if (flame) flame.textContent = '🔥';
    num.textContent = c.all;
  } else {
    chip.style.display = 'none';
  }
  _refreshConsistencyBanner();
}
function openStreakModal() {
  const c = _streakCounts();
  const days = _activeDays();
  document.getElementById('streakToday').textContent = c.today;
  document.getElementById('streakWeek').textContent = c.week;
  document.getElementById('streakAll').textContent = c.all;
  document.getElementById('streakDays').textContent = days;
  const msg = c.today === 0
    ? "You haven't engaged today yet. Read a story, vote on a poll, or share something that matters."
    : c.today < 3
    ? "Good start. Every voice you hear is part of the public record."
    : c.today < 10
    ? "You're paying attention. That's how communities actually change."
    : "You're deep in it. The kind of civic attention most people skip.";
  document.getElementById('streakMessage').textContent = msg;
  // Consistency message — civic framing, only appears once they've shown up 3+ days
  const consistencyEl = document.getElementById('streakConsistency');
  if (consistencyEl) {
    if (days < 3) {
      consistencyEl.textContent = '';
    } else if (days < 7) {
      consistencyEl.textContent = `You've shown up ${days} days. Communities run on this kind of quiet attention.`;
    } else if (days < 30) {
      consistencyEl.textContent = `${days} days on the record. You're more consistent than 90% of people who'll ever see this site.`;
    } else {
      consistencyEl.textContent = `${days} days on the record. Year-shaping consistency. The civic backbone.`;
    }
  }
  document.getElementById('streakOverlay').classList.add('show');
}
function closeStreakModal() {
  document.getElementById('streakOverlay').classList.remove('show');
}

// Home page consistency banner — hidden until user hits 3+ active days. No panic, just recognition.
function _refreshConsistencyBanner() {
  const banner = document.getElementById('consistencyBanner');
  if (!banner) return;
  const days = _activeDays();
  if (days < 3) { banner.style.display = 'none'; return; }
  const daysEl = document.getElementById('cbDays');
  const msgEl  = document.getElementById('cbMsg');
  if (daysEl) daysEl.textContent = days;
  if (msgEl) {
    msgEl.textContent = days < 7
      ? "That's the kind of attention communities run on."
      : days < 30
      ? "You're more consistent than 90% of people who'll ever see this site."
      : "Year-shaping consistency. The civic backbone.";
  }
  banner.style.display = 'flex';
}

// ── POLLS & TAKES ──
// Local civic questions. Users self-ID, vote, see live breakdowns by affiliation.
// Gallup × Polymarket without money — civic, free, anonymous.
const POLLS_VOTES_KEY = 'civicvoice_polls_votes_v1';
const POLLS_MY_KEY    = 'civicvoice_polls_my_v1';
const POLLS_BREAKDOWN_KEY = 'civicvoice_polls_breakdown_v1';
const POLLS_AFFIL_KEY = 'civicvoice_polls_affil_v1';

const POLLS_SEED = [
  { id:'p1', cat:'LOCAL — EAST RAMAPO', q:'Should East Ramapo CSD reverse the November busing change for special-ed routes?',
    options:[{id:'yes',label:'Yes, reverse it'},{id:'no',label:'No, keep it'},{id:'unsure',label:'I need more info'}], closes:'Open' },
  { id:'p2', cat:'LOCAL — SPRING VALLEY', q:'Has Mayor Simon actually fixed the Skylark Drive flooding within the 60-day promise?',
    options:[{id:'yes',label:'Yes, fixed'},{id:'partial',label:'Partial — still water issues'},{id:'no',label:'No, nothing changed'}], closes:'Open' },
  { id:'p3', cat:'LOCAL — RAMAPO', q:'Should the Town of Ramapo approve the Route 59 development?',
    options:[{id:'yes',label:'Yes'},{id:'no',label:'No'},{id:'with-changes',label:'Only with major changes'}], closes:'Open' },
  { id:'p4', cat:'NEW YORK STATE', q:'Is Gov. Hochul handling NYC migrant funding the right way?',
    options:[{id:'yes',label:'Yes'},{id:'no',label:'No'},{id:'mixed',label:'Mixed — some yes, some no'}], closes:'Open' },
  { id:'p5', cat:'NEW YORK STATE', q:'Should the NY State Legislature pass tougher bail-reform rollback this session?',
    options:[{id:'yes',label:'Yes, roll back'},{id:'no',label:'No, leave it'},{id:'tweak',label:'Tweak it, don\'t roll back'}], closes:'Open' },
  { id:'p6', cat:'FEDERAL — PREDICTION', q:'Will Congress pass a federal budget without a shutdown this cycle?',
    options:[{id:'yes',label:'Yes, on time'},{id:'no',label:'No, shutdown'},{id:'last-minute',label:'Yes — but only at the last minute'}], closes:'Open' },
  { id:'p7', cat:'FEDERAL — POLICY', q:'Should the federal government take direct action on the southern border before year-end?',
    options:[{id:'yes',label:'Yes, urgent'},{id:'no',label:'No, current is fine'},{id:'state',label:'It\'s a state-level issue'}], closes:'Open' },
  { id:'p8', cat:'EDUCATION', q:'Should school board members be required to publicly justify every "no" vote on parent-submitted measures?',
    options:[{id:'yes',label:'Yes'},{id:'no',label:'No'},{id:'sometimes',label:'Only on contentious votes'}], closes:'Open' },
];

function _readPollsVotes()     { try { return JSON.parse(localStorage.getItem(POLLS_VOTES_KEY) || '{}'); } catch { return {}; } }
function _readPollsMy()        { try { return JSON.parse(localStorage.getItem(POLLS_MY_KEY) || '{}'); } catch { return {}; } }
function _readPollsBreakdown() { try { return JSON.parse(localStorage.getItem(POLLS_BREAKDOWN_KEY) || '{}'); } catch { return {}; } }
function getAffiliation()      { return localStorage.getItem(POLLS_AFFIL_KEY) || ''; }
function setAffiliation(a) {
  localStorage.setItem(POLLS_AFFIL_KEY, a);
  document.querySelectorAll('#affilChips span').forEach(s => s.classList.toggle('selected', s.dataset.affil === a));
}

function _seedPollCounts(pollId) {
  const votes = _readPollsVotes();
  if (votes[pollId]) return votes[pollId];
  const poll = POLLS_SEED.find(p => p.id === pollId);
  if (!poll) return {};
  const totals = {};
  let remaining = 120 + Math.floor(Math.random() * 300);
  poll.options.forEach((o, i) => {
    const share = i === poll.options.length - 1 ? remaining : Math.floor(remaining * (0.2 + Math.random() * 0.5));
    totals[o.id] = share;
    remaining -= share;
  });
  votes[pollId] = totals;
  localStorage.setItem(POLLS_VOTES_KEY, JSON.stringify(votes));
  return totals;
}

function votePoll(pollId, optionId) {
  if (!requireAuth(() => votePoll(pollId, optionId), 'Sign in to vote')) return;
  const my = _readPollsMy();
  if (my[pollId]) return;
  recordEngagement('poll-vote');
  const votes = _readPollsVotes();
  votes[pollId] = votes[pollId] || _seedPollCounts(pollId);
  votes[pollId][optionId] = (votes[pollId][optionId] || 0) + 1;
  localStorage.setItem(POLLS_VOTES_KEY, JSON.stringify(votes));
  my[pollId] = optionId;
  localStorage.setItem(POLLS_MY_KEY, JSON.stringify(my));
  const affil = getAffiliation() || 'unknown';
  const bd = _readPollsBreakdown();
  bd[pollId] = bd[pollId] || {};
  bd[pollId][affil] = bd[pollId][affil] || {};
  bd[pollId][affil][optionId] = (bd[pollId][affil][optionId] || 0) + 1;
  localStorage.setItem(POLLS_BREAKDOWN_KEY, JSON.stringify(bd));
  renderPolls();
}

// User-submitted polls (pending moderation)
const POLLS_PENDING_KEY  = 'civicvoice_polls_pending_v1';
const POLLS_APPROVED_KEY = 'civicvoice_polls_approved_v1';
const POLLS_COMMENTS_KEY = 'civicvoice_polls_comments_v1';   // { pollId: [{handle, optionId, text, ts}] }
function _readPollComments() { try { return JSON.parse(localStorage.getItem(POLLS_COMMENTS_KEY) || '{}'); } catch { return {}; } }
function addPollComment(pollId, optionId, text) {
  if (!text || text.length < 4) return;
  if (text.length > 280) text = text.slice(0, 280);
  if (!requireAuth(() => addPollComment(pollId, optionId, text), 'Sign in to comment')) return;
  const u = getCurrentUser();
  const handle = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : 'Anonymous';
  const all = _readPollComments();
  all[pollId] = all[pollId] || [];
  all[pollId].push({ handle, optionId, text, ts: new Date().toISOString(), affil: getAffiliation() || '' });
  localStorage.setItem(POLLS_COMMENTS_KEY, JSON.stringify(all));
  renderPolls();
}
function submitPollComment(pollId) {
  const input = document.getElementById(`pc-input-${pollId}`);
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;
  const my = _readPollsMy();
  addPollComment(pollId, my[pollId] || 'none', text);
  input.value = '';
}
function _readPendingPolls()  { try { return JSON.parse(localStorage.getItem(POLLS_PENDING_KEY) || '[]'); } catch { return []; } }
function _readApprovedPolls() { try { return JSON.parse(localStorage.getItem(POLLS_APPROVED_KEY) || '[]'); } catch { return []; } }

function openSubmitPoll() {
  if (!requireAuth(() => openSubmitPoll(), 'Sign in to submit a poll')) return;
  document.getElementById('submitPollOverlay').classList.add('show');
  document.getElementById('spStatus').textContent = '';
}
function closeSubmitPoll() {
  document.getElementById('submitPollOverlay').classList.remove('show');
}
function submitPoll() {
  const cat = document.getElementById('spCategory').value;
  const q = (document.getElementById('spQuestion').value || '').trim();
  const optsRaw = (document.getElementById('spOptions').value || '').trim();
  const opts = optsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  const status = document.getElementById('spStatus');
  if (q.length < 12) { status.style.color = 'var(--red)'; status.textContent = 'Question is too short. Make it specific.'; return; }
  if (opts.length < 2 || opts.length > 4) { status.style.color = 'var(--red)'; status.textContent = 'Need 2–4 options. One per line.'; return; }
  const u = getCurrentUser();
  const author = u ? (u.anonymous ? u.handle : (u.displayName || u.handle)) : 'Anonymous';
  const id = 'u' + Date.now();
  const poll = {
    id, cat, q,
    options: opts.map((label, i) => ({ id: 'o' + (i + 1), label })),
    closes: 'Open',
    submitted_by: author,
    submitted_at: new Date().toISOString(),
    status: 'pending',
  };
  const pending = _readPendingPolls();
  pending.push(poll);
  localStorage.setItem(POLLS_PENDING_KEY, JSON.stringify(pending));
  status.style.color = 'var(--green)';
  status.innerHTML = '✓ Your poll is in moderation. Once approved, it joins the public list. <button onclick="closeSubmitPoll()" style="background:none;border:none;color:var(--accent);text-decoration:underline;cursor:pointer;font-family:inherit;font-size:inherit;">Close</button>';
  document.getElementById('spQuestion').value = '';
  document.getElementById('spOptions').value = '';
  // Linger 60s like story submit — gives the submitter time to read confirmation, share, or close
  setTimeout(() => { closeSubmitPoll(); }, 60000);
}

function renderPolls() {
  const affil = getAffiliation();
  document.querySelectorAll('#affilChips span').forEach(s => s.classList.toggle('selected', s.dataset.affil === affil));
  const list = document.getElementById('pollsList');
  if (!list) return;
  const my = _readPollsMy();
  // Combine seeded + approved user-submitted polls (newest first)
  const approved = _readApprovedPolls();
  const allPolls = [...approved, ...POLLS_SEED];
  list.innerHTML = allPolls.map(p => {
    const counts = _readPollsVotes()[p.id] || _seedPollCounts(p.id);
    const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
    const myVote = my[p.id];
    const optionsHtml = p.options.map(o => {
      const c = counts[o.id] || 0;
      const pct = Math.round((c / total) * 100);
      const isMine = myVote === o.id;
      return `
        <div class="poll-opt ${isMine ? 'voted' : ''}" onclick="votePoll('${p.id}','${o.id}')">
          <div class="po-bar" style="width:${myVote ? pct : 0}%;"></div>
          <span class="po-label">${escapeHtml(o.label)}${isMine ? ' &middot; <strong style="color:var(--accent);">your vote</strong>' : ''}</span>
          ${myVote ? `<span class="po-pct">${pct}%</span>` : ''}
        </div>`;
    }).join('');
    // Optional comments — appear after voting. Shows top 3, expandable.
    const allComments = _readPollComments()[p.id] || [];
    const commentsHtml = myVote ? `
      <div class="poll-comments">
        <div class="pcm-add">
          <input type="text" id="pc-input-${p.id}" maxlength="280" placeholder="Want to say why? Optional, anonymous, 1-2 sentences." onkeydown="if(event.key==='Enter'){event.preventDefault();submitPollComment('${p.id}');}">
          <button class="pcm-send" onclick="submitPollComment('${p.id}')">Post</button>
        </div>
        ${allComments.length ? `
          <div class="pcm-list">
            <div class="pcm-head">${allComments.length} ${allComments.length === 1 ? 'reason' : 'reasons'} shared</div>
            ${allComments.slice(-3).reverse().map(cmt => `
              <div class="pcm-item">
                <span class="pcm-handle">${escapeHtml(cmt.handle)}${cmt.affil ? ` · <span class="pcm-affil">${escapeHtml(cmt.affil)}</span>` : ''}</span>
                <span class="pcm-text">${escapeHtml(cmt.text)}</span>
              </div>`).join('')}
          </div>` : ''}
      </div>` : '';
    return `
      <article class="poll-card">
        <div class="pc-cat">${escapeHtml(p.cat)}</div>
        <div class="pc-q">${escapeHtml(p.q)}</div>
        <div class="pc-meta">${total.toLocaleString()} ${total === 1 ? 'take' : 'takes'} &middot; ${allComments.length} ${allComments.length === 1 ? 'comment' : 'comments'} &middot; ${p.closes}</div>
        <div class="poll-options">${optionsHtml}</div>
        ${commentsHtml}
        <div class="pc-foot">
          <span>${myVote ? 'You voted.' : 'Tap an option to take your stand.'}</span>
          <span>${affil ? `Voting as: <strong style="color:var(--ink);">${escapeHtml(affil)}</strong>` : '<span style="color:var(--accent);cursor:pointer;" onclick="document.getElementById(\'affilPicker\').scrollIntoView({behavior:\'smooth\'});">Set affiliation &uarr;</span>'}</span>
        </div>
      </article>`;
  }).join('');
}

// Register service worker (for PWA / offline / installability)
// Auto-reload when a new SW version takes over — fixes the "I have to reload twice
// after every deploy" PWA gotcha.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        // When the SW finds an update, install it; when the new SW becomes active,
        // reload the page once so the user sees the new version immediately.
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
              // Guard against an infinite reload loop
              if (!window.__cv_reloaded) {
                window.__cv_reloaded = true;
                window.location.reload();
              }
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}
