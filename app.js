/* BAJO EL CASCO — app de autoentrevistas
   Cámara frontal + pregunta sobreimpresa, grabada en el mismo video. */
'use strict';

const CATS = [
  ['Los comienzos', [
    '¿Cuál es tu primer recuerdo relacionado con un auto de rally?',
    '¿Te acordás de la primera vez que pensaste: «Yo quiero estar ahí»?',
    '¿Quién fue la primera persona que creyó que podías ser piloto?',
    '¿Qué sacrificaste para poder correr tu primera carrera?',
    '¿Qué le dirías hoy a ese chico o chica que soñaba con correr?',
    '¿Cuál fue la primera gran locura que hiciste por el rally?']],
  ['Lo que nadie ve', [
    '¿Alguna vez lloraste adentro de un auto de carrera?',
    '¿Qué sentís en esos segundos de silencio antes de largar un tramo?',
    '¿Cuál fue la derrota que más te enseñó?',
    '¿Qué es lo que tu familia nunca va a terminar de entender sobre tu pasión?',
    '¿Alguna vez terminaste una carrera y lo único que querías era abrazar a alguien?']],
  ['Historias y anécdotas', [
    'Contanos algo que te haya pasado en una carrera y que todavía nadie te crea.']],
  ['La familia y los afectos', [
    '¿Quién es la persona que más sufrió para que vos puedas correr?',
    '¿Hay alguien que ya no esté y que te gustaría que pudiera verte competir hoy?',
    '¿Qué persona te gustaría tener sentada a tu lado en una vuelta tranquila por un tramo?']],
  ['El rally desde adentro', [
    '¿Cómo le explicarías a alguien que nunca corrió lo que se siente al manejar al límite?']],
  ['El lado divertido', [
    '¿A quién jamás le prestarías tu auto?',
    '¿Qué es lo más supersticioso que hacés antes de largar?',
    'Si pudieras robarle una habilidad a otro piloto, ¿a quién elegirías y cuál sería?']],
  ['El legado', [
    '¿Qué te dio el rally que ninguna otra cosa en la vida pudo darte?',
    '¿Qué te quitó el rally?',
    '¿Qué carrera te gustaría poder vivir una vez más?',
    '¿Qué te gustaría que la gente recuerde de vos cuando dejes de correr?',
    'Completá esta frase: «Si no hubiera sido piloto, yo…»']],
  ['El encuentro', [
    'Si en este preciso instante tuvieras sentado frente a vos a ese chico o esa chica que soñaba con empezar a correr rally… ¿qué le dirías?']],
];
const QUESTIONS = [];
CATS.forEach(([cat, qs]) => qs.forEach(q => QUESTIONS.push({ n: QUESTIONS.length + 1, cat, q })));
const TOTAL = QUESTIONS.length;

const C = { bg: '#060606', ink: '#f2f0ec', blue: '#8cbde3', mute: '#bdbbb6', line: 'rgba(242,240,236,0.28)' };
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('bec_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bec_' + k, JSON.stringify(v)); } catch (e) {} },
};


/* ---------- estado ---------- */
const S = {
  cam: null, video: null, logo: null,
  W: 1080, H: 1920,
  q: null, t0: 0, raf: 0, running: false,
  ov: null, ovPrev: null, swapAt: 0,
  log: [], recs: [], maxTimer: 0, mime: '',
  last: null, urls: [],
};
const FADE = 0.45;
const MOBILE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad/i.test(navigator.userAgent);

/* ---------- utilidades ---------- */
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function message(title, text) { $('msgTitle').textContent = title; $('msgText').textContent = text; show('msg'); }
const pad = n => String(n).padStart(2, '0');
const fmt = sec => { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); };
const mb = n => (n / 1048576).toFixed(1) + ' MB';
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return '';
}
const extOf = m => (m && m.indexOf('mp4') >= 0) ? 'mp4' : 'webm';

