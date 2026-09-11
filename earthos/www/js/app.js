/* EarthOS — application logic: impact model, UI, timeline, scenarios, inspector, AI features, fold postures. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ═══════════════════ 1. State & model ═══════════════════ */
const BASE_YEAR = new Date().getFullYear(), HORIZON = 50;
const GT = { temp: 1.2, sea: 0, forest: 31, grid: 5 };
const S = { ...GT };
const T = { year: 0, playing: false, speed: 1 };
const layers = { currents: true, climate: false, supply: true, carbon: false, clouds: true, realsun: true, hires: true };

const materialised = y => 0.3 + 0.7 * (y / HORIZON);
function effective(s, y) {
  const m = materialised(y);
  return { m, temp: s.temp * m, sea: s.sea * m, forestDeficit: Math.max(0, GT.forest - s.forest) * m, forestGain: Math.max(0, s.forest - GT.forest) * m, grid: s.grid * m,
    forest: GT.forest - Math.max(0, GT.forest - s.forest) * m + Math.max(0, s.forest - GT.forest) * m };
}
function impacts(s, y) {
  const e = effective(s, y), excess = Math.max(0, e.temp - 1.0);
  const displacement = 14 * Math.pow(e.sea, 1.25) + 30 * Math.pow(excess, 1.5) + 0.8 * e.forestDeficit + 0.5 * e.grid;
  const arable = clamp(2.5 * Math.pow(excess, 1.6) + 1.2 * e.sea + 0.3 * e.forestDeficit + 0.15 * e.grid, 0, 100);
  const bio = clamp(100 - 12 * Math.pow(excess, 1.3) - 3.5 * e.sea - 0.9 * e.forestDeficit + 0.4 * e.forestGain - 0.25 * e.grid, 0, 100);
  const coastal = 55 * Math.pow(e.sea, 1.1) + 4 * Math.max(0, e.temp - 1.2);
  const lanes = Math.round(100 - 90 * e.grid / 100);
  return { e, excess, displacement, arable, bio, coastal, lanes };
}
const EVENTS = [
  { id: 'paris',  cls: 'warn', test: e => e.temp >= 1.5, text: 'Paris threshold breached (+1.5°C sustained)' },
  { id: 'coral',  cls: 'warn', test: e => e.temp >= 2.0, text: 'Tropical coral systems: >90% bleaching' },
  { id: 'perma',  cls: 'crit', test: e => e.temp >= 2.5, text: 'Permafrost carbon feedback engaged' },
  { id: 'amazon', cls: 'crit', test: e => e.temp >= 3.0, text: 'Amazon dieback cascade initiated' },
  { id: 'wetbulb',cls: 'crit', test: e => e.temp >= 4.0, text: 'Wet-bulb 35°C zones expanding — uninhabitable belts' },
  { id: 'atoll',  cls: 'warn', test: e => e.sea >= 0.5, text: 'Low-lying atolls: first permanent evacuations' },
  { id: 'delta',  cls: 'warn', test: e => e.sea >= 1.0, text: 'Delta megacities: annual inundation (Dhaka, Lagos, Jakarta)' },
  { id: 'coast',  cls: 'crit', test: e => e.sea >= 3.0, text: 'Coastal retreat: 300M+ inside the 100-yr flood plain' },
  { id: 'cities', cls: 'crit', test: e => e.sea >= 6.0, text: 'Shanghai, Miami, Alexandria below mean sea level' },
  { id: 'sink',   cls: 'warn', test: (e, s) => s.forest <= 20, text: 'Canopy below 20% — terrestrial carbon sink inverted' },
  { id: 'biodiv', cls: 'crit', test: (e, s) => s.forest <= 10, text: 'Terrestrial biodiversity collapse' },
  { id: 'regrow', cls: 'ok',   test: (e, s) => s.forest >= 45, text: 'Reforestation regime: net carbon sink expanding' },
  { id: 'grid1',  cls: 'warn', test: e => e.grid >= 30, text: 'Regional grid cascade failures' },
  { id: 'grid2',  cls: 'crit', test: e => e.grid >= 60, text: 'Supply-chain fragmentation: 40% of trade lanes offline' },
  { id: 'grid3',  cls: 'crit', test: e => e.grid >= 85, text: 'Systemic grid collapse — critical infrastructure dark' },
];
function tippingPoints(s) {
  const out = [];
  for (const ev of EVENTS) { if (ev.cls === 'ok') continue; for (let y = 0; y <= HORIZON; y += 0.5) if (ev.test(effective(s, y), s)) { out.push({ year: y, ev }); break; } }
  return out;
}
const PRESETS = [
  { n: 'Ground Truth', d: 'Current observations, no intervention.', p: GT },
  { n: 'Paris Aligned', d: 'Rapid decarbonisation, canopy restored.', p: { temp: 1.5, sea: 0.4, forest: 36, grid: 5 } },
  { n: 'Business as Usual', d: 'Current policies, slow drift.', p: { temp: 2.8, sea: 0.8, forest: 26, grid: 15 } },
  { n: 'Hothouse Earth', d: 'Feedbacks engaged, WAIS destabilised.', p: { temp: 4.5, sea: 3, forest: 18, grid: 40 } },
  { n: 'Systemic Collapse', d: 'Compound failure across all systems.', p: { temp: 5, sea: 6, forest: 10, grid: 85 } },
  { n: 'Regeneration', d: 'Drawdown plus mass reforestation.', p: { temp: 1.3, sea: 0.3, forest: 48, grid: 3 } },
];
const fmt = { temp: v => `+${v.toFixed(1)}°C`, sea: v => `${v.toFixed(1)} m`, forest: v => `${Math.round(v)}%`, grid: v => `${Math.round(v)}%` };

