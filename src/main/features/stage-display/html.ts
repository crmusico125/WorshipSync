export const STAGE_DISPLAY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Stage Display — WorshipSync</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080810;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100dvh;display:flex;flex-direction:column;overflow:hidden;user-select:none}

/* ── Top bar ── */
#top{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);min-height:52px;flex-shrink:0}
#song-title{font-size:13px;font-weight:600;color:#c4c4cc;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#section-badge{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:rgba(139,92,246,.18);color:#a78bfa;border:1px solid rgba(139,92,246,.3);border-radius:5px;padding:3px 9px;white-space:nowrap;flex-shrink:0;display:none}
#clock{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;letter-spacing:-.01em;flex-shrink:0;min-width:80px;text-align:right}

/* ── Current slide (large, ~60% height) ── */
#current-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 40px 20px;position:relative}
#lyrics{font-size:clamp(26px,5.5vw,72px);font-weight:700;line-height:1.35;text-align:center;color:#ffffff;letter-spacing:-.015em;max-width:960px;display:none}
#lyrics div{padding-bottom:.1em}
#empty{text-align:center;color:rgba(255,255,255,.18)}
#empty h2{font-size:18px;font-weight:600;margin-bottom:8px}
#empty p{font-size:13px;line-height:1.5}
#countdown-wrap{display:none;text-align:center}
#countdown{font-size:clamp(60px,15vw,140px);font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;font-family:'SF Mono','Fira Code','Fira Mono',monospace}
#countdown-label{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-top:10px}

/* ── Next slide ── */
#next-wrap{flex-shrink:0;border-top:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);display:none;flex-direction:column;transition:border-color .25s,background .25s,border-left-width .25s}
#next-header{display:flex;align-items:center;gap:6px;padding:8px 20px 2px;flex-wrap:wrap}
#next-label{font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.28);transition:color .2s}
#next-sep{font-size:9px;font-weight:700;color:rgba(255,255,255,.15);display:none}
#next-song-name{display:none;font-size:11px;font-weight:700;letter-spacing:.04em;color:#fbbf24}
#next-section{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(139,92,246,.7)}
#next-lyrics{padding:0 20px 14px;font-size:clamp(14px,2.2vw,28px);font-weight:500;line-height:1.45;text-align:center;color:rgba(255,255,255,.45);max-height:26vh;overflow:hidden;transition:color .2s}
#next-lyrics div{padding-bottom:.08em}
/* ── New song state ── */
#next-wrap.newsong{border-top:3px solid #fbbf24;border-left:4px solid #fbbf24;background:rgba(251,191,36,.08)}
#next-wrap.newsong #next-label{color:rgba(251,191,36,.6)}
#next-wrap.newsong #next-sep{display:inline;color:rgba(251,191,36,.3)}
#next-wrap.newsong #next-song-name{display:inline}
#next-wrap.newsong #next-section{color:rgba(251,191,36,.5)}
#next-wrap.newsong #next-lyrics{color:rgba(255,255,255,.35);font-size:clamp(12px,1.8vw,22px)}

/* ── Bottom bar ── */
#bottom{display:flex;align-items:center;justify-content:space-between;padding:8px 20px;border-top:1px solid rgba(255,255,255,.06);min-height:38px;flex-shrink:0}
#slide-pos{font-size:11px;color:rgba(255,255,255,.25);font-variant-numeric:tabular-nums}
#lag{font-size:10px;color:rgba(255,255,255,.18);font-variant-numeric:tabular-nums}
#dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite}
#dot.off{background:#ef4444;animation:none}

/* ── Blank overlay — scoped to lyrics area, not the full viewport ── */
#blank-overlay{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center}
#blank-overlay.on{opacity:1}
#blank-text{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.12)}

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
</style>
</head>
<body>

<div id="top">
  <div id="song-title">WorshipSync Stage Display</div>
  <div id="section-badge"></div>
  <div id="clock"></div>
</div>

<div id="current-wrap">
  <div id="empty"><h2>Waiting for slides…</h2><p>The stage display will update<br>when the operator advances slides.</p></div>
  <div id="lyrics"></div>
  <div id="countdown-wrap">
    <div id="countdown">00:00</div>
    <div id="countdown-label">Until Service Starts</div>
  </div>
  <!-- Blank overlay lives inside current-wrap so next/top/bottom remain visible -->
  <div id="blank-overlay"><div id="blank-text">Screen Blank</div></div>
</div>

<div id="next-wrap">
  <div id="next-header">
    <span id="next-label">Next</span>
    <span id="next-sep">·</span>
    <span id="next-song-name"></span>
    <span id="next-section"></span>
  </div>
  <div id="next-lyrics"></div>
</div>

<div id="bottom">
  <div id="slide-pos"></div>
  <div id="lag"></div>
  <div id="dot" class="off"></div>
</div>

<script>
var cdTimer=null,reconnTimer=null,clockTimer=null;
function $(id){return document.getElementById(id)}

// ── Clock ──
function tickClock(){
  var now=new Date();
  var h=now.getHours(),m=now.getMinutes();
  var ampm=h>=12?'PM':'AM';
  h=h%12||12;
  $('clock').textContent=h+':'+(m<10?'0':'')+m+' '+ampm;
}
tickClock();
setInterval(tickClock,5000);

