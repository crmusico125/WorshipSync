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
          display:flex!important;width:100%!important;max-width:100%!important;
          border-right:1px solid var(--border);overflow-y:auto;overflow-x:hidden}
  #lineup-backdrop{display:none!important}
  #slides{grid-column:2;grid-row:3;overflow-y:auto;min-height:0;min-width:0}
  #transport{grid-column:1/3;grid-row:4}
  /* Collapsible sidebar */
  #app.sidebar-hidden{grid-template-columns:1fr}
  #app.sidebar-hidden #lineup{display:none!important}
  #app.sidebar-hidden #slides{grid-column:1}
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

/* ── Bible search bottom sheet ── */
#bible-sheet{position:fixed;inset:0;z-index:300;pointer-events:none}
#bible-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);opacity:0;transition:opacity .24s}
#bible-panel{position:absolute;bottom:0;left:0;right:0;max-height:88dvh;background:var(--surface);border-radius:20px 20px 0 0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);overflow:hidden}
#bible-sheet.open{pointer-events:auto}
#bible-sheet.open #bible-backdrop{opacity:1}
#bible-sheet.open #bible-panel{transform:translateY(0)}
#bible-header{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 10px;flex-shrink:0}
#bible-header h3{font-size:16px;font-weight:700}
#bible-close-btn{background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}
#bible-form{display:flex;gap:8px;padding:0 16px 12px;flex-shrink:0;border-bottom:1px solid var(--border)}
#bible-ref{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;padding:9px 12px;outline:none;min-width:0;-webkit-appearance:none}
#bible-ref:focus{border-color:var(--primary)}
#bible-trans{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;padding:9px 8px;outline:none;flex-shrink:0;cursor:pointer;min-width:72px}
#bible-go{background:var(--primary);color:#fff;border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0}
#bible-go:disabled{opacity:.45}
#bible-results{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.bv{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
.bv .bv-ref{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--primary)}
.bv .bv-text{font-size:14px;line-height:1.6;color:var(--text)}
.bv .bv-btn{align-self:flex-end;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s}
.bv .bv-btn:active{transform:scale(.96)}
.bv.bv-live{border-color:var(--live);background:rgba(239,68,68,.07)}
.bv.bv-live .bv-btn{background:var(--live);border-color:var(--live);color:#fff}
#bible-status{text-align:center;color:var(--muted);font-size:13px;padding:24px 0;line-height:1.5}
#bible-status.error{color:#f87171}
#btn-bible{display:flex;align-items:center;gap:4px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--muted);padding:5px 9px;font-size:11px;cursor:pointer;flex-shrink:0}

/* ── Bible Browser lineup widget (shared/synced with desktop) ── */
.bw-form{display:flex;gap:8px}
.bw-ref{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;padding:9px 12px;outline:none;min-width:0;-webkit-appearance:none}
.bw-ref:focus{border-color:var(--primary)}
.bw-trans{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;padding:9px 8px;outline:none;flex-shrink:0;cursor:pointer;min-width:72px}
.bw-go{background:var(--primary);color:#fff;border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0}
.bw-go:disabled{opacity:.45}
.bw-recent-row{display:flex;gap:6px;overflow-x:auto;[scrollbar-width:none]}
.bw-recent-row::-webkit-scrollbar{display:none}
.bw-recent-chip{flex-shrink:0;display:flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.bw-recent-chip.active{border-color:var(--primary);background:rgba(124,58,237,.12);color:var(--primary)}
.bw-recent-trans{font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.03em}
.bw-recent-chip.active .bw-recent-trans{color:var(--primary);opacity:.75}
.bw-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.bw-chapter-btn{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer}
.bw-chapter-btn:disabled{opacity:.45}
.bw-jump{display:flex;align-items:center;gap:6px}
.bw-jump input{width:56px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:6px 8px;outline:none;-webkit-appearance:none}
.bw-jump button{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer}
.bw-compare-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px}
.bw-compare-label{color:var(--muted);font-weight:600;flex-shrink:0}
.bw-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:12px;background:rgba(124,58,237,.14);color:var(--primary);font-size:12px;font-weight:700}
.bw-chip button{background:none;border:none;color:inherit;opacity:.6;font-size:14px;line-height:1;cursor:pointer;padding:0}
.bw-add-compare{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:12px;padding:4px 10px;font-size:12px;cursor:pointer}
.bv-compare{margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:4px}
.bv-compare .bv-ref{font-size:9px}
.bv-compare .bv-text{font-size:13px}
.bw-navbar{display:flex;align-items:stretch;gap:4px;border-top:1px solid var(--border);padding-top:8px;flex-shrink:0}
.bw-nav-btn{flex:1;display:flex;flex-direction:column;gap:2px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;cursor:pointer;text-align:left;min-width:0}
.bw-nav-btn:disabled{opacity:.3;pointer-events:none}
.bw-nav-btn.next{text-align:right}
.bw-nav-btn .lbl{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.bw-nav-btn .ref{font-size:13px;font-weight:700;color:var(--text)}
#btn-bible:hover{color:var(--text)}

/* ── Disconnected overlay ── */
#disconnected{display:none;position:fixed;inset:0;background:rgba(10,10,18,.92);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:12px;text-align:center;padding:32px}
#disconnected.show{display:flex}
#disconnected h2{font-size:18px;font-weight:700}
#disconnected p{font-size:13px;color:var(--muted);line-height:1.5}
.spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── PIN overlay ── */
#pin-overlay{display:none;position:fixed;inset:0;background:rgba(10,10,18,.97);z-index:1000;align-items:center;justify-content:center;flex-direction:column;gap:16px;text-align:center;padding:32px}
#pin-overlay.show{display:flex}
#pin-overlay h2{font-size:20px;font-weight:700}
#pin-overlay p{font-size:13px;color:var(--muted);line-height:1.5;max-width:280px}
.pin-input{background:var(--surface);border:2px solid var(--border);border-radius:12px;color:var(--text);font-size:24px;font-weight:700;letter-spacing:.3em;text-align:center;padding:12px 16px;width:200px;outline:none;-webkit-appearance:none}
.pin-input:focus{border-color:var(--primary)}
.pin-error{font-size:12px;color:var(--live);min-height:18px}
.btn-pin{background:var(--primary);color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:14px;font-weight:700;cursor:pointer;width:200px;transition:opacity .12s}
.btn-pin:active{opacity:.8}
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
    <button id="btn-bible" onclick="openBible()">📖 Bible</button>
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

<!-- Bible search sheet -->
<div id="bible-sheet">
  <div id="bible-backdrop" onclick="closeBible()"></div>
  <div id="bible-panel">
    <div id="bible-header">
      <h3>Scripture Search</h3>
      <button id="bible-close-btn" onclick="closeBible()">✕</button>
    </div>
    <div id="bible-form">
      <input id="bible-ref" type="text" placeholder="e.g. John 3:16 or Psalm 23" autocomplete="off" onkeydown="if(event.key==='Enter')searchBible()">
      <select id="bible-trans"><option value="web">WEB</option></select>
      <button id="bible-go" onclick="searchBible()">Search</button>
    </div>
    <div id="bible-results">
      <div id="bible-status">Search for a Bible passage to project it on screen</div>
    </div>
  </div>
</div>

<!-- Disconnected overlay -->
<div id="disconnected">
  <div class="spinner"></div>
  <h2>Reconnecting…</h2>
  <p>Waiting for WorshipSync desktop app</p>
</div>

<!-- PIN overlay -->
<div id="pin-overlay">
  <div style="font-size:40px">🔒</div>
  <h2>PIN Required</h2>
  <p>Enter the PIN set by your operator to access the controller</p>
  <input id="pin-input" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" placeholder="••••" maxlength="8" onkeydown="if(event.key==='Enter')submitPin()">
  <div id="pin-error" class="pin-error"></div>
  <button class="btn-pin" onclick="submitPin()">Unlock</button>
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
  activeLineupIdx: -1,
  activeSlideIdx: -1,
  countdownInterval: null,
  countdownMs: 0,
  audioState: null,   // { isPlaying, currentTime, duration, lineupItemId, trackName? } — trackName only set for music_player items
  videoState: null,   // { isPlaying, currentTime, duration, lineupItemId }
  bibleBrowserState: null, // { lineupItemId, query, translationId, translationLabel, verses, projectedRef, loading, error }
  serviceDate: null,  // 'YYYY-MM-DD'
  serviceTime: null,  // 'HH:MM'
  pin: '',            // controller PIN (empty = no PIN required or not yet entered)
}

// ── PIN helpers ────────────────────────────────────────────────────────────
function initPin() {
  // URL param ?p= takes priority (used by QR code that embeds the PIN)
  const params = new URLSearchParams(window.location.search)
  const urlPin = params.get('p')
  if (urlPin) {
    S.pin = urlPin
    try { localStorage.setItem('ws_pin', urlPin) } catch {}
    return
  }
  // Fall back to locally stored PIN
  try { S.pin = localStorage.getItem('ws_pin') || '' } catch {}
}

function showPinOverlay() {
  document.getElementById('pin-overlay').classList.add('show')
  setTimeout(() => {
    const el = document.getElementById('pin-input')
    if (el) { el.value = ''; el.focus() }
  }, 50)
}
function hidePinOverlay() {
  document.getElementById('pin-overlay').classList.remove('show')
  document.getElementById('pin-error').textContent = ''
}

async function submitPin() {
  const input = document.getElementById('pin-input')
  const pin = (input.value || '').trim()
  if (!pin) {
    document.getElementById('pin-error').textContent = 'Please enter the PIN'
    return
  }
  S.pin = pin
  const status = await cmd('ping')
  if (status === 401) {
    S.pin = ''
    try { localStorage.removeItem('ws_pin') } catch {}
    document.getElementById('pin-error').textContent = 'Incorrect PIN — try again'
    input.value = ''
    input.focus()
  } else if (status === 200) {
    try { localStorage.setItem('ws_pin', pin) } catch {}
    hidePinOverlay()
    fetchState()
  }
}

// ── SSE Connection ─────────────────────────────────────────────────────────
let es = null, reconnectTimer = null, reconnectDelay = 1000

function connect() {
  if (es) { try { es.close() } catch {} }
  es = new EventSource('/controller/events')

  es.onopen = () => {
    S.connected = true
    reconnectDelay = 1000
    setConnected(true)
    fetchState()
  }

  es.onmessage = (e) => {
    // A swallowed exception here used to leave the page stuck on the static
    // "No Service Loaded" placeholder with zero trace of why — log it so a
    // future occurrence is actually diagnosable from the browser console.
    try { handleEvent(JSON.parse(e.data)) } catch (err) { console.error('[pwa] handleEvent failed:', err, e.data) }
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
    // If PIN is required and we don't have one, show the PIN overlay
    if (s.pinRequired && !S.pin) {
      showPinOverlay()
      return
    }
    hidePinOverlay()
    S.blank = s.blank ?? false
    S.logo = s.logo ?? false
    S.slide = s.slide ?? null
    S.countdown = s.countdown ?? null
    // Only jump the actively-viewed item to match live if we were already
    // following live — otherwise a reconnect (e.g. phone screen lock/unlock)
    // would snap someone browsing independently (the Bible Browser widget,
    // an upcoming song, ...) back onto whatever's currently live.
    var wasFollowingLive = S.activeLineupIdx === S.currentLineupIdx
    S.lineup = s.lineup ?? []
    S.currentLineupIdx = s.currentLineupIdx ?? -1
    var stillValid = S.activeLineupIdx >= 0 && S.activeLineupIdx < S.lineup.length
    if (wasFollowingLive || !stillValid) S.activeLineupIdx = S.currentLineupIdx
    S.activeSlideIdx = s.currentSlideIdx ?? -1
    renderAll()
  } catch (err) { console.error('[pwa] fetchState failed:', err) }
}

// ── Event Handler ──────────────────────────────────────────────────────────
function handleEvent(ev) {
  switch (ev.type) {
    case 'init':
      S.blank = ev.blank ?? false
      S.logo = ev.logo ?? false
      S.slide = ev.slide ?? null
      S.countdown = ev.countdown ?? null
      S.audioState = ev.audioState ?? null
      S.videoState = ev.videoState ?? null
      S.bibleBrowserState = ev.bibleBrowserState ?? null
      S.serviceDate = ev.serviceDate ?? null
      S.serviceTime = ev.serviceTime ?? null
      if (ev.lineup?.length) {
        S.lineup = ev.lineup
        S.currentLineupIdx = ev.currentLineupIdx ?? -1
        S.activeLineupIdx = S.currentLineupIdx
      }
      renderAll()
      break
    case 'audioState':
      S.audioState = { isPlaying: ev.isPlaying, currentTime: ev.currentTime, duration: ev.duration, lineupItemId: ev.lineupItemId, trackName: ev.trackName }
      renderSlides()
      break
    case 'videoState':
      S.videoState = { isPlaying: ev.isPlaying, currentTime: ev.currentTime, duration: ev.duration, lineupItemId: ev.lineupItemId }
      renderSlides()
      break
    case 'bibleBrowserState':
      S.bibleBrowserState = ev.state ?? null
      renderSlides()
      break
    case 'slide':
      S.slide = ev.payload
      S.blank = false
      S.logo = false
      // lineupIdx is omitted entirely (not just falsy) for ad-hoc content like a
      // Bible Browser verse projection — the server already strips it for exactly
      // this reason. Previously this line re-synced activeLineupIdx to whatever
      // currentLineupIdx already was even when lineupIdx was absent, which is
      // what kept snapping the view back to the live lineup item (the first one,
      // if that's what was live) every time an ad-hoc verse got projected.
      if (ev.lineupIdx !== undefined) {
        S.currentLineupIdx = ev.lineupIdx
        S.activeLineupIdx = ev.lineupIdx
      }
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
      // Navigating onto the synthetic terminal "blank" slide carries its position —
      // keep the slide grid / lineup highlight in sync so it doesn't look stuck.
      if (ev.lineupIdx !== undefined && ev.slideIdx !== undefined) {
        S.currentLineupIdx = ev.lineupIdx
        S.activeLineupIdx = ev.lineupIdx
        S.activeSlideIdx = ev.slideIdx
        renderLineupList()
        renderSlides()
      }
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
    case 'lineup': {
      // Same reasoning as fetchState() — only follow live if we already were.
      // pwa.syncLineup on the desktop resends this on lots of unrelated state
      // changes, not just real navigation, so an unconditional overwrite here
      // was yanking anyone browsing independently (e.g. Bible Browser) back to
      // whatever's live nearly every time something else changed.
      var wasFollowingLive = S.activeLineupIdx === S.currentLineupIdx
      S.lineup = ev.items ?? []
      S.currentLineupIdx = ev.currentIdx ?? -1
      var stillValid = S.activeLineupIdx >= 0 && S.activeLineupIdx < S.lineup.length
      if (wasFollowingLive || !stillValid) S.activeLineupIdx = S.currentLineupIdx
      if (ev.serviceDate) S.serviceDate = ev.serviceDate
      if (ev.serviceTime) S.serviceTime = ev.serviceTime
      renderLineupList()
      renderSlides()
      renderStatus()
      break
    }
    case 'shutdown':
      setConnected(false)
      break
  }
}

// ── Commands ───────────────────────────────────────────────────────────────
async function cmd(action, data = {}) {
  try {
    const body = S.pin ? { action, pin: S.pin, ...data } : { action, ...data }
    const r = await fetch('/controller/cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.status === 401) {
      // PIN was invalidated (e.g. admin changed it) — clear and re-prompt
      S.pin = ''
      try { localStorage.removeItem('ws_pin') } catch {}
      showPinOverlay()
    }
    return r.status
  } catch { return 0 }
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
  if (window.matchMedia('(min-width:680px)').matches) {
    const app = document.getElementById('app')
    const hidden = app.classList.toggle('sidebar-hidden')
    document.getElementById('btn-lineup-toggle').textContent = hidden ? '☰ Lineup' : '← Hide'
  } else {
    const lineup = document.getElementById('lineup')
    const backdrop = document.getElementById('lineup-backdrop')
    const isOpen = lineup.classList.toggle('open')
    backdrop.classList.toggle('show', isOpen)
  }
}
function closeLineup() {
  // Mobile only — wide-screen sidebar stays open unless toggled
  if (!window.matchMedia('(min-width:680px)').matches) {
    document.getElementById('lineup').classList.remove('open')
    document.getElementById('lineup-backdrop').classList.remove('show')
  }
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

  if (item.itemType === 'announcement') {
    renderAnnouncementPanel(container, item)
    return
  }

  if (item.itemType === 'music_player') {
    renderMusicPlayerPanel(container, item)
    return
  }

  if (item.itemType === 'bible') {
    renderBibleBrowserWidgetPanel(container, item)
    return
  }

  // Song / Scripture — slide grid
  if (!item.slides.length) {
    container.innerHTML = '<div id="empty-state"><h2>' + esc(item.title) + '</h2><p>No slides available for this item.</p></div>'
    return
  }

  const isActive = S.activeLineupIdx === S.currentLineupIdx
  container.innerHTML =
    '<div id="slides-title">' + esc(item.title) + '</div>'
    + '<div id="slide-grid">'
    + item.slides.map((sl, i) => {
      const active = isActive && i === S.activeSlideIdx
      const linesHtml = sl.lines.map(l => esc(l)).join('<br>')
      return '<button class="slide-btn' + (active ? ' active' : '') + '" data-idx="' + i + '" onclick="showSlide(' + S.activeLineupIdx + ',' + i + ')">'
        + '<span class="s-label">' + esc(sl.sectionLabel) + '</span>'
        + '<span class="s-lines">' + (linesHtml || '<em style="color:var(--muted)">Empty slide</em>') + '</span>'
        + (active ? '<span class="s-live"></span>' : '')
        + '</button>'
    }).join('')
    + '</div>'

  // Scroll active slide into view after DOM paint
  requestAnimationFrame(() => {
    const el = document.querySelector('#slide-grid .slide-btn.active')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function renderAnnouncementPanel(container, item) {
  const cards = (item.slides[0]?.cards ?? []).filter(c => c.heading)
  const isLive = S.activeLineupIdx === S.currentLineupIdx && !S.blank

  let cardsHtml = ''
  if (cards.length) {
    cardsHtml = cards.map(c => {
      const hasBadge = c.day || c.time
      const badgeHtml = hasBadge
        ? '<div style="flex-shrink:0;min-width:44px;padding:6px 8px;background:#fbbf24;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px">'
          + (c.day ? '<span style="font-size:10px;font-weight:800;color:#000;letter-spacing:.06em;text-transform:uppercase;line-height:1.1">' + esc(c.day) + '</span>' : '')
          + (c.time ? '<span style="font-size:10px;font-weight:700;color:#000;line-height:1.1">' + esc(c.time) + '</span>' : '')
          + '</div>'
        : ''
      const detailHtml = '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.3">' + esc(c.heading) + '</div>'
        + (c.location ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + esc(c.location) + '</div>' : '')
        + (c.description ? '<div style="font-size:11px;color:var(--muted);margin-top:1px">' + esc(c.description) + '</div>' : '')
        + '</div>'
      return '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--surface2);border-radius:12px;border:1px solid var(--border)">'
        + badgeHtml + detailHtml + '</div>'
    }).join('')
  } else {
    cardsHtml = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px 0">No events yet</div>'
  }

  container.innerHTML =
    '<div id="media-panel" style="gap:12px;padding-bottom:max(24px,var(--safe-bot))">'
    + '<div style="font-size:16px;font-weight:700;text-align:center;color:var(--text)">' + esc(item.title) + '</div>'
    + '<div style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:8px">' + cardsHtml + '</div>'
    + '<button class="btn-show" style="max-width:420px" ' + (isLive ? 'disabled' : '') + ' onclick="showSlide(' + S.activeLineupIdx + ',0)">'
    + (isLive ? 'On Screen' : 'Show on Screen') + '</button>'
    + '</div>'
}

function renderMediaPanel(container, item) {
  const sub = item.mediaSubtype  // 'image' | 'audio' | 'video' | null/undefined

  if (sub === 'audio') { renderAudioPanel(container, item); return }
  if (sub === 'video') { renderVideoPanel(container, item); return }

  // Image (or unknown — fall back to image panel)
  const mediaPath = item.mediaPath ?? ''
  const isLive = S.activeLineupIdx === S.currentLineupIdx && !S.blank
  const thumbHtml = mediaPath
    ? '<img src="file://' + encodeURI(mediaPath) + '" style="width:100%;height:100%;object-fit:contain" alt="">'
    : '<span class="media-icon">🖼</span>'

  container.innerHTML =
    '<div id="media-panel">'
    + '<div class="media-thumb">' + thumbHtml + '</div>'
    + '<div class="media-info"><h2>' + esc(item.title.replace(/^(Image|Video|Audio):\\s*/i,'')) + '</h2>'
    + '<p>Image</p></div>'
    + '<button class="btn-show" ' + (isLive ? 'disabled' : '') + ' onclick="showSlide(' + S.activeLineupIdx + ',0)">'
    + (isLive ? 'On Screen' : 'Show on Screen') + '</button>'
    + '</div>'
}

function renderAudioPanel(container, item) {
  const as = (S.audioState?.lineupItemId === item.id) ? S.audioState : null
  const isPlaying = as?.isPlaying ?? false
  const cur = as?.currentTime ?? 0
  const dur = as?.duration ?? 0
  const pct = dur > 0 ? (cur / dur) * 100 : 0
  const fmt = (s) => pad(Math.floor(s/60)) + ':' + pad(Math.floor(s%60))
  const name = item.title.replace(/^Audio:\\s*/i, '')

  container.innerHTML =
    '<div id="media-panel">'
    + '<div class="media-thumb"><span class="media-icon" style="font-size:52px">♪</span></div>'
    + '<div class="media-info"><h2>' + esc(name) + '</h2>'
    + '<p style="font-size:11px;color:var(--muted)">' + fmt(cur) + ' / ' + fmt(dur) + '</p></div>'
    + '<div style="width:100%;max-width:340px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">'
    + '<div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:2px;transition:width .1s linear"></div>'
    + '</div>'
    + '<button class="btn-show" onclick="toggleAudio(' + S.activeLineupIdx + ')">'
    + (isPlaying ? '⏸ Pause' : '▶ Play') + '</button>'
    + '</div>'
}

function renderVideoPanel(container, item) {
  const vs = (S.videoState?.lineupItemId === item.id) ? S.videoState : null
  const isPlaying = vs?.isPlaying ?? false
  const cur = vs?.currentTime ?? 0
  const dur = vs?.duration ?? 0
  const pct = dur > 0 ? (cur / dur) * 100 : 0
  const fmt = (s) => pad(Math.floor(s/60)) + ':' + pad(Math.floor(s%60))
  const name = item.title.replace(/^Video:\\s*/i, '')

  container.innerHTML =
    '<div id="media-panel">'
    + '<div class="media-thumb" style="background:#000"><span class="media-icon">▶</span></div>'
    + '<div class="media-info"><h2>' + esc(name) + '</h2>'
    + '<p style="font-size:11px;color:var(--muted)">' + fmt(cur) + ' / ' + fmt(dur) + '</p></div>'
    + '<div style="width:100%;max-width:340px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">'
    + '<div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:2px;transition:width .1s linear"></div>'
    + '</div>'
    + '<button class="btn-show" onclick="toggleVideo(' + S.activeLineupIdx + ')">'
    + (isPlaying ? '⏸ Pause' : '▶ Play') + '</button>'
    + '</div>'
}

function renderMusicPlayerPanel(container, item) {
  const as = (S.audioState?.lineupItemId === item.id) ? S.audioState : null
  const isPlaying = as?.isPlaying ?? false
  const cur = as?.currentTime ?? 0
  const dur = as?.duration ?? 0
  const pct = dur > 0 ? (cur / dur) * 100 : 0
  const fmt = (s) => pad(Math.floor(s/60)) + ':' + pad(Math.floor(s%60))
  // trackName is only set once something has actually played from this folder
  const name = as?.trackName || 'Nothing playing yet'
  const tracks = item.musicPlayerTracks || []

  let html = '<div style="display:flex;flex-direction:column;gap:14px;padding:12px 12px max(12px,var(--safe-bot))">'

  // Now-playing card
  html +=
    '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 16px;background:var(--surface);border:1px solid var(--border);border-radius:14px">'
    + '<div style="width:56px;height:56px;border-radius:12px;background:#000;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
    + '<span style="font-size:24px">' + (isPlaying ? '♫' : '♪') + '</span></div>'
    + '<div style="text-align:center;min-width:0;max-width:100%">'
    + '<h2 style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</h2>'
    + (as?.trackName
        ? '<p style="font-size:11px;color:var(--muted);margin-top:4px">' + fmt(cur) + ' / ' + fmt(dur) + '</p>'
        : '<p style="font-size:11px;color:var(--muted);margin-top:4px">' + esc(item.title) + '</p>')
    + '</div>'
    + '<div style="width:100%;max-width:280px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">'
    + '<div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:2px;transition:width .1s linear"></div>'
    + '</div>'
    + '<button class="btn-show" style="max-width:200px" onclick="toggleAudio(' + S.activeLineupIdx + ')">'
    + (isPlaying ? '⏸ Pause' : '▶ Play') + '</button>'
    + '</div>'

  // Track list — tap any track to play it directly
  if (tracks.length) {
    html +=
      '<div>'
      + '<div id="slides-title">Tracks (' + tracks.length + ')</div>'
      + '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">'
      + tracks.map((t, i) => {
          const active = as?.trackName === t
          return '<div class="lineup-item' + (active ? ' active' : '') + '"'
            + (i === tracks.length - 1 ? ' style="border-bottom:none"' : '')
            + ' onclick="selectTrack(' + S.activeLineupIdx + ',' + i + ')">'
            + '<div class="icon">' + (active && isPlaying ? '♫' : '♪') + '</div>'
            + '<div class="info"><div class="name">' + esc(t) + '</div></div>'
            + '</div>'
        }).join('')
      + '</div>'
      + '</div>'
  } else {
    html += '<p style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0">No tracks found — pick a folder on the main screen.</p>'
  }

  html += '</div>'
  container.innerHTML = html
}

function selectTrack(lineupIdx, trackIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  const track = (item.musicPlayerTracks || [])[trackIdx]
  if (!track) return
  cmd('audio-select', { lineupItemId: item.id, trackName: track })
}

function toggleVideo(lineupIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  const vs = S.videoState?.lineupItemId === item.id ? S.videoState : null
  const action = vs?.isPlaying ? 'video-pause' : 'video-play'
  cmd(action, { lineupItemId: item.id })
}

function toggleAudio(lineupIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  const as = S.audioState?.lineupItemId === item.id ? S.audioState : null
  const action = as?.isPlaying ? 'audio-pause' : 'audio-play'
  cmd(action, { lineupItemId: item.id })
}

function renderCountdownPanel(container, item) {
  const running = S.countdown?.running ?? false
  const cd = running ? computeCountdown() : computePreviewCountdown()
  const targetLabel = serviceTargetLabel()
  container.innerHTML =
    '<div id="countdown-panel">'
    + (targetLabel ? '<p style="font-size:12px;color:var(--muted);margin-bottom:6px;text-align:center">' + esc(targetLabel) + '</p>' : '')
    + '<div id="countdown-display" style="' + (!running ? 'opacity:.45' : '') + '">' + cd + '</div>'
    + '<button class="btn-countdown ' + (running ? 'running' : '') + '" onclick="toggleCountdown()">'
    + (running ? '■ Stop Countdown' : '▶ Start Countdown') + '</button>'
    + '</div>'
}

function serviceTargetLabel() {
  const date = S.serviceDate
  const time = S.serviceTime
  if (!date) return ''
  try {
    const d = new Date(date + 'T' + (time ?? '00:00') + ':00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

function computePreviewCountdown() {
  // Show how long until the service even when countdown isn't running
  const date = S.serviceDate
  const time = S.serviceTime
  if (!date || !time) return '--:--'
  const target = new Date(date + 'T' + time + ':00').getTime()
  if (isNaN(target)) return '--:--'
  const diff = Math.max(0, target - Date.now())
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0) return d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s)
  if (h > 0) return pad(h) + ':' + pad(m) + ':' + pad(s)
  return pad(m) + ':' + pad(s)
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
  if (isNaN(target)) return '00:00'
  const diff = Math.max(0, target - Date.now())
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0) return d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s)
  if (h > 0) return pad(h) + ':' + pad(m) + ':' + pad(s)
  return pad(m) + ':' + pad(s)
}

function toggleCountdown() {
  const action = S.countdown?.running ? 'countdown-stop' : 'countdown-start'
  cmd(action)
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function pad(n) { return String(n).padStart(2,'0') }
function typeIcon(t) {
  return {song:'♪',scripture:'✝',media:'🎬',countdown:'⏱',announcement:'📢',section:'—',music_player:'♫',bible:'✝',custom_text:'✎'}[t] ?? '•'
}
function typeLabel(t) {
  return {song:'Song',scripture:'Scripture',media:'Media',countdown:'Countdown',announcement:'Announcement',section:'Section',music_player:'Music Player',bible:'Bible Browser',custom_text:'Custom Text'}[t] ?? t
}

// ── Bible search ───────────────────────────────────────────────────────────
let B = { verses: [], translationLabel: '', projectedIdx: -1 }

function openBible() {
  document.getElementById('bible-sheet').classList.add('open')
  populateTranslationSelect('bible-trans')
  setTimeout(() => { const el = document.getElementById('bible-ref'); if (el) el.focus() }, 100)
}

// Shared translations list — fetched once and cached, then used to populate
// any <select> (the standalone Bible sheet, and the lineup Bible Browser widget).
let _bibleTranslationsCache = null

async function fetchBibleTranslationsData() {
  if (_bibleTranslationsCache) return _bibleTranslationsCache
  const r = await fetch('/controller/bible-translations')
  const data = await r.json()
  _bibleTranslationsCache = { translations: data.translations || [], commonAbbrevs: data.commonAbbrevs || [] }
  return _bibleTranslationsCache
}

async function populateTranslationSelect(selectId, preferredId, excludeIds, placeholder) {
  const sel = document.getElementById(selectId)
  if (!sel) return
  try {
    const data = await fetchBibleTranslationsData()
    const commonSet = new Set(data.commonAbbrevs)
    const excludeSet = new Set(excludeIds || [])
    const prevVal = preferredId || (placeholder ? '' : sel.value)
    sel.innerHTML = ''
    if (placeholder) {
      const opt = document.createElement('option')
      opt.value = ''
      opt.textContent = placeholder
      sel.appendChild(opt)
    }
    const pool = excludeSet.size ? data.translations.filter(function(t) { return !excludeSet.has(t.id) }) : data.translations
    const common = pool.filter(function(t) { return commonSet.has(t.label) })
    const others = pool.filter(function(t) { return !commonSet.has(t.label) })
    if (common.length) {
      const grp = document.createElement('optgroup')
      grp.label = 'Common'
      common.forEach(function(t) {
        const opt = document.createElement('option')
        opt.value = t.id
        opt.textContent = t.label
        grp.appendChild(opt)
      })
      sel.appendChild(grp)
    }
    if (others.length) {
      const grp = document.createElement('optgroup')
      grp.label = 'All Translations'
      others.forEach(function(t) {
        const opt = document.createElement('option')
        opt.value = t.id
        opt.textContent = t.label
        grp.appendChild(opt)
      })
      sel.appendChild(grp)
    }
    // Restore previous/preferred selection or pick first common (NIV/NIV11) —
    // unless there's a placeholder, which should stay selected until the
    // operator actually picks something (e.g. "+ Add translation").
    const allOpts = Array.from(sel.options)
    const match = allOpts.find(function(o) { return o.value === prevVal })
    if (match) { sel.value = prevVal }
    else if (!placeholder && common.length) { sel.value = common[0].id }
  } catch {}
}
function closeBible() {
  document.getElementById('bible-sheet').classList.remove('open')
}

async function searchBible() {
  const refEl = document.getElementById('bible-ref')
  const ref = (refEl.value || '').trim()
  if (!ref) { refEl.focus(); return }
  const translation = document.getElementById('bible-trans').value
  const goBtn = document.getElementById('bible-go')
  goBtn.disabled = true
  goBtn.textContent = '…'
  setBibleStatus('Searching…', false)
  B.verses = []
  B.projectedIdx = -1
  try {
    const r = await fetch('/controller/bible-search?ref=' + encodeURIComponent(ref) + '&translation=' + encodeURIComponent(translation))
    const data = await r.json()
    if (data.error) { setBibleStatus(data.error, true); return }
    const verses = data.verses || []
    if (!verses.length) { setBibleStatus('No verses found', true); return }
    B.verses = verses
    B.translationLabel = data.translationLabel || translation.toUpperCase()
    renderBibleVerses()
  } catch {
    setBibleStatus('Search failed — check your connection', true)
  } finally {
    goBtn.disabled = false
    goBtn.textContent = 'Search'
  }
}

function setBibleStatus(msg, isError) {
  const results = document.getElementById('bible-results')
  results.innerHTML = '<div id="bible-status' + (isError ? ' class="error"' : '') + '">' + esc(msg) + '</div>'
}

function renderBibleVerses() {
  const results = document.getElementById('bible-results')
  results.innerHTML = B.verses.map(function(v, i) {
    const ref = v.book_name + ' ' + v.chapter + ':' + v.verse
    const isLive = i === B.projectedIdx
    return '<div class="bv' + (isLive ? ' bv-live' : '') + '" id="bv-' + i + '">'
      + '<div class="bv-ref">' + esc(ref) + ' • ' + esc(B.translationLabel) + '</div>'
      + '<div class="bv-text">' + esc(v.text) + '</div>'
      + '<button class="bv-btn" onclick="projectVerse(' + i + ')">' + (isLive ? '⬤ Live' : 'Project') + '</button>'
      + '</div>'
  }).join('')
}

function projectVerse(idx) {
  const v = B.verses[idx]
  if (!v) return
  const reference = v.book_name + ' ' + v.chapter + ':' + v.verse
  B.projectedIdx = idx
  renderBibleVerses()
  requestAnimationFrame(function() {
    const el = document.getElementById('bv-' + idx)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
  cmd('project-scripture', { text: v.text, reference: reference, translationLabel: B.translationLabel })
}

// ── Bible Browser lineup widget ──────────────────────────────────────────────
// Unlike the standalone Bible sheet above (a one-off search-and-blast tool),
// this widget is the shared/synced session tied to a "Bible Browser" lineup
// item — search and projected-verse state round-trip through the desktop
// (see bibleBrowserState) so either device always sees what the other is doing.
// W holds the not-yet-submitted search box text/translation locally, so an
// unrelated re-render (someone else's audio state ticking, etc.) never wipes
// out what's mid-typed here — same reasoning as the B object above.
let W = { query: '', translationId: '' }
// Tracks the last projectedRef this panel auto-scrolled to, so a re-render
// triggered by something unrelated (another device's audioState tick, etc. —
// renderSlides() runs on every one of those) doesn't keep yanking scroll
// position back to the live verse; only an actual change in what's live does.
let _lastScrolledBibleRef = null

function renderBibleBrowserWidgetPanel(container, item) {
  const st = (S.bibleBrowserState && S.bibleBrowserState.lineupItemId === item.id) ? S.bibleBrowserState : null
  const verses = st ? st.verses : []
  const syncedQuery = st ? st.query : ''
  const query = W.query || syncedQuery || ''
  const loading = !!(st && st.loading)
  const error = st ? st.error : null
  const translationId = st ? st.translationId : (W.translationId || 'web')
  const translationLabel = st ? st.translationLabel : ''
  const projectedRef = st ? st.projectedRef : null
  const projectedTid = st ? st.projectedTranslationId : null
  const highlighted = st ? st.highlightedVerseNums : []
  const isChapterMode = highlighted.length > 0
  const compareIds = st ? st.compareIds : []
  const compareResults = st ? st.compareResults : {}
  const compareLoading = st ? st.compareLoading : []
  const recentScriptures = st ? st.recentScriptures : []

  let html = '<div style="display:flex;flex-direction:column;gap:10px;height:100%">'
    + '<form class="bw-form" onsubmit="event.preventDefault();searchBibleWidget(' + S.activeLineupIdx + ')">'
    + '<input class="bw-ref" id="bw-ref" type="text" placeholder="e.g. John 3:16 or Psalm 23" autocomplete="off" value="' + esc(query) + '" oninput="W.query=this.value">'
    + '<select class="bw-trans" id="bw-trans" onchange="W.translationId=this.value"><option value="web">WEB</option></select>'
    + '<button class="bw-go" type="submit"' + (loading ? ' disabled' : '') + '>' + (loading ? '…' : 'Search') + '</button>'
    + '</form>'

  // Recent passages — reference AND translation shown together on the chip
  // itself (not a hover title, since this is a touch UI), tapping re-searches it.
  if (recentScriptures.length) {
    html += '<div class="bw-recent-row">'
      + recentScriptures.slice(0, 10).map(function(r, ri) {
          const isActive = r.query === syncedQuery && r.translationId === translationId
          return '<button class="bw-recent-chip' + (isActive ? ' active' : '') + '" onclick="searchRecentWidget(' + S.activeLineupIdx + ',' + ri + ')">'
            + esc(r.reference) + '<span class="bw-recent-trans">' + esc(r.translationLabel) + '</span>'
            + '</button>'
        }).join('')
      + '</div>'
  }

  // Read Full Chapter / Jump to Verse — mirrors the desktop's own visibility rules
  const showReadChapter = !isChapterMode && syncedQuery.includes(':') && verses.length > 0
  if (showReadChapter || isChapterMode) {
    html += '<div class="bw-toolbar">'
    if (showReadChapter) {
      html += '<button class="bw-chapter-btn"' + (loading ? ' disabled' : '') + ' onclick="readChapterWidget(' + S.activeLineupIdx + ')">📖 Read Full Chapter</button>'
    }
    if (isChapterMode) {
      html += '<div class="bw-jump">'
        + '<input type="number" inputmode="numeric" id="bw-jump-input" placeholder="v#" onkeydown="if(event.keyCode===13)jumpToVerseWidget()">'
        + '<button type="button" onclick="jumpToVerseWidget()">Jump</button>'
        + '</div>'
    }
    html += '</div>'
  }

  // Compare translations — buttons pass an INDEX into compareIds, never the raw
  // translation id string, so nothing here ever needs to embed a quote character
  // inside an onclick="..." attribute (a prior version did, and it was fragile).
  html += '<div class="bw-compare-row"><span class="bw-compare-label">Compare</span>'
    + compareIds.map(function(cid, ci) {
        const isLoading = compareLoading.indexOf(cid) !== -1
        // While the fetch for this translation is still in flight, compareResults
        // has no entry for it yet — show "Loading…" instead of falling back to the
        // raw id (e.g. "78A9F612"), which reads as broken rather than as loading.
        const label = (compareResults[cid] && compareResults[cid].translationLabel) || (isLoading ? 'Loading…' : cid.toUpperCase())
        return '<span class="bw-chip">' + esc(label) + (isLoading ? ' ⋯' : '')
          + '<button onclick="removeCompareWidget(' + S.activeLineupIdx + ',' + ci + ')">×</button></span>'
      }).join('')
  if (compareIds.length < 3) {
    html += '<select id="bw-compare-add" class="bw-add-compare" onchange="addCompareWidget(' + S.activeLineupIdx + ',this)"></select>'
  }
  html += '</div>'

  // Verse list
  html += '<div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px">'
  if (error) {
    html += '<div id="bible-status" class="error">' + esc(error) + '</div>'
  } else if (!verses.length) {
    html += '<div id="bible-status">' + (loading ? 'Searching…' : 'Search for a passage — results are shared with the desktop.') + '</div>'
  } else {
    html += verses.map(function(v, i) {
      const ref = v.book_name + ' ' + v.chapter + ':' + v.verse
      const isLive = ref === projectedRef && (!projectedTid || projectedTid === translationId)
      const isSearched = isChapterMode && highlighted.indexOf(v.verse) !== -1
      const compareBlocks = compareIds.map(function(cid, ci) {
        const cr = compareResults[cid]
        const cv = cr && cr.verses[i]
        if (!cv) return ''
        const cLabel = (cr && cr.translationLabel) || cid.toUpperCase()
        const cIsLive = ref === projectedRef && projectedTid === cid
        return '<div class="bv-compare">'
          + '<div class="bv-ref">' + esc(cLabel) + (cIsLive ? ' • LIVE' : '') + '</div>'
          + '<div class="bv-text">' + esc(cv.text) + '</div>'
          + '<button class="bv-btn" onclick="projectBibleWidgetVerse(' + S.activeLineupIdx + ',' + v.verse + ',' + ci + ')">' + (cIsLive ? '⬤ Live' : 'Project') + '</button>'
          + '</div>'
      }).join('')
      return '<div class="bv' + (isLive ? ' bv-live' : '') + '" id="bwv-' + v.verse + '">'
        + '<div class="bv-ref">' + esc(ref) + ' • ' + esc(translationLabel) + (isSearched ? ' ★' : '') + '</div>'
        + '<div class="bv-text">' + esc(v.text) + '</div>'
        + '<button class="bv-btn" onclick="projectBibleWidgetVerse(' + S.activeLineupIdx + ',' + v.verse + ')">' + (isLive ? '⬤ Live' : 'Project') + '</button>'
        + compareBlocks
        + '</div>'
    }).join('')
  }
  html += '</div>'

  // Prev/Next verse — shown whenever something's projected and traversable
  if (projectedRef && verses.length) {
    const liveIdx = verses.findIndex(function(v) { return (v.book_name + ' ' + v.chapter + ':' + v.verse) === projectedRef })
    if (liveIdx !== -1) {
      const prevV = liveIdx > 0 ? verses[liveIdx - 1] : null
      const nextV = liveIdx < verses.length - 1 ? verses[liveIdx + 1] : null
      html += '<div class="bw-navbar">'
        + '<button class="bw-nav-btn" onclick="navigateVerseWidget(' + S.activeLineupIdx + ',-1)"' + (prevV ? '' : ' disabled') + '>'
        + '<span class="lbl">‹ Prev Verse</span><span class="ref">' + (prevV ? esc(prevV.book_name + ' ' + prevV.chapter + ':' + prevV.verse) : '—') + '</span>'
        + '</button>'
        + '<button class="bw-nav-btn next" onclick="navigateVerseWidget(' + S.activeLineupIdx + ',1)"' + (nextV ? '' : ' disabled') + '>'
        + '<span class="lbl">Next Verse ›</span><span class="ref">' + (nextV ? esc(nextV.book_name + ' ' + nextV.chapter + ':' + nextV.verse) : '—') + '</span>'
        + '</button>'
        + '</div>'
    }
  }

  html += '</div>'
  container.innerHTML = html
  populateTranslationSelect('bw-trans', W.translationId || translationId || undefined)
  if (compareIds.length < 3) {
    populateTranslationSelect('bw-compare-add', '', compareIds.concat([translationId]), '+ Add translation')
  }

  // Auto-scroll to the live verse whenever it actually changes — matches the
  // desktop's own Bible Browser, and covers projections made from either device.
  if (projectedRef !== _lastScrolledBibleRef) {
    _lastScrolledBibleRef = projectedRef
    const liveVerse = projectedRef ? verses.find(function(v) { return (v.book_name + ' ' + v.chapter + ':' + v.verse) === projectedRef }) : null
    if (liveVerse) {
      requestAnimationFrame(function() {
        const el = document.getElementById('bwv-' + liveVerse.verse)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }
}

function searchBibleWidget(lineupIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  const refEl = document.getElementById('bw-ref')
  const query = (refEl && refEl.value || '').trim()
  if (!query) { refEl && refEl.focus(); return }
  const transEl = document.getElementById('bw-trans')
  const translationId = (transEl && transEl.value) || W.translationId || 'web'
  W.query = query
  W.translationId = translationId
  cmd('bible-browser-search', { lineupItemId: item.id, query: query, translationId: translationId })
}

// recentIdx into bibleBrowserState.recentScriptures — reuses the same search
// command as the form, just with a remembered query+translation pair.
function searchRecentWidget(lineupIdx, recentIdx) {
  const item = S.lineup[lineupIdx]
  const st = S.bibleBrowserState
  if (!item || !st) return
  const r = st.recentScriptures[recentIdx]
  if (!r) return
  W.query = r.query
  W.translationId = r.translationId
  cmd('bible-browser-search', { lineupItemId: item.id, query: r.query, translationId: r.translationId })
}

function readChapterWidget(lineupIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  cmd('bible-browser-read-chapter', { lineupItemId: item.id })
}

function jumpToVerseWidget() {
  const input = document.getElementById('bw-jump-input')
  const n = parseInt(input && input.value, 10)
  if (isNaN(n)) return
  const el = document.getElementById('bwv-' + n)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (input) input.value = ''
}

function navigateVerseWidget(lineupIdx, delta) {
  const item = S.lineup[lineupIdx]
  const st = S.bibleBrowserState
  if (!item || !st || !st.projectedRef) return
  const verses = st.verses
  const liveIdx = verses.findIndex(function(v) { return (v.book_name + ' ' + v.chapter + ':' + v.verse) === st.projectedRef })
  if (liveIdx === -1) return
  const target = verses[liveIdx + delta]
  if (!target) return
  // No translationId — desktop continues whatever translation is currently live.
  cmd('bible-browser-project', { lineupItemId: item.id, verse: target.verse })
}

function addCompareWidget(lineupIdx, selectEl) {
  const translationId = selectEl && selectEl.value
  // This dropdown's own list (from /controller/bible-translations) already
  // resolved the correct abbreviation for this id — send it along so the
  // desktop doesn't have to re-derive it from its own separately-fetched list,
  // which can end up keeping a different id for the same translation.
  const opt = selectEl && selectEl.options[selectEl.selectedIndex]
  const label = opt ? opt.textContent : undefined
  if (selectEl) selectEl.value = ''
  if (!translationId) return
  const item = S.lineup[lineupIdx]
  if (!item) return
  cmd('bible-browser-compare', { lineupItemId: item.id, translationId: translationId, compareAction: 'add', label: label })
}

function removeCompareWidget(lineupIdx, compareIdx) {
  const item = S.lineup[lineupIdx]
  const st = S.bibleBrowserState
  if (!item || !st) return
  const translationId = st.compareIds[compareIdx]
  if (!translationId) return
  cmd('bible-browser-compare', { lineupItemId: item.id, translationId: translationId, compareAction: 'remove' })
}

// compareIdx omitted = project the primary translation's verse. Otherwise it's
// an index into bibleBrowserState.compareIds — never a raw translation id
// string, so this never needs to embed a quote inside an onclick="..." attribute.
function projectBibleWidgetVerse(lineupIdx, verseNum, compareIdx) {
  const item = S.lineup[lineupIdx]
  if (!item) return
  const st = S.bibleBrowserState
  const translationId = (compareIdx !== undefined && st) ? st.compareIds[compareIdx] : undefined
  cmd('bible-browser-project', { lineupItemId: item.id, verse: verseNum, translationId: translationId })
}

// ── Boot ───────────────────────────────────────────────────────────────────
// On wide screens the sidebar starts visible — reflect that in the button label
if (window.matchMedia('(min-width:680px)').matches) {
  document.getElementById('btn-lineup-toggle').textContent = '← Hide'
}
initPin()
connect()
</script>
</body>
</html>`