/* ---------- mazo sin repetición ---------- */
function used() { const u = store.get('used', []); return Array.isArray(u) ? u.filter(n => n >= 1 && n <= TOTAL) : []; }
function updateRemaining() { $('remaining').textContent = (TOTAL - used().length) + ' de ' + TOTAL + ' preguntas disponibles'; }
function drawQuestion(excludeN) {
  let u = used();
  let pool = QUESTIONS.filter(x => u.indexOf(x.n) < 0 && x.n !== excludeN);
  if (!pool.length) { u = []; pool = QUESTIONS.filter(x => x.n !== excludeN); }
  const q = pool[Math.floor(Math.random() * pool.length)];
  u.push(q.n); store.set('used', u); updateRemaining();
  return q;
}

/* ---------- gráfica en canvas ---------- */
function spaced(ctx, text, x, y, sp, align) {
  const chars = [...text], ws = chars.map(ch => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  const prev = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + sp; });
  ctx.textAlign = prev; return total;
}
function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function fitText(ctx, text, maxW, maxLines, startPx, minPx, weight) {
  let px = startPx, lines;
  for (; px >= minPx; px -= 2) { ctx.font = `${weight} ${px}px BC, "Arial Narrow", sans-serif`; lines = wrap(ctx, text, maxW); if (lines.length <= maxLines) break; }
  return { px, lines };
}
function wave(ctx, x, yMid, h, color) {
  const hs = [4, 8, 13, 18, 11, 6, 15, 9, 4], k = h / 20; ctx.fillStyle = color;
  hs.forEach((v, i) => ctx.fillRect(x + i * 3.4 * k, yMid - v * k / 2, 1.8 * k, v * k)); return 30 * k;
}
function wordmark(ctx, x, y, px, waveColor) {
  ctx.fillStyle = C.ink; ctx.font = `700 ${px}px BC, sans-serif`;
  let w = spaced(ctx, 'BAJO', x, y, px * 0.1) + px * 0.35;
  w += wave(ctx, x + w, y - px * 0.36, px * 0.62, waveColor) + px * 0.35;
  ctx.fillStyle = C.ink; return w + spaced(ctx, 'EL CASCO', x + w, y, px * 0.1);
}
function makeCanvas(W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }

// capa fija de cada pregunta (look "Transmisión"): se dibuja una vez y se reutiliza en cada cuadro
const NAVY = '#0b1f33', CEL = '#74acdf';
const SK = Math.tan(12 * Math.PI / 180); // inclinación de los bloques (12°)
function skewBox(ctx, x, y, w, h, fill) {
  // paralelogramo inclinado hacia adelante, como skewX(-12deg) en CSS
  const d = h * SK / 2;
  ctx.beginPath();
  ctx.moveTo(x + d, y); ctx.lineTo(x + w + d, y); ctx.lineTo(x + w - d, y + h); ctx.lineTo(x - d, y + h);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function buildOverlay(q) {
  const W = S.W, H = S.H, k = W / 405, O = makeCanvas(W, H), c = O.getContext('2d');
  c.textBaseline = 'alphabetic';
  // degradés para que logos y zócalo se lean sobre cualquier fondo
  let g = c.createLinearGradient(0, 0, 0, 130 * k);
  g.addColorStop(0, 'rgba(11,31,51,0.65)'); g.addColorStop(1, 'rgba(11,31,51,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, 130 * k);
  g = c.createLinearGradient(0, H, 0, H - 260 * k);
  g.addColorStop(0, 'rgba(11,31,51,0.75)'); g.addColorStop(1, 'rgba(11,31,51,0)');
  c.fillStyle = g; c.fillRect(0, H - 260 * k, W, 260 * k);
  // logo Rally Argentino (prioritario) arriba a la izquierda, logo de la app a la derecha
  if (S.ra) {
    const w = 170 * k, h = w * S.ra.height / S.ra.width;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 8 * k; c.shadowOffsetY = 2 * k;
    c.drawImage(S.ra, 18 * k, 22 * k, w, h); c.restore();
  }

  // zócalo, de abajo hacia arriba
  const left = 18 * k, padX = 18 * k, padY = 13 * k;
  const panelW = W - left - 22 * k - 6 * k;
  const fb = fitText(c, q.q.toUpperCase(), panelW - padX * 2, 4, 30 * k, 20 * k, 'italic 900');
  const lineH = fb.px * 1.02;
  // fila inferior: barra celeste + firma
  const footY = H - 34 * k;
  skewBox(c, left + 10 * k, footY - 6 * k, 64 * k, 6 * k, CEL);
  c.font = `italic 800 ${13 * k}px BC, sans-serif`; c.fillStyle = '#ffffff';
  spaced(c, 'BAJO EL CASCO', left + 86 * k, footY + 1 * k, 1.8 * k);
  // panel blanco con la pregunta
  const panelH = padY * 2 + lineH * fb.lines.length;
  const py = footY - 16 * k - panelH, px = left + 6 * k;
  skewBox(c, px + 6 * k, py + 6 * k, panelW, panelH, 'rgba(11,31,51,0.6)');
  skewBox(c, px, py, panelW, panelH, '#ffffff');
  c.font = `italic 900 ${fb.px}px BC, sans-serif`; c.fillStyle = NAVY;
  let ty = py + padY + fb.px * 0.86;
  fb.lines.forEach(l => { c.fillText(l, px + padX, ty); ty += lineH; });
  // pestaña celeste con número y capítulo
  const kicker = (pad(q.n) + ' · ' + (q.n === TOTAL ? 'Pregunta especial' : q.cat)).toUpperCase();
  c.font = `italic 800 ${14 * k}px BC, sans-serif`;
  const sp = 2.2 * k, tw = [...kicker].reduce((a, ch) => a + c.measureText(ch).width + sp, 0);
  const tabH = 28 * k;
  skewBox(c, left, py - tabH, tw + 28 * k, tabH, CEL);
  c.fillStyle = NAVY; spaced(c, kicker, left + 14 * k, py - 9 * k, sp);
  // recortamos solo las franjas con gráfica: el centro queda libre y no se dibuja en cada cuadro
  const topH = Math.ceil(130 * k);
  const botY = Math.floor(Math.min(H - 260 * k, py - tabH - 6 * k));
  const band = (y, h) => { const b = makeCanvas(W, h); b.getContext('2d').drawImage(O, 0, y, W, h, 0, 0, W, h); return { c: b, y }; };
  return [band(0, topH), band(botY, H - botY)];
}
function drawFrame() {
  const ctx = S.ctx, W = S.W, H = S.H, v = S.video;
  if (!v || !v.videoWidth) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  else {
    const vr = v.videoWidth / v.videoHeight, cr = W / H; let sw, sh, sx, sy;
    if (vr > cr) { sh = v.videoHeight; sw = sh * cr; sx = (v.videoWidth - sw) / 2; sy = 0; }
    else { sw = v.videoWidth; sh = sw / cr; sx = 0; sy = (v.videoHeight - sh) / 2; }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, W, H); // sin espejar: los sponsors del buzo se leen derecho
  }
  const now = performance.now(), t = S.mode === 'rec' ? (now - S.t0) / 1000 : 0;
  if (S.ov) {
    const k = S.ovPrev ? Math.min(1, (now - S.swapAt) / 1000 / FADE) : 1;
    if (S.ovPrev && k < 1) { ctx.globalAlpha = 1 - k; S.ovPrev.forEach(b => ctx.drawImage(b.c, 0, b.y)); }
    else S.ovPrev = null;
    ctx.globalAlpha = k; S.ov.forEach(b => ctx.drawImage(b.c, 0, b.y)); ctx.globalAlpha = 1;
  }
  // el reloj NO se graba: se muestra solo en pantalla (HTML)
  const sec = Math.floor(t);
  if (S.mode === 'rec' && S.timerEl && sec !== S.lastSec) { S.lastSec = sec; S.timerEl.textContent = fmt(t); }
}
// 30 cuadros por segundo alcanzan (la cámara entrega 30): no dibujamos de más
let lastDraw = 0;
function loop(now) {
  if (!S.running) return;
  if (!now || now - lastDraw >= 31) { lastDraw = now || performance.now(); drawFrame(); }
  S.raf = requestAnimationFrame(loop);
}

/* ---------- cámara ---------- */
async function openCamera() {
  if (S.cam && S.cam.getVideoTracks().some(t => t.readyState === 'live')) return;
  if (!window.isSecureContext) throw Object.assign(new Error('https'), { code: 'https' });
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('nomedia'), { code: 'nomedia' });
  const res = S.W >= 1080 ? { width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1280 }, height: { ideal: 720 } };
  const video = Object.assign({ facingMode: 'user', frameRate: { ideal: 30, max: 30 } }, res);
  try {
    S.cam = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
      try { S.cam = await navigator.mediaDevices.getUserMedia({ video }); }
      catch (e2) { throw Object.assign(new Error('denied'), { code: 'denied' }); }
    } else throw Object.assign(new Error(e && e.name || 'cam'), { code: 'cam' });
  }
  if (!S.video) {
    S.video = document.createElement('video'); S.video.muted = true; S.video.playsInline = true; S.video.setAttribute('playsinline', '');
    // en iPhone el video tiene que estar en la página para que entregue cuadros con fluidez
    S.video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none';
    document.body.appendChild(S.video);
  }
  S.video.srcObject = S.cam;
  await S.video.play().catch(() => {});
  await new Promise(r => { if (S.video.videoWidth) r(); else S.video.onloadedmetadata = () => r(); setTimeout(r, 2500); });
}
function closeCamera() {
  if (S.cam) S.cam.getTracks().forEach(t => t.stop());
  S.cam = null; if (S.video) S.video.srcObject = null; releaseWake();
}
let wakeLock = null;
async function keepAwake() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseWake() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }

/* ---------- grabación ---------- */
function startRecorder(stream, kind, mime) {
  const opts = { videoBitsPerSecond: S.W >= 1080 ? 8000000 : 4500000, audioBitsPerSecond: 128000 };
  if (mime) opts.mimeType = mime;
  let rec; try { rec = new MediaRecorder(stream, opts); } catch (e) { rec = new MediaRecorder(stream); }
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' })); });
  rec.start(1000);
  return { rec, kind, done };
}
let busy = false;
// paso 1: se enciende la cámara y aparece la pregunta, SIN grabar todavía
function setMode(m) {
  S.mode = m; const rec = m === 'rec';
  $('readyPill').hidden = rec; $('recPill').hidden = !rec;
  $('recBtn').hidden = rec; $('finishBtn').hidden = !rec; $('cancelBtn').hidden = rec;
  $('reaskLabel').textContent = rec ? 'Preguntar de nuevo' : 'Otra pregunta';
}
async function start() {
  if (busy) return; busy = true;
  try {
    readSettings();
    await openCamera(); keepAwake();
    S.q = drawQuestion();
    S.ov = buildOverlay(S.q); S.ovPrev = null;
    setMode('ready');
    show('rec');
    S.running = true; loop();
  } catch (e) { fail(e); }
  busy = false;
}
// paso 2: el piloto ya leyó la pregunta y toca Comenzar -> empieza la grabación
async function record() {
  if (busy || S.mode !== 'ready') return; busy = true;
  try {
    S.log = [{ n: S.q.n, t: 0 }];
    S.t0 = performance.now(); S.lastSec = -1;
    setMode('rec');
    const cv = $('stage');
    if (!cv.captureStream) throw Object.assign(new Error('capture'), { code: 'nomedia' });
    const comp = cv.captureStream(30);
    const audio = S.cam.getAudioTracks()[0]; if (audio) comp.addTrack(audio);
    const mime = pickMime();
    S.recs = [startRecorder(comp, 'comp', mime)];
    if ($('optClean').checked) S.recs.push(startRecorder(S.cam, 'clean', mime));
    S.mime = S.recs[0].rec.mimeType || mime;
    const max = +$('optMax').value; clearTimeout(S.maxTimer);
    if (max) S.maxTimer = setTimeout(finish, max * 1000);
  } catch (e) { fail(e); }
  busy = false;
}
// cambia la pregunta sin cortar la grabación
function reask() {
  if (!S.running || !S.q) return;
  const q = drawQuestion(S.q.n);
  S.ovPrev = S.ov; S.ov = buildOverlay(q); S.swapAt = performance.now(); S.q = q;
  if (S.mode === 'rec') S.log.push({ n: q.n, t: (performance.now() - S.t0) / 1000 });
}
function cancel() {
  if (S.mode !== 'ready') return;
  S.running = false; cancelAnimationFrame(S.raf); closeCamera(); show('welcome');
}
async function finish() {
  if (busy || !S.recs.length) return; busy = true;
  clearTimeout(S.maxTimer);
  const duration = (performance.now() - S.t0) / 1000;
  const recs = S.recs; S.recs = [];
  recs.forEach(r => { try { if (r.rec.state !== 'inactive') r.rec.stop(); } catch (e) {} });
  const out = {}; for (const r of recs) out[r.kind] = await r.done;
  S.running = false; cancelAnimationFrame(S.raf); S.mode = null;
  closeCamera();
  const take = { id: Date.now(), at: new Date().toISOString(), duration, log: S.log.slice(), mime: S.mime, comp: out.comp || null, clean: out.clean || null };
  S.last = take;
  // se guarda en la app (Mis videos) en paralelo
  const stored = db.put(take).then(() => true, e => { console.error(e); return false; });
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  showDone(take, true);
  busy = false;
  // y se guarda solo en el teléfono, sin tocar nada más (lo antes posible, mientras vale el toque de "Terminar")
  if ($('optAuto').checked) autoSave(take);
  const ok = await stored;
  if (!ok) { const st = $('doneStatus'); st.className = 'status'; st.textContent = 'No se pudo guardar en la app. Pasalo a la galería antes de salir.'; }
  refreshCount();
}
const IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function autoSave(take) {
  const st = $('doneStatus'), blob = take.comp; if (!blob) return;
  const name = fileName(take, 'comp');
  if (IOS) {
    // Safari solo guarda en Fotos a través del menú de compartir
    const file = new File([blob], name, { type: blob.type || 'video/mp4' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Bajo el Casco' });
        st.className = 'status ok'; st.textContent = 'Video guardado. También quedó en Mis videos.';
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') { st.className = 'status'; st.textContent = 'No se guardó en Fotos. Quedó en Mis videos; podés pasarlo con «A la galería».'; return; }
    }
    st.className = 'status'; st.textContent = 'Tocá «A la galería» y elegí «Guardar video».';
    return;
  }
  // Android y computadora: descarga automática
  const u = URL.createObjectURL(blob); S.urls.push(u);
  const a = document.createElement('a'); a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  st.className = 'status ok'; st.textContent = 'Video guardado en Descargas. También quedó en Mis videos.';
}

/* ---------- guardado local (IndexedDB) ---------- */
const db = {
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open('bajo-el-casco', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('takes', { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async tx(mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction('takes', mode), st = t.objectStore('takes'); const r = fn(st);
      t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  put(x) { return this.tx('readwrite', s => s.put(x)); },
  all() { return this.tx('readonly', s => s.getAll()); },
  get(id) { return this.tx('readonly', s => s.get(id)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
};
async function refreshCount() {
  try { const a = await db.all(); $('libCount').textContent = a.length ? '(' + a.length + ')' : ''; } catch (e) {}
}

/* ---------- pantalla de guardado ---------- */
function clearUrls() { S.urls.forEach(u => URL.revokeObjectURL(u)); S.urls = []; }
function showDone(take, saved) {
  S.last = take; // "A la galería" exporta el video que se está viendo
  clearUrls();
  const pb = $('playback');
  if (take.comp) { const u = URL.createObjectURL(take.comp); S.urls.push(u); pb.src = u; } else pb.removeAttribute('src');
  $('exportCleanBtn').hidden = !take.clean;
  $('doneActs').style.gridTemplateColumns = take.clean ? '1fr 1fr' : '1fr';
  const st = $('doneStatus');
  st.className = 'status' + (saved ? ' ok' : '');
  st.textContent = saved
    ? `Guardado en este dispositivo · ${fmt(take.duration)} · ${take.log.length} pregunta${take.log.length > 1 ? 's' : ''} · ${mb(take.comp ? take.comp.size : 0)}`
    : 'No se pudo guardar en el dispositivo. Pasalo a la galería antes de salir.';
  show('done');
}

/* ---------- exportar a la galería ---------- */
function fileName(take, kind) {
  const d = new Date(take.at);
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const qs = take.log.map(x => 'P' + pad(x.n)).join('-');
  return `BajoElCasco_${stamp}_${qs}${kind === 'clean' ? '_limpio' : ''}.${extOf(take.mime)}`;
}
async function exportTake(take, kind, statusEl) {
  const blob = take[kind]; if (!blob) return;
  const name = fileName(take, kind);
  const file = new File([blob], name, { type: blob.type || 'video/mp4' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Bajo el Casco' });
      if (statusEl) statusEl.textContent = 'Listo. En iPhone elegí «Guardar video».';
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { if (statusEl) statusEl.textContent = 'Cancelado.'; return; }
  }
  const u = URL.createObjectURL(blob); S.urls.push(u);
  const a = document.createElement('a'); a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  if (statusEl) statusEl.textContent = 'Descargado: ' + name;
}

/* ---------- mis videos ---------- */
async function openLib() {
  show('lib');
  const ul = $('libList'); ul.textContent = '';
  let items = [];
  try { items = (await db.all()).sort((a, b) => b.id - a.id); } catch (e) { $('libStatus').textContent = 'No se pudo leer el almacenamiento.'; return; }
  if (!items.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Todavía no hay participaciones guardadas.'; ul.appendChild(li); return; }
  let total = 0;
  items.forEach(it => {
    total += (it.comp ? it.comp.size : 0) + (it.clean ? it.clean.size : 0);
    const li = document.createElement('li');
    const qs = document.createElement('div'); qs.className = 'qs';
    qs.textContent = it.log.map(x => 'Pregunta ' + pad(x.n)).join(' · ');
    const meta = document.createElement('div'); meta.className = 'meta';
    const d = new Date(it.at);
    const m1 = document.createElement('span'); m1.textContent = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' · ' + fmt(it.duration);
    const m2 = document.createElement('span'); m2.textContent = mb((it.comp ? it.comp.size : 0) + (it.clean ? it.clean.size : 0));
    meta.append(m1, m2);
    const acts = document.createElement('div'); acts.className = 'acts';
    const mk = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; acts.appendChild(b); };
    mk('Ver', () => showDone(it, true));
    mk('A la galería', () => exportTake(it, 'comp', $('libStatus')));
    if (it.clean) mk('Limpia', () => exportTake(it, 'clean', $('libStatus')));
    mk('Borrar', async () => {
      if (!confirm('¿Borrar esta participación del dispositivo? Si no la pasaste a la galería, se pierde.')) return;
      await db.del(it.id); refreshCount(); openLib();
    }, 'del');
    li.append(qs, meta, acts); ul.appendChild(li);
  });
  $('libStatus').textContent = items.length + ' guardada' + (items.length > 1 ? 's' : '') + ' en este dispositivo · ' + mb(total);
}

/* ---------- errores ---------- */
function fail(e) {
  console.error(e);
  S.running = false; cancelAnimationFrame(S.raf);
  S.recs.forEach(r => { try { r.rec.stop(); } catch (x) {} }); S.recs = [];
  const code = e && e.code;
  if (code === 'https') message('Falta conexión segura', 'La cámara solo funciona desde una dirección https. Abrí la app desde su link publicado.');
  else if (code === 'denied') message('Sin acceso a la cámara', 'Habilitá la cámara y el micrófono para este sitio en los ajustes del navegador y volvé a intentar.');
  else if (code === 'nomedia') message('Navegador no compatible', 'Este navegador no permite grabar video. Probá con Safari actualizado en iPhone o Chrome en Android.');
  else message('No se pudo abrir la cámara', 'Cerrá otras apps que estén usando la cámara y volvé a intentar.');
  closeCamera();
}

/* ---------- ajustes ---------- */
function readSettings() {
  S.W = $('optRes').value === '720' ? 720 : 1080; S.H = Math.round(S.W * 16 / 9);
  const cv = $('stage'); if (cv.width !== S.W) { cv.width = S.W; cv.height = S.H; }
  store.set('opts2', { auto: $('optAuto').checked, clean: $('optClean').checked, res: $('optRes').value, max: $('optMax').value });
}
function loadSettings() {
  const o = store.get('opts2', null);
  if (!o) { // valores por defecto según el equipo
    $('optRes').value = MOBILE ? '720' : '1080';
    $('optClean').checked = !MOBILE;
    return;
  }
  $('optAuto').checked = o.auto !== false;
  $('optClean').checked = !!o.clean; $('optRes').value = o.res || (MOBILE ? '720' : '1080'); $('optMax').value = o.max || '0';
}

/* ---------- arranque ---------- */
function init() {
  S.ctx = $('stage').getContext('2d', { alpha: false });
  S.timerEl = $('timer');
  loadSettings(); updateRemaining(); refreshCount();
  const img = new Image(); img.onload = () => { S.logo = img; }; img.src = 'logo.png';
  const ra = new Image(); ra.onload = () => { S.ra = ra; }; ra.src = 'ra.png';
  if (document.fonts) ['700', '800', 'italic 800', 'italic 900'].forEach(w => document.fonts.load(`${w} 40px BC`).catch(() => {}));
  $('startBtn').onclick = start;
  $('reaskBtn').onclick = reask;
  $('recBtn').onclick = record;
  $('cancelBtn').onclick = cancel;
  $('finishBtn').onclick = finish;
  $('exportBtn').onclick = () => S.last && exportTake(S.last, 'comp', $('doneStatus'));
  $('exportCleanBtn').onclick = () => S.last && exportTake(S.last, 'clean', $('doneStatus'));
  $('againBtn').onclick = () => { clearUrls(); $('playback').removeAttribute('src'); show('welcome'); };
  $('toLibBtn').onclick = openLib;
  $('libBtn').onclick = openLib;
  $('libBack').onclick = () => show('welcome');
  $('msgBtn').onclick = () => show('welcome');
  $('settingsBtn').onclick = () => { const h = $('settings').hidden = !$('settings').hidden; $('settingsBtn').setAttribute('aria-expanded', String(!h)); };
  ['optAuto', 'optClean', 'optRes', 'optMax'].forEach(id => $(id).onchange = readSettings);
  $('resetBtn').onclick = () => { if (confirm('¿Reiniciar el mazo? Las 25 preguntas vuelven a estar disponibles.')) { store.set('used', []); updateRemaining(); } };
  // si la app pasa a segundo plano, se cierra y guarda lo grabado
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (S.recs.length) finish(); else if (S.mode === 'ready') cancel();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();

window.__bec = { S, start, finish, reask, db, QUESTIONS };