/* ═══════════════════ 2. Globe boot ═══════════════════ */
let earth;
let hiresErrAt = 0;
function boot() {
  earth = EOS.Earth.create($('viewport'), {
    onProgress(msg, frac) { $('boot-status').textContent = msg; $('boot-bar').style.width = Math.round(frac * 100) + '%'; },
    onTap: (ll) => openInspector(ll),
    onHover: (ll) => { if (ll) $('hud-coords').textContent = `LAT ${ll.lat.toFixed(2).padStart(6, '0')} · LON ${ll.lon.toFixed(2).padStart(7, '0')}`; },
    onHiresState(state, info) {
      const chip = document.querySelector('.chip[data-layer=hires]');
      chip.classList.toggle('busy', state === 'loading');
      if (state === 'ready') $('hud-src').textContent = info;
      if (state === 'error' && Date.now() - hiresErrAt > 30000) { hiresErrAt = Date.now(); toast(`<b>Hi-res imagery unavailable.</b> ${escapeHtml(info || '')}`); }
    },
  });
  earth.load().then(() => {
    $('boot-status').textContent = 'Twin online.';
    setTimeout(() => $('boot').classList.add('done'), 350);
    addLog('ok', BASE_YEAR, earth.state.dayLoaded ? 'NASA Blue Marble / Black Marble / GEBCO layers mounted' : 'Imagery missing — procedural fallback active');
  });
  applySettingsToEarth();
  earth.setLayers(layers);
  refresh(); repaintGlobe();
}

/* ═══════════════════ 3. Controls ═══════════════════ */
const sliders = { temp: $('s-temp'), sea: $('s-sea'), forest: $('s-forest'), grid: $('s-grid') };
function setRangeProgress(inp) { inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min) * 100) + '%'); }
for (const k in sliders) {
  const inp = sliders[k];
  inp.addEventListener('input', () => { S[k] = parseFloat(inp.value); setRangeProgress(inp); $('o-' + k).textContent = fmt[k](S[k]); refresh(); });
  setRangeProgress(inp);
}
function setScenario(p, label) {
  for (const k in sliders) { if (p[k] !== undefined) S[k] = clamp(+p[k], +sliders[k].min, +sliders[k].max); sliders[k].value = S[k]; setRangeProgress(sliders[k]); $('o-' + k).textContent = fmt[k](S[k]); }
  refresh(); if (label) toast(`<b>${escapeHtml(label)}</b> loaded · T ${fmt.temp(S.temp)} / SLR ${fmt.sea(S.sea)} / canopy ${fmt.forest(S.forest)} / grid ${fmt.grid(S.grid)}`);
}
function repaintGlobe() {
  const e = effective(S, T.year);
  earth.setParams({ sea: e.sea, temp: e.temp, forest: e.forest, grid: e.grid });
}

