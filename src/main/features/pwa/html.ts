export const PWA_CONTROLLER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="WorshipSync">
<meta name="theme-color" content="#0a0a12">
<title>WorshipSync Controller</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#0a0a12;--surface:#13131e;--surface2:#1c1c2e;--border:rgba(255,255,255,.08);
  --text:#f0f0f8;--muted:#6b6b88;--primary:#7c3aed;--primary-dim:rgba(124,58,237,.15);
  --active:#7c3aed;--active-bg:rgba(124,58,237,.18);--live:#ef4444;
  --blank-active:#f59e0b;--blank-dim:rgba(245,158,11,.15);
  --safe-top:env(safe-area-inset-top,0px);--safe-bot:env(safe-area-inset-bottom,0px);
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}

/* ── Layout (mobile-first flexbox) ── */
#app{display:flex;flex-direction:column;height:100dvh;padding-top:var(--safe-top);overflow:hidden}
#status-banner,#topbar,#transport{flex-shrink:0}
#slides{flex:1;overflow-y:auto;min-height:0}

/* ── Wide screen: 2-column grid ── */
@media(min-width:680px){
  #app{display:grid;grid-template-columns:220px 1fr;grid-template-rows:auto auto 1fr auto}
  #topbar{grid-column:1/3;grid-row:1}
  #status-banner{grid-column:1/3;grid-row:2}
  #lineup{grid-column:1;grid-row:3;position:static!important;transform:none!important;
          display:flex!important;border-right:1px solid var(--border);overflow-y:auto}
  #lineup-backdrop{display:none!important}
  #btn-lineup-toggle{display:none}
  #slides{grid-column:2;grid-row:3;overflow-y:auto;min-height:0}
  #transport{grid-column:1/3;grid-row:4}
}

/* ── Top bar ── */
#topbar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border);min-height:52px}
#conn-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0;transition:background .3s}
#conn-dot.live{background:#22c55e}
#conn-dot.error{background:var(--live);animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
#item-title{flex:1;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
#item-subtitle{font-size:10px;color:var(--muted);flex-shrink:0}
#btn-lineup-toggle{display:flex;align-items:center;gap:4px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--muted);padding:5px 9px;font-size:11px;cursor:pointer}
@media(min-width:680px){#btn-lineup-toggle{display:none}}

/* ── Blank / logo status banner ── */
#status-banner{display:none;padding:7px 14px;text-align:center;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
#status-banner.blank-on{display:block;background:rgba(245,158,11,.12);color:#f59e0b;border-bottom:1px solid rgba(245,158,11,.2)}
#status-banner.logo-on{display:block;background:rgba(99,102,241,.12);color:#818cf8;border-bottom:1px solid rgba(99,102,241,.2)}

/* ── Lineup sidebar (mobile: fixed drawer; wide: static column) ── */
#lineup{position:fixed;top:0;left:0;bottom:0;width:min(300px,85vw);z-index:200;
        display:flex;flex-direction:column;background:var(--surface);overflow-y:auto;
        transform:translateX(-100%);transition:transform .24s ease;will-change:transform}
#lineup.open{transform:translateX(0)}
#lineup-backdrop{display:none;position:fixed;inset:0;z-index:199;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
#lineup-backdrop.show{display:block}
#lineup-header{padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);flex-shrink:0}
.lineup-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;-webkit-user-select:none;user-select:none}
.lineup-item:active,.lineup-item:hover{background:var(--surface2)}
.lineup-item.active{background:var(--active-bg);border-left:3px solid var(--active)}
.lineup-item .icon{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;background:var(--surface2)}
.lineup-item.active .icon{background:var(--primary-dim)}
.lineup-item .info{min-width:0;flex:1}
.lineup-item .name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lineup-item .meta{font-size:10px;color:var(--muted);margin-top:1px}
.lineup-item.section-divider{padding:6px 14px;cursor:default;background:transparent}
.lineup-item.section-divider .name{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}