// ── SSE ──
var es=null;
function connect(){
  if(es){try{es.onerror=null;es.close();}catch(e){}}
  clearTimeout(reconnTimer);
  es=new EventSource('/events');
  es.onopen=function(){$('dot').classList.remove('off');};
  es.onmessage=function(e){handle(JSON.parse(e.data))};
  es.onerror=function(){$('dot').classList.add('off');es.onerror=null;es.close();reconnTimer=setTimeout(connect,1000)};
}
// Reconnect immediately when the page becomes visible (e.g. after screen wake or app foreground)
document.addEventListener('visibilitychange',function(){
  if(!document.hidden&&(!es||es.readyState===2)){clearTimeout(reconnTimer);connect();}
});

// Update the "Next" panel.
// showSongTitle=true only when on the last slide — reveals the incoming song name.
// On earlier slides a new-song next is shown as plain "Next · Section" without spoiling.
function updateNext(nextLines,nextSectionLabel,showSongTitle){
  var wrap=$('next-wrap'),lyricsEl=$('next-lyrics'),nameEl=$('next-song-name'),secEl=$('next-section');
  if(!wrap||!lyricsEl) return;
  if(!nextLines||!nextLines.length){wrap.style.display='none';return;}
  wrap.style.display='flex';
  var rawIsNew=!!(nextSectionLabel&&nextSectionLabel.indexOf('—')!==-1);
  var isNew=!!showSongTitle&&rawIsNew;
  wrap.classList.toggle('newsong',isNew);
  if(isNew){
    var parts=nextSectionLabel.split('—');
    if(nameEl) nameEl.textContent=(parts[0]||'').trim();
    if(secEl)  secEl.textContent=(parts[1]||'').trim();
  } else {
    if(nameEl) nameEl.textContent='';
    var label=nextSectionLabel||'';
    if(label.indexOf('—')!==-1){label=(label.split('—')[1]||'').trim();}
    if(secEl) secEl.textContent=label;
  }
  // Hide lyrics preview when next is a different song but the blank slide isn't shown yet —
  // singers could mistake the incoming lyrics for the current song.
  if(rawIsNew&&!isNew){lyricsEl.innerHTML='';} else {
    lyricsEl.innerHTML=nextLines.map(function(l){return'<div>'+(l?esc(l):'&nbsp;')+'</div>'}).join('');
  }
}

function handle(ev){
  if(ev.sentAt){var lag=Date.now()-ev.sentAt;$('lag').textContent=lag+'ms';}
  if(ev.type==='init'){
    if(ev.slide)showSlide(ev.slide);
    if(ev.blank)setBlank(ev.blank);
    if(ev.countdown)doCountdown(ev.countdown);
    // Replay stageNext if blank is active — showSlide alone may not have the latest next lines
    if(ev.blank&&ev.nextLines&&ev.nextLines.length)updateNext(ev.nextLines,ev.nextSectionLabel,true);
  }
  else if(ev.type==='slide'){clearCD();showSlide(ev.payload);setBlank(false)}
  else if(ev.type==='blank'){setBlank(ev.isBlank)}
  else if(ev.type==='stageNext'){updateNext(ev.nextLines,ev.nextSectionLabel,true)}
  else if(ev.type==='countdown'){doCountdown(ev.data)}
  else if(ev.type==='shutdown'){
    clearTimeout(reconnTimer);
    if(es){es.onerror=null;es.close();}
    $('dot').classList.add('off');
    $('song-title').textContent='Stage display stopped';
    $('section-badge').style.display='none';
    $('lyrics').style.display='none';
    $('next-wrap').style.display='none';
    $('empty').style.display='block';
    $('empty').querySelector('h2').textContent='Stage display is off';
    $('empty').querySelector('p').textContent='The operator has stopped the stage display.';
  }
}

function showSlide(p){
  var lines=p.lines||[];
  $('empty').style.display='none';
  $('countdown-wrap').style.display='none';

  if(!lines.length){
    $('lyrics').style.display='none';
    $('empty').style.display='block';
  } else {
    $('lyrics').style.display='block';
    $('lyrics').innerHTML=lines.map(function(l){return'<div>'+(l?esc(l):'&nbsp;')+'</div>'}).join('');
  }

  // Song info
  $('song-title').textContent=(p.songTitle||'')+(p.artist?'  —  '+p.artist:'');
  var sec=p.sectionLabel||'';
  $('section-badge').textContent=sec;
  $('section-badge').style.display=sec?'inline-block':'none';

  // Slide counter
  $('slide-pos').textContent=(p.slideIndex!=null&&p.totalSlides!=null)?(p.slideIndex+1)+' / '+p.totalSlides:'';

  var isLast=p.totalSlides!=null&&p.slideIndex!=null&&p.slideIndex+1===p.totalSlides;
  updateNext(p.nextLines,p.nextSectionLabel,isLast);
}

function setBlank(b){$('blank-overlay').classList.toggle('on',!!b)}

function doCountdown(d){
  clearCD();
  $('empty').style.display='none';
  $('lyrics').style.display='none';
  $('next-wrap').style.display='none';
  $('countdown-wrap').style.display='block';
  $('song-title').textContent='Service Starting';
  $('section-badge').style.display='none';
  if(!d.running){$('countdown').textContent='00:00';return}
  var target=new Date(d.targetTime).getTime();
  function tick(){
    var diff=target-Date.now();
    if(diff<=0){$('countdown').textContent='Starting!';return}
    var m=Math.floor(diff/60000),s=Math.floor((diff%60000)/1000);
    $('countdown').textContent=pad(m)+':'+pad(s);
    cdTimer=setTimeout(tick,500);
  }
  tick();
}

function clearCD(){clearTimeout(cdTimer);cdTimer=null;$('countdown-wrap').style.display='none'}
function pad(n){return String(n).padStart(2,'0')}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

connect();
</script>
</body>
</html>`