/* tabs */
$$('.tabs .tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.closest('.side'), tab.dataset.tab)));
function switchTab(panel, name) {
  $$('.tab', panel).forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $$('.tabpage', panel).forEach(p => p.classList.toggle('on', p.dataset.page === name));
}

/* layer chips */
$$('.chip').forEach(ch => ch.addEventListener('click', () => {
  const k = ch.dataset.layer; layers[k] = !layers[k]; ch.classList.toggle('on', layers[k]);
  earth.setLayers({ [k]: layers[k] });
  $('hud-layer').textContent = `${['currents', 'climate', 'supply', 'carbon', 'clouds'].filter(x => layers[x]).length} LAYERS`;
}));

/* mobile nav */
$$('#nav button').forEach(b => b.addEventListener('click', () => {
  const target = b.dataset.target, el = $(target), wasOpen = el.classList.contains('open') && (!b.dataset.subtab || $('impact').querySelector('.tab.on').dataset.tab === b.dataset.subtab);
  $$('.side, #timeline').forEach(x => x.classList.remove('open'));
  $$('#nav button').forEach(x => x.classList.remove('on'));
  if (!wasOpen) { el.classList.add('open'); b.classList.add('on'); if (b.dataset.subtab) switchTab(el, b.dataset.subtab); else if (target === 'impact') switchTab(el, 'matrix'); }
}));
if (innerWidth < 720) { $('timeline').classList.add('open'); document.querySelector('#nav button[data-target=timeline]').classList.add('on'); }

/* timeline */
$('s-year').addEventListener('input', e => { T.year = parseFloat(e.target.value); refresh(); });
$('play').addEventListener('click', () => setPlaying(!T.playing));
function setPlaying(p) { T.playing = p; $('play').textContent = p ? '❚❚' : '▶'; if (p && T.year >= HORIZON - 0.01) T.year = 0; refresh(); }
$$('.speed button').forEach(b => b.addEventListener('click', () => { $$('.speed button').forEach(x => x.classList.remove('on')); b.classList.add('on'); T.speed = +b.dataset.speed; refresh(); }));

/* run / reset */
$('run').addEventListener('click', () => {
  const btn = $('run'); btn.classList.add('busy'); btn.textContent = 'Computing macro state…';
  const end = impacts(S, HORIZON);
  setTimeout(() => {
    btn.classList.remove('busy'); btn.textContent = '▶ Run Macro Simulation';
    T.year = 0; T.speed = Math.max(T.speed, 5); $$('.speed button').forEach(x => x.classList.toggle('on', +x.dataset.speed === T.speed));
    setPlaying(true);
    toast(`<b>Macro simulation armed.</b> Horizon ${BASE_YEAR + HORIZON}: displacement ${end.displacement.toFixed(0)}M · arable deficit ${end.arable.toFixed(0)}% · biosphere ${Math.round(end.bio)}/100 · ${tippingPoints(S).length} tipping points.`);
    addLog('warn', BASE_YEAR, `Macro simulation started · T ${fmt.temp(S.temp)} / SLR ${fmt.sea(S.sea)} / canopy ${fmt.forest(S.forest)} / grid ${fmt.grid(S.grid)}`);
  }, 900);
});
$('reset').addEventListener('click', () => { T.year = 0; setPlaying(false); setScenario(GT); addLog('ok', BASE_YEAR, 'Reset to ground truth telemetry'); toast('<b>Ground truth restored.</b>'); });

/* presets & saved scenarios */
const SAVE_KEY = 'eos.scenarios.v1';
function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch (e) { return []; } }
function storeSaved(list) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ } }
function renderPresets() {
  $('presets').innerHTML = PRESETS.map((p, i) => `<button class="preset" data-i="${i}"><b>${p.n}</b><span>${p.d}</span><span class="p">${fmt.temp(p.p.temp)} · ${fmt.sea(p.p.sea)} · ${fmt.forest(p.p.forest)} · ${fmt.grid(p.p.grid)}</span></button>`).join('');
  $$('.preset').forEach(b => b.addEventListener('click', () => setScenario(PRESETS[+b.dataset.i].p, PRESETS[+b.dataset.i].n)));
}
function renderSaved() {
  const list = loadSaved();
  $('saved').innerHTML = list.length ? list.map((s, i) => `<li><b>${escapeHtml(s.name)}</b><span class="mono muted">${fmt.temp(s.S.temp)}·${fmt.sea(s.S.sea)}</span><button data-i="${i}" class="ld">Load</button><button data-i="${i}" class="del">✕</button></li>`).join('') : '<li class="muted">No saved scenarios yet.</li>';
  $$('#saved .ld').forEach(b => b.addEventListener('click', () => { const s = loadSaved()[+b.dataset.i]; T.year = s.year || 0; setScenario(s.S, s.name); }));
  $$('#saved .del').forEach(b => b.addEventListener('click', () => { const l = loadSaved(); l.splice(+b.dataset.i, 1); storeSaved(l); renderSaved(); }));
}
$('save-scn').addEventListener('click', () => {
  const name = $('save-name').value.trim() || `Scenario ${new Date().toLocaleString()}`;
  const l = loadSaved(); l.unshift({ name, S: { ...S }, year: T.year, saved: Date.now() }); storeSaved(l.slice(0, 30)); $('save-name').value = ''; renderSaved(); toast(`<b>Saved</b> ${escapeHtml(name)}`);
});
$('export-scn').addEventListener('click', async () => {
  const json = JSON.stringify({ app: 'EarthOS', version: 1, scenario: S, year: T.year, impacts: impacts(S, T.year) }, null, 2);
  try { await navigator.clipboard.writeText(json); toast('<b>Copied</b> scenario JSON to clipboard.'); } catch (e) { window.prompt('Copy scenario JSON:', json); }
});
$('import-scn').addEventListener('click', () => {
  const raw = window.prompt('Paste scenario JSON:'); if (!raw) return;
  try { const j = JSON.parse(raw); const p = j.scenario || j; if (typeof j.year === 'number') T.year = clamp(j.year, 0, HORIZON); setScenario(p, 'Imported scenario'); } catch (e) { toast('<b>Invalid JSON.</b>'); }
});
renderPresets(); renderSaved();