/* ── Slide grid ── */
#slides{overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
#slides-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:0 2px 4px}
#slide-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr));gap:8px}
.slide-btn{background:var(--surface);border:2px solid var(--border);border-radius:12px;padding:12px;cursor:pointer;transition:all .12s;text-align:left;-webkit-user-select:none;user-select:none;min-height:80px;display:flex;flex-direction:column;gap:5px;position:relative;overflow:hidden}
.slide-btn:active{transform:scale(.97)}
.slide-btn:hover{border-color:rgba(124,58,237,.4);background:var(--surface2)}
.slide-btn.active{border-color:var(--active);background:var(--active-bg);box-shadow:0 0 0 1px var(--active) inset}
.slide-btn .s-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.slide-btn.active .s-label{color:var(--active)}
.slide-btn .s-lines{font-size:12px;line-height:1.4;color:var(--text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.slide-btn .s-live{position:absolute;top:6px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--live)}

/* ── Media / countdown ── */
#media-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;height:100%;padding:24px}
.media-thumb{width:100%;max-width:340px;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;border:2px solid var(--border);display:flex;align-items:center;justify-content:center}
.media-thumb img{width:100%;height:100%;object-fit:contain}
.media-thumb .media-icon{font-size:40px;opacity:.3}
.media-info{text-align:center}
.media-info h2{font-size:16px;font-weight:600}
.media-info p{font-size:12px;color:var(--muted);margin-top:4px}
.btn-show{background:var(--primary);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;width:100%;max-width:340px;transition:all .12s}
.btn-show:active{transform:scale(.97)}
.btn-show:disabled{opacity:.35;cursor:default}
#countdown-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;height:100%;padding:24px}
#countdown-display{font-size:clamp(48px,15vw,80px);font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;font-family:'SF Mono','Fira Code',monospace;text-align:center}
.btn-countdown{border:2px solid var(--border);background:var(--surface);color:var(--text);border-radius:12px;padding:12px 24px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;width:100%;max-width:300px;transition:all .12s}
.btn-countdown:active{transform:scale(.97)}
.btn-countdown.running{border-color:var(--live);background:rgba(239,68,68,.12);color:var(--live)}

/* ── Empty state ── */
#empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:32px;text-align:center}
#empty-state h2{font-size:16px;font-weight:600;color:var(--text)}
#empty-state p{font-size:13px;color:var(--muted);line-height:1.5}

/* ── Transport bar ── */
#transport{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-bottom:calc(10px + var(--safe-bot));background:var(--surface);border-top:1px solid var(--border)}
.t-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:10px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all .12s;min-height:58px}
.t-btn:active{transform:scale(.96)}
.t-btn .t-icon{font-size:18px;line-height:1}
.t-btn .t-label{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.t-btn:hover{background:var(--surface)}
#btn-blank.active{background:var(--blank-dim);border-color:rgba(245,158,11,.4)}
#btn-blank.active .t-icon,#btn-blank.active .t-label{color:var(--blank-active)}
#btn-logo.active{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.3)}
#btn-logo.active .t-icon,#btn-logo.active .t-label{color:#818cf8}
#btn-prev,.t-btn.arrow{max-width:64px}

/* ── Disconnected overlay ── */
#disconnected{display:none;position:fixed;inset:0;background:rgba(10,10,18,.92);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:12px;text-align:center;padding:32px}
#disconnected.show{display:flex}
#disconnected h2{font-size:18px;font-weight:700}
#disconnected p{font-size:13px;color:var(--muted);line-height:1.5}
.spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="app">

  <!-- Top bar -->
  <div id="topbar">
    <div id="conn-dot"></div>
    <div id="item-title">WorshipSync</div>
    <div id="item-subtitle"></div>
    <button id="btn-lineup-toggle" onclick="toggleLineup()">☰ Lineup</button>
  </div>

  <!-- Status banner (blank/logo active) -->
  <div id="status-banner"></div>

  <!-- Lineup drawer (mobile: fixed overlay; wide: static sidebar) -->
  <div id="lineup">
    <div id="lineup-header">Service Lineup</div>
    <div id="lineup-list"></div>
  </div>
  <div id="lineup-backdrop" onclick="closeLineup()"></div>

  <!-- Slide content -->
  <div id="slides">
    <div id="empty-state">
      <h2>No Service Loaded</h2>
      <p>Start a live session from the WorshipSync desktop app, then use this controller to advance slides.</p>
    </div>
  </div>

  <!-- Transport -->
  <div id="transport">
    <button class="t-btn arrow" id="btn-prev" onclick="cmd('prev-slide')">
      <span class="t-icon">&#8592;</span>
      <span class="t-label">Prev</span>
    </button>
    <button class="t-btn" id="btn-blank" onclick="toggleBlank()">
      <span class="t-icon">&#9632;</span>
      <span class="t-label">Blank</span>
    </button>
    <button class="t-btn" id="btn-logo" onclick="toggleLogo()">
      <span class="t-icon">&#9670;</span>
      <span class="t-label">Logo</span>
    </button>
    <button class="t-btn arrow" id="btn-next" onclick="cmd('next-slide')">
      <span class="t-icon">&#8594;</span>
      <span class="t-label">Next</span>
    </button>
  </div>

</div>

<!-- Disconnected overlay -->
<div id="disconnected">
  <div class="spinner"></div>
  <h2>Reconnecting…</h2>
  <p>Waiting for WorshipSync desktop app</p>
</div>

<script>
// ── State ──────────────────────────────────────────────────────────────────
const S = {
  connected: false,
  blank: false,
  logo: false,
  slide: null,
  countdown: null,
  lineup: [],
  currentLineupIdx: -1,
  activeLineupIdx: -1,   // which item is selected in the PWA
  activeSlideIdx: -1,    // which slide is selected in the PWA
  countdownInterval: null,
  countdownMs: 0,
}

// ── SSE Connection ─────────────────────────────────────────────────────────
let es = null, reconnectTimer = null, reconnectDelay = 1000

function connect() {
  if (es) { try { es.close() } catch {} }
  es = new EventSource('/events')

  es.onopen = () => {
    S.connected = true
    reconnectDelay = 1000
    setConnected(true)
    fetchState()
  }

  es.onmessage = (e) => {
    try { handleEvent(JSON.parse(e.data)) } catch {}
  }

  es.onerror = () => {
    S.connected = false
    setConnected(false)
    es.close()
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 10000)
      connect()
    }, reconnectDelay)
  }
}