/* ═══════════════════ 4. Impact refresh & log ═══════════════════ */
const prevActive = new Set();
let markerKey = '';
function refresh() {
  const r = impacts(S, T.year), base = impacts(GT, 0), year = BASE_YEAR + T.year;
  const sgn = v => (v >= 0 ? '+' : '') + v.toFixed(1);
  $('v-disp').textContent = r.displacement.toFixed(1); $('d-disp').textContent = `${sgn(r.displacement - base.displacement)}M vs today`;
  $('v-arable').textContent = r.arable.toFixed(1); $('d-arable').textContent = `${sgn(r.arable - base.arable)} pts vs today`;
  $('v-coast').textContent = r.coastal.toFixed(0); $('d-coast').textContent = `${sgn(r.coastal - base.coastal)}M vs today`;
  $('v-lanes').textContent = r.lanes; $('d-lanes').textContent = `${Math.round(22 * r.lanes / 100)} of 22 corridors open`;
  $('v-bio').textContent = Math.round(r.bio); $('v-bio-delta').textContent = `${Math.round(r.bio - base.bio)}`; $('v-mat').textContent = `${Math.round(r.e.m * 100)}%`;
  const arc = $('gauge-arc'); arc.style.strokeDashoffset = (263.9 * (1 - r.bio / 100)).toFixed(1);
  const col = r.bio > 70 ? 'var(--emerald)' : r.bio > 40 ? 'var(--amber)' : 'var(--red)'; arc.style.stroke = col; arc.style.color = col;
  $('bio-note').textContent = r.bio > 85 ? 'Systems within Holocene envelope.' : r.bio > 70 ? 'Stress accumulating; feedbacks still damped.' : r.bio > 40 ? 'Multiple subsystems past tipping thresholds.' : r.bio > 15 ? 'Cascading regime shifts underway.' : 'Biosphere in terminal reorganisation.';
  $('v-disp').parentElement.style.color = r.displacement > 100 ? 'var(--red)' : r.displacement > 25 ? 'var(--amber)' : '';
  $('v-arable').parentElement.style.color = r.arable > 25 ? 'var(--red)' : r.arable > 8 ? 'var(--amber)' : '';
  $('v-coast').parentElement.style.color = r.coastal > 150 ? 'var(--red)' : r.coastal > 40 ? 'var(--amber)' : '';
  $('v-lanes').parentElement.style.color = r.lanes < 50 ? 'var(--red)' : r.lanes < 80 ? 'var(--amber)' : '';

  const active = new Set(EVENTS.filter(ev => ev.test(r.e, S)).map(ev => ev.id));
  for (const ev of EVENTS) {
    if (active.has(ev.id) && !prevActive.has(ev.id)) addLog(ev.cls, Math.round(year), ev.text, true);
    else if (!active.has(ev.id) && prevActive.has(ev.id)) addLog('ok', Math.round(year), `Cleared: ${ev.text}`);
  }
  prevActive.clear(); active.forEach(id => prevActive.add(id));

  const nodes = Math.round(128 * (1 - r.e.grid / 100 * 0.9));
  $('nodes').textContent = `${nodes}/128`; $('nodes-dot').className = nodes < 64 ? 'amber' : 'cyan';
  $('v-year').textContent = Math.floor(year);
  $('v-yearsub').textContent = T.year < 0.05 ? 'T + 0.0 yr · real-time' : `T + ${T.year.toFixed(1)} yr · ${T.playing ? 'simulating ' + T.speed + '×' : 'paused'}`;
  $('s-year').value = T.year; setRangeProgress($('s-year'));
  const key = `${S.temp}|${S.sea}|${S.forest}|${S.grid}`;
  if (key !== markerKey) { markerKey = key; renderMarkers(); }
  if (earth) repaintGlobe();
}
function renderMarkers() {
  const box = $('markers'); box.innerHTML = '';
  tippingPoints(S).slice(0, 8).forEach(tp => {
    const m = document.createElement('div'); m.className = 'marker ' + tp.ev.cls; m.style.left = (tp.year / HORIZON * 100) + '%';
    m.dataset.label = `${BASE_YEAR + Math.round(tp.year)} · ${tp.ev.text.split(/[:—(]/)[0].trim()}`; box.appendChild(m);
  });
}
function addLog(cls, year, text, explainable) {
  const li = document.createElement('li'); li.className = cls;
  li.innerHTML = `<span class="y">${year}</span><span class="t">${escapeHtml(text)}</span>${explainable ? '<button class="ex" title="Explain with AI">✦</button>' : ''}`;
  if (explainable) li.querySelector('.ex').addEventListener('click', () => explainEvent(li, text));
  const log = $('log'); log.prepend(li); while (log.children.length > 40) log.lastChild.remove();
}

/* ═══════════════════ 5. Markdown (tiny) ═══════════════════ */
function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}
function md(src) {
  const lines = escapeHtml(src).split('\n'); let out = '', list = null, code = false, codeBuf = [], para = [];
  const flushPara = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para = []; } };
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('```')) { if (code) { out += `<pre>${codeBuf.join('\n')}</pre>`; codeBuf = []; code = false; } else { flushPara(); closeList(); code = true; } continue; }
    if (code) { codeBuf.push(line); continue; }
    let m;
    if ((m = line.match(/^#{1,4}\s+(.*)/))) { flushPara(); closeList(); out += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { flushPara(); if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flushPara(); if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if (!line.trim()) { flushPara(); closeList(); }
    else para.push(line);
  }
  if (code) out += `<pre>${codeBuf.join('\n')}</pre>`;
  flushPara(); closeList(); return out;
}
const isArabic = s => /[؀-ۿ]/.test(s || '');

/* ═══════════════════ 6. AI features ═══════════════════ */
function aiOnline() { return EOS.AI.available(); }
function updateAiBadge() {
  const on = aiOnline();
  $('ai-dot').className = on ? 'violet' : 'off';
  $('ai-state').textContent = on ? EOS.AI.modelInfo().id.replace('claude-', '').replace(/-/g, ' ') : 'Offline analyst';
}
function activeEventTexts() { return EVENTS.filter(ev => prevActive.has(ev.id)).map(ev => ev.text); }
function context(extra) {
  const r = impacts(S, T.year);
  return Object.assign({
    year: BASE_YEAR + Math.floor(T.year), yearsAhead: +T.year.toFixed(1), horizonYear: BASE_YEAR + HORIZON,
    forcing: { ...S }, groundTruth: GT,
    impacts: { materialised: +r.e.m.toFixed(2), effectiveTemp: +r.e.temp.toFixed(2), effectiveSea: +r.e.sea.toFixed(2), effectiveGrid: +r.e.grid.toFixed(1), displacementM: +r.displacement.toFixed(1), arableDeficitPct: +r.arable.toFixed(1), biosphereScore: Math.round(r.bio), coastalExposureM: +r.coastal.toFixed(0), tradeLanesOnlinePct: r.lanes },
    activeEvents: activeEventTexts(),
    tippingPoints: tippingPoints(S).map(tp => ({ year: BASE_YEAR + Math.round(tp.year), event: tp.ev.text })),
    layers: Object.keys(layers).filter(k => layers[k]),
  }, extra || {});
}
function withContext(question, extra) { return `<scenario_snapshot>\n${JSON.stringify(context(extra))}\n</scenario_snapshot>\n\n${question}`; }
function ctxForLocal() { const r = impacts(S, T.year); return { year: BASE_YEAR + Math.floor(T.year), scenario: S, impacts: { ...r, m: r.e.m }, events: activeEventTexts() }; }

/** Stream into an element with live markdown rendering; returns final text. */
async function streamInto(el, req, opts = {}) {
  el.classList.add('streaming'); let last = 0, text = '';
  try {
    const r = await EOS.AI.stream({ ...req, onText: (d, full) => { text = full; const now = performance.now(); if (now - last > 120) { last = now; el.innerHTML = md(full); el.dir = isArabic(full) ? 'rtl' : 'ltr'; opts.onTick && opts.onTick(); } } });
    text = r.text;
  } finally { el.classList.remove('streaming'); }
  el.innerHTML = md(text); el.dir = isArabic(text) ? 'rtl' : 'ltr';
  return text;
}
function addApplyButton(el, text) {
  const j = EOS.AI.extractJson(text); if (!j) return;
  const b = document.createElement('button'); b.className = 'btn small ai apply'; b.textContent = '✦ Apply proposed parameters';
  b.addEventListener('click', () => { setScenario(j, 'AI proposal'); if (innerWidth < 720) { $$('.side').forEach(x => x.classList.remove('open')); } });
  el.appendChild(b);
}

/* chat */
const history = [];
let chatBusy = false;
function addMsg(role, html, cls = '') {
  const d = document.createElement('div'); d.className = `msg ${role} ${cls}`; d.innerHTML = `<span class="who">${role === 'user' ? 'You' : (aiOnline() ? 'Planetary Intelligence' : 'Local analyst')}</span><div class="body md"></div>`;
  d.querySelector('.body').innerHTML = html; $('chat').appendChild(d); $('chat').scrollTop = $('chat').scrollHeight; return d;
}
async function ask(q) {
  if (!q || chatBusy) return; chatBusy = true; $('chat-send').disabled = true;
  const u = addMsg('user', escapeHtml(q)); u.dir = isArabic(q) ? 'rtl' : 'ltr';
  const a = addMsg('ai', '<span class="muted">…</span>'); const body = a.querySelector('.body');
  try {
    if (!aiOnline()) { const t = EOS.LocalAnalyst.answer(q, ctxForLocal()); body.innerHTML = md(t); a.dir = isArabic(t) ? 'rtl' : 'ltr'; history.push({ role: 'user', content: q }, { role: 'assistant', content: t }); }
    else {
      const msgs = history.slice(-12).concat([{ role: 'user', content: withContext(q) }]);
      const text = await streamInto(body, { messages: msgs, maxTokens: 3000, langSample: q }, { onTick: () => { $('chat').scrollTop = $('chat').scrollHeight; } });
      history.push({ role: 'user', content: q }, { role: 'assistant', content: text }); addApplyButton(body, text);
    }
  } catch (e) { a.classList.add('err'); body.textContent = e.message; }
  finally { chatBusy = false; $('chat-send').disabled = false; $('chat').scrollTop = $('chat').scrollHeight; }
}
$('chatform').addEventListener('submit', e => { e.preventDefault(); const q = $('chat-input').value.trim(); $('chat-input').value = ''; $('chat-input').style.height = ''; ask(q); });
$('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chatform').requestSubmit(); } });
$('chat-input').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; });
$$('#quick button').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));