async function fetchState() {
  try {
    const r = await fetch('/controller/state')
    if (!r.ok) return
    const s = await r.json()
    S.blank = s.blank ?? false
    S.logo = s.logo ?? false
    S.slide = s.slide ?? null
    S.countdown = s.countdown ?? null
    S.lineup = s.lineup ?? []
    S.currentLineupIdx = s.currentLineupIdx ?? -1
    S.activeLineupIdx = S.currentLineupIdx
    S.activeSlideIdx = s.currentSlideIdx ?? -1
    renderAll()
  } catch {}
}

// ── Event Handler ──────────────────────────────────────────────────────────
function handleEvent(ev) {
  switch (ev.type) {
    case 'init':
      S.blank = ev.blank ?? false
      S.logo = ev.logo ?? false
      S.slide = ev.slide ?? null
      S.countdown = ev.countdown ?? null
      if (ev.lineup?.length) {
        S.lineup = ev.lineup
        S.currentLineupIdx = ev.currentLineupIdx ?? -1
        S.activeLineupIdx = S.currentLineupIdx
      }
      renderAll()
      break
    case 'slide':
      S.slide = ev.payload
      S.blank = false
      S.logo = false
      S.currentLineupIdx = ev.lineupIdx ?? S.currentLineupIdx
      S.activeLineupIdx = S.currentLineupIdx
      S.activeSlideIdx = ev.slideIdx ?? -1
      renderSlides()
      renderLineupList()
      renderStatus()
      renderBanner()
      renderTransport()
      break
    case 'blank':
      S.blank = ev.isBlank
      if (ev.isBlank) S.logo = false
      renderBanner()
      renderTransport()
      break
    case 'logo':
      S.logo = ev.isLogo
      if (ev.isLogo) S.blank = false
      renderBanner()
      renderTransport()
      break
    case 'countdown':
      S.countdown = ev.data
      startCountdownTick()
      renderSlides()
      break
    case 'lineup':
      S.lineup = ev.items ?? []
      S.currentLineupIdx = ev.currentIdx ?? -1
      S.activeLineupIdx = S.currentLineupIdx
      renderLineupList()
      renderSlides()
      renderStatus()
      break
    case 'shutdown':
      setConnected(false)
      break
  }
}