/* briefing */
$('gen-brief').addEventListener('click', async () => {
  const btn = $('gen-brief'), el = $('brief-body'); btn.disabled = true; btn.classList.add('busy');
  try {
    if (!aiOnline()) { const t = EOS.LocalAnalyst.briefing(ctxForLocal()); el.innerHTML = md(t); el.dir = isArabic(t) ? 'rtl' : 'ltr'; }
    else await streamInto(el, { messages: [{ role: 'user', content: withContext('Write an executive briefing of this scenario for a head of state: (1) bottom line in one sentence, (2) the three numbers that matter and why, (3) the two regions most at risk, (4) the single highest-leverage intervention with its trade-off. Maximum 180 words.') }], maxTokens: 1500 });
  } catch (e) { el.innerHTML = `<span style="color:#fca5a5">${escapeHtml(e.message)}</span>`; }
  finally { btn.disabled = false; btn.classList.remove('busy'); }
});

/* suggest intervention */
$('ai-suggest').addEventListener('click', async () => {
  switchTab($('impact'), 'intel');
  if (innerWidth < 720) { $$('.side, #timeline').forEach(x => x.classList.remove('open')); $('impact').classList.add('open'); $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.subtab === 'intel')); }
  const goal = 'Propose a target forcing configuration for this sandbox that maximises the biosphere score at the 50-year horizon while keeping projected displacement under 25 M people, and that a coalition of major economies could plausibly deliver. Give 3 bullets of rationale, then the JSON block.';
  if (!aiOnline()) { const t = EOS.LocalAnalyst.suggest(ctxForLocal()); const a = addMsg('ai', md(t)); addApplyButton(a.querySelector('.body'), t); return; }
  await ask(goal);
});

/* explain event */
async function explainEvent(li, text) {
  if (li.querySelector('.why')) { li.querySelector('.why').remove(); return; }
  const why = document.createElement('span'); why.className = 'why'; why.textContent = '…'; li.querySelector('.t').appendChild(why);
  try {
    if (!aiOnline()) { why.innerHTML = md(EOS.LocalAnalyst.explain(text)); }
    else await streamInto(why, { messages: [{ role: 'user', content: withContext(`Explain this sandbox event in at most 3 sentences: what real-world mechanism it represents, why it fires at this point, and its main second-order effect. Event: "${text}"`) }], maxTokens: 600, effort: 'low' });
  } catch (e) { why.textContent = e.message; }
}

/* ═══════════════════ 7. Inspector ═══════════════════ */
let inspected = null;
const haversine = (a, b) => { const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
function openInspector(ll) {
  inspected = ll; const e = effective(S, T.year), exag = EOS.AI.settings.exag || 30;
  const elev = earth.elevationAt(ll.lat, ll.lon), night = earth.nightAt(ll.lat, ll.lon);
  const isWater = elev !== null && elev < 40, alat = Math.abs(ll.lat);
  const iceSheet = !isWater && (ll.lat < -60 || (ll.lat > 60 && ll.lon > -73 && ll.lon < -12));
  const surface = elev === null ? 'unknown' : isWater ? (alat > 66 ? 'Polar ocean / sea ice' : 'Ocean') : iceSheet ? 'Ice sheet' : elev > 2500 ? 'High mountains' : elev > 800 ? 'Uplands' : 'Lowland';
  const trueFlood = !isWater && elev !== null && elev < e.sea, visFlood = !isWater && elev !== null && elev < e.sea * exag;
  const flood = isWater ? 'n/a (sea)' : elev === null ? 'unknown' : trueFlood ? `Below projected sea level (+${e.sea.toFixed(1)} m)` : visFlood ? `Inundated in view (×${exag} exaggeration)` : 'Above flood line';
  const polar = 1 + 1.3 * Math.max(0, ll.lat) / 90 + 0.4 * Math.max(0, -ll.lat) / 90;
  const local = e.temp * polar;
  const hub = earth.HUBS.map(h => ({ n: h.n, d: haversine([ll.lat, ll.lon], h.ll) })).sort((a, b) => a.d - b.d)[0];
  const lights = night === null ? 'unknown' : night * (1 - e.grid / 100 * 0.85) > 0.35 ? 'Bright (urban)' : night * (1 - e.grid / 100 * 0.85) > 0.08 ? 'Faint' : 'Dark';
  const info = {
    coords: `${Math.abs(ll.lat).toFixed(2)}°${ll.lat >= 0 ? 'N' : 'S'} ${Math.abs(ll.lon).toFixed(2)}°${ll.lon >= 0 ? 'E' : 'W'}`,
    elev: elev === null ? 'n/a' : isWater ? 'sea level' : `≈${Math.round(elev)} m`, surface, flood, temp: `+${local.toFixed(1)}°C`, hub: `${hub.n} · ${Math.round(hub.d)} km`, lights,
    daylight: earth.isDaylit(ll.lat, ll.lon) ? 'day' : 'night',
  };
  inspected.info = info;
  $('insp-coords').textContent = `LAT ${ll.lat.toFixed(2)} · LON ${ll.lon.toFixed(2)}`;
  $('insp-sub').textContent = `${info.coords} · ${info.daylight} side · ${BASE_YEAR + Math.floor(T.year)}`;
  $('insp-elev').textContent = info.elev; $('insp-surface').textContent = surface; $('insp-flood').textContent = flood; $('insp-flood').style.color = trueFlood ? 'var(--red)' : visFlood ? 'var(--amber)' : '';
  $('insp-temp').textContent = info.temp; $('insp-hub').textContent = info.hub; $('insp-lights').textContent = lights;
  $('insp-ai-body').hidden = true; $('insp-ai-body').innerHTML = '';
  $('inspector').hidden = false;
}
$('insp-close').addEventListener('click', () => { $('inspector').hidden = true; inspected = null; });
$('insp-zoom').addEventListener('click', () => { if (inspected) earth.flyTo(inspected.lat, inspected.lon, 1.55); });
$('insp-ai').addEventListener('click', async () => {
  if (!inspected) return; const el = $('insp-ai-body'); el.hidden = false; el.textContent = '…';
  const info = inspected.info;
  try {
    if (!aiOnline()) { const t = EOS.LocalAnalyst.region(info, ctxForLocal()); el.innerHTML = md(t); el.dir = isArabic(t) ? 'rtl' : 'ltr'; }
    else await streamInto(el, { messages: [{ role: 'user', content: withContext(`Regional assessment for the selected location. Identify the place (country/region/sea) from the coordinates, then in at most 120 words: exposure under this scenario (flooding, heat, food, infrastructure), the population or assets at stake, and one locally relevant adaptation. Location data: ${JSON.stringify(info)}`, { selectedLocation: { lat: +inspected.lat.toFixed(3), lon: +inspected.lon.toFixed(3) } }) }], maxTokens: 900 });
  } catch (e) { el.textContent = e.message; }
});

/* ═══════════════════ 8. Settings ═══════════════════ */
function openSettings() {
  const s = EOS.AI.settings;
  $('set-model').innerHTML = EOS.AI.MODELS.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  $('set-key').value = s.apiKey; $('set-model').value = s.model; $('set-effort').value = s.effort; $('set-lang').value = s.lang; $('set-fallbacks').checked = !!s.fallbacks;
  $('set-provider').value = s.provider; $('set-gkey').value = s.googleKey; $('set-exag').value = s.exag; $('set-exag-v').textContent = s.exag; $('test-ai-out').textContent = '';
  $('settings').hidden = false;
}
function saveSettings() {
  EOS.AI.save({ apiKey: $('set-key').value.trim(), model: $('set-model').value, effort: $('set-effort').value, lang: $('set-lang').value, fallbacks: $('set-fallbacks').checked, provider: $('set-provider').value, googleKey: $('set-gkey').value.trim(), exag: +$('set-exag').value });
  applySettingsToEarth(); updateAiBadge(); $('settings').hidden = true; toast('<b>Settings saved.</b>');
}
function applySettingsToEarth() {
  const s = EOS.AI.settings; if (!earth) return;
  earth.setExag(s.exag || 30); $('exag-note').textContent = `×${s.exag || 30}`;
  earth.setProvider(s.provider === 'google' && !s.googleKey ? 'gibs-bm' : s.provider, s.googleKey);
}
$('open-settings').addEventListener('click', openSettings);
$('settings-close').addEventListener('click', () => { $('settings').hidden = true; });
$('settings-save').addEventListener('click', saveSettings);
$('set-exag').addEventListener('input', e => { $('set-exag-v').textContent = e.target.value; });
$('settings').addEventListener('click', e => { if (e.target === $('settings')) $('settings').hidden = true; });
$('test-ai').addEventListener('click', async () => {
  const out = $('test-ai-out'); out.textContent = 'testing…';
  EOS.AI.save({ apiKey: $('set-key').value.trim(), model: $('set-model').value, fallbacks: $('set-fallbacks').checked });
  try { const t = await EOS.AI.test(); out.textContent = '✓ ' + t.slice(0, 60); } catch (e) { out.textContent = '✗ ' + e.message; }
  updateAiBadge();
});
updateAiBadge();

/* ═══════════════════ 9. Foldable posture bridge (Android → JS) ═══════════════════ */
window.EarthOSNative = {
  /** p = { posture: 'flat'|'tabletop'|'book', top, bottom, left, right } in CSS px (hinge bounds). */
  setPosture(p) {
    try { if (typeof p === 'string') p = JSON.parse(p); } catch (e) { return; }
    document.body.classList.remove('posture-tabletop', 'posture-book');
    const st = document.documentElement.style;
    if (p && p.posture === 'tabletop') { document.body.classList.add('posture-tabletop'); st.setProperty('--fold-top', p.top + 'px'); st.setProperty('--fold-bottom', p.bottom + 'px'); }
    else if (p && p.posture === 'book') { document.body.classList.add('posture-book'); st.setProperty('--fold-left', p.left + 'px'); st.setProperty('--fold-right', p.right + 'px'); }
    setTimeout(() => earth && earth.resize(), 50);
  },
  getState() { return JSON.stringify(context()); },
};

/* ═══════════════════ 10. Misc UI ═══════════════════ */
let toastTimer;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 6000); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('settings').hidden = true; $('inspector').hidden = true; }
  if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); setPlaying(!T.playing); }
});
$('y0').textContent = BASE_YEAR;

/* ═══════════════════ 11. Frame loop ═══════════════════ */
let lastT = performance.now(), hudT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; const t = now / 1000;
  if (T.playing) {
    T.year += dt * T.speed * 0.9;
    if (T.year >= HORIZON) { T.year = HORIZON; setPlaying(false); toast(`<b>Horizon reached.</b> ${BASE_YEAR + HORIZON} state rendered. Adjust parameters and re-run.`); }
    refresh();
  }
  earth.frame(now, dt, t);
  if (now - hudT > 500) { hudT = now; const s = earth.state; $('hud-fps').textContent = `${s.fps} FPS`; if (!s.hires) $('hud-src').textContent = s.dayLoaded ? 'NASA Blue Marble' : 'Procedural fallback'; }
}

boot();
EOS.app = { get earth() { return earth; }, context };
addLog('ok', BASE_YEAR, 'Telemetry stream synchronised · 128 quantum nodes online');
requestAnimationFrame(loop);
})();