// ── Commands ───────────────────────────────────────────────────────────────
async function cmd(action, data = {}) {
  try {
    await fetch('/controller/cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    })
  } catch { /* offline — ignore */ }
}

function showSlide(lineupIdx, slideIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  // Optimistic update
  S.activeLineupIdx = lineupIdx
  S.activeSlideIdx = slideIdx
  S.blank = false
  S.logo = false
  renderSlides()
  renderLineupList()
  renderBanner()
  renderTransport()
  cmd('show-slide', { lineupItemId: item.id, slideIdx })
}

function selectLineupItem(idx) {
  const item = S.lineup[idx]
  if (!item || item.itemType === 'section') return
  if (item.slides.length > 0) {
    showSlide(idx, 0)
  } else {
    S.activeLineupIdx = idx
    S.activeSlideIdx = -1
    renderLineupList()
    renderSlides()
    renderStatus()
  }
  // Close lineup drawer after selection (mobile)
  closeLineup()
}

function toggleBlank() {
  const next = !S.blank
  S.blank = next
  if (next) S.logo = false
  renderBanner()
  renderTransport()
  cmd('blank', { value: next })
}

function toggleLogo() {
  const next = !S.logo
  S.logo = next
  if (next) S.blank = false
  renderBanner()
  renderTransport()
  cmd('logo', { value: next })
}

function toggleLineup() {
  const lineup = document.getElementById('lineup')
  const backdrop = document.getElementById('lineup-backdrop')
  const isOpen = lineup.classList.toggle('open')
  backdrop.classList.toggle('show', isOpen)
}
function closeLineup() {
  document.getElementById('lineup').classList.remove('open')
  document.getElementById('lineup-backdrop').classList.remove('show')
}

// ── Rendering ──────────────────────────────────────────────────────────────
function renderAll() {
  renderStatus()
  renderBanner()
  renderLineupList()
  renderSlides()
  renderTransport()
}

function renderStatus() {
  const item = S.lineup[S.activeLineupIdx] ?? S.lineup[S.currentLineupIdx]
  const titleEl = document.getElementById('item-title')
  const subEl = document.getElementById('item-subtitle')
  if (item) {
    titleEl.textContent = item.title
    subEl.textContent = typeLabel(item.itemType)
  } else {
    titleEl.textContent = 'WorshipSync'
    subEl.textContent = ''
  }
}

function renderBanner() {
  const el = document.getElementById('status-banner')
  if (S.blank) {
    el.textContent = '■ Screen Blanked'
    el.className = 'blank-on'
  } else if (S.logo) {
    el.textContent = '◆ Logo On Screen'
    el.className = 'logo-on'
  } else {
    el.textContent = ''
    el.className = ''
  }
}

function renderLineupList() {
  const list = document.getElementById('lineup-list')
  if (!S.lineup.length) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No lineup loaded</div>'; return }
  list.innerHTML = S.lineup.map((item, i) => {
    if (item.itemType === 'section') {
      return '<div class="lineup-item section-divider"><span class="name">' + esc(item.title) + '</span></div>'
    }
    const active = i === S.activeLineupIdx
    const icon = typeIcon(item.itemType)
    const count = item.slides.length
    const meta = count > 0 ? count + ' slide' + (count !== 1 ? 's' : '') : typeLabel(item.itemType)
    return '<div class="lineup-item' + (active ? ' active' : '') + '" onclick="selectLineupItem(' + i + ')">'
      + '<div class="icon">' + icon + '</div>'
      + '<div class="info"><div class="name">' + esc(item.title) + '</div><div class="meta">' + meta + '</div></div>'
      + '</div>'
  }).join('')
}

function renderSlides() {
  const container = document.getElementById('slides')
  const item = S.lineup[S.activeLineupIdx]

  if (!item) {
    container.innerHTML = '<div id="empty-state"><h2>No Service Loaded</h2><p>Start a live session from the desktop app to control slides here.</p></div>'
    return
  }

  if (item.itemType === 'countdown') {
    renderCountdownPanel(container, item)
    return
  }

  if (item.itemType === 'media') {
    renderMediaPanel(container, item)
    return
  }

  // Song / Scripture / Announcement — slide grid
  if (!item.slides.length) {
    container.innerHTML = '<div id="empty-state"><h2>' + esc(item.title) + '</h2><p>No slides available for this item.</p></div>'
    return
  }

  const isActive = S.activeLineupIdx === S.currentLineupIdx
  container.innerHTML =
    '<div id="slides-title">' + esc(item.title) + '</div>'
    + '<div id="slide-grid">'
    + item.slides.map((sl, i) => {
      const liveIdx = S.activeLineupIdx
      const active = isActive && i === S.activeSlideIdx
      const linesHtml = sl.lines.map(l => esc(l)).join('<br>')
      return '<button class="slide-btn' + (active ? ' active' : '') + '" onclick="showSlide(' + S.activeLineupIdx + ',' + i + ')">'
        + '<span class="s-label">' + esc(sl.sectionLabel) + '</span>'
        + '<span class="s-lines">' + (linesHtml || '<em style="color:var(--muted)">Empty slide</em>') + '</span>'
        + (active ? '<span class="s-live"></span>' : '')
        + '</button>'
    }).join('')
    + '</div>'
}

function renderMediaPanel(container, item) {
  const isLive = S.activeLineupIdx === S.currentLineupIdx && !S.blank
  const mediaPath = item.mediaPath ?? ''
  const isImg = /\\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(mediaPath)
  const isVid = /\\.(mp4|webm|mov)$/i.test(mediaPath)
  const isAud = /\\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(mediaPath)

  const thumbHtml = isImg
    ? '<img src="file://' + encodeURI(mediaPath) + '" style="width:100%;height:100%;object-fit:contain" alt="">'
    : '<span class="media-icon">' + (isVid ? '▶' : isAud ? '♪' : '🖼') + '</span>'

  container.innerHTML =
    '<div id="media-panel">'
    + '<div class="media-thumb">' + thumbHtml + '</div>'
    + '<div class="media-info"><h2>' + esc(item.title.replace(/^(Image|Video|Audio):\\s*/i,'')) + '</h2>'
    + '<p>' + (isImg ? 'Image' : isVid ? 'Video' : isAud ? 'Audio' : 'Media') + '</p></div>'
    + '<button class="btn-show" ' + (isLive ? 'disabled' : '') + ' onclick="showSlide(' + S.activeLineupIdx + ',0)">'
    + (isLive ? 'On Screen' : 'Show on Screen') + '</button>'
    + '</div>'
}

function renderCountdownPanel(container, item) {
  const running = S.countdown?.running ?? false
  const cd = computeCountdown()
  container.innerHTML =
    '<div id="countdown-panel">'
    + '<div id="countdown-display">' + cd + '</div>'
    + '<button class="btn-countdown ' + (running ? 'running' : '') + '" onclick="toggleCountdown()">'
    + (running ? '■ Stop Countdown' : '▶ Start Countdown') + '</button>'
    + '</div>'
}

function renderTransport() {
  document.getElementById('btn-blank').className = 't-btn' + (S.blank ? ' active' : '')
  document.getElementById('btn-logo').className = 't-btn' + (S.logo ? ' active' : '')
}

function setConnected(on) {
  const dot = document.getElementById('conn-dot')
  dot.className = on ? 'live' : 'error'
  const overlay = document.getElementById('disconnected')
  overlay.className = on ? '' : 'show'
}

// ── Countdown Tick ─────────────────────────────────────────────────────────
function startCountdownTick() {
  if (S.countdownInterval) clearInterval(S.countdownInterval)
  if (S.countdown?.running) {
    S.countdownInterval = setInterval(() => {
      const el = document.getElementById('countdown-display')
      if (el) el.textContent = computeCountdown()
    }, 250)
  }
}

function computeCountdown() {
  if (!S.countdown?.running || !S.countdown?.targetTime) return '00:00'
  const target = new Date(S.countdown.targetTime).getTime()
  const diff = Math.max(0, target - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return h > 0
    ? pad(h) + ':' + pad(m) + ':' + pad(s)
    : pad(m) + ':' + pad(s)
}

function toggleCountdown() {
  const running = !(S.countdown?.running ?? false)
  const targetTime = S.countdown?.targetTime ?? new Date(Date.now() + 30 * 60000).toISOString()
  cmd('countdown', { targetTime, running })
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function pad(n) { return String(n).padStart(2,'0') }
function typeIcon(t) {
  return {song:'♪',scripture:'✝',media:'🎬',countdown:'⏱',announcement:'📢',section:'—'}[t] ?? '•'
}
function typeLabel(t) {
  return {song:'Song',scripture:'Scripture',media:'Media',countdown:'Countdown',announcement:'Announcement',section:'Section'}[t] ?? t
}

// ── Boot ───────────────────────────────────────────────────────────────────
connect()
</script>
</body>
</html>`
