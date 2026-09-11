/* EarthOS — AI core
 * Calls the Anthropic Messages API directly from the WebView (no bundler, offline-first app),
 * with SSE streaming. Falls back to a deterministic local analyst when no key is configured.
 */
window.EOS = window.EOS || {};
EOS.AI = (function () {
  'use strict';
  const KEY = 'eos.settings.v1';
  const MODELS = [
    { id: 'claude-opus-5',    label: 'Claude Opus 5 — recommended',      effort: true,  fallbacks: true },
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 — most capable',  effort: true,  fallbacks: true },
    { id: 'claude-sonnet-5',  label: 'Claude Sonnet 5 — fast',           effort: true,  fallbacks: false },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — lightweight',   effort: false, fallbacks: false },
  ];
  const DEFAULTS = { apiKey: '', model: 'claude-opus-5', effort: 'medium', lang: 'ar', fallbacks: true, provider: 'gibs-bm', googleKey: '', exag: 30 };
  let settings = load();
  function load() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULTS }; } }
  function save(s) { settings = { ...settings, ...s }; try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ } }
  function available() { return !!(settings.apiKey && settings.apiKey.trim()); }
  function modelInfo() { return MODELS.find(m => m.id === settings.model) || MODELS[0]; }

  const SYSTEM = `You are the Planetary Intelligence core of EarthOS, an interactive digital-twin sandbox of Earth.
The user manipulates four forcing parameters and a 50-year timeline; the app computes heuristic impacts and streams you a JSON snapshot of the live state with every message.

The sandbox model (heuristic, NOT a climate forecast):
- Forcing sliders: global temperature anomaly (°C above pre-industrial, ground truth +1.2), sea-level rise (m, ground truth 0), forest canopy coverage (% of land, ground truth 31), grid disruption index (%, ground truth 5).
- Consequences lag forcing: "materialised" fraction m = 0.3 + 0.7 · (yearsAhead / 50). Effective values = slider · m.
- Displacement (M people) = 14·sea^1.25 + 30·max(0, temp−1)^1.5 + 0.8·forestDeficit + 0.5·grid. Arable deficit, biosphere score (0–100), coastal exposure and trade lanes follow similar monotone heuristics.
- Threshold events fire at effective temp ≥ 1.5/2.0/2.5/3.0/4.0 °C, sea ≥ 0.5/1/3/6 m, canopy ≤ 20/10 % or ≥ 45 %, grid ≥ 30/60/85 %.
- The globe renders NASA Blue Marble / Black Marble imagery; flooding uses GEBCO elevation with visual exaggeration.

How to answer:
- Ground answers in the snapshot numbers; distinguish clearly between (a) what the sandbox shows and (b) real-world science and uncertainty. Never present the sandbox as a prediction.
- Be concise and decision-oriented: lead with the conclusion, then the 2–4 facts that matter, then what to do. Use short bullets; avoid filler.
- When asked for an intervention or parameter proposal, end with a fenced JSON block exactly like:
\`\`\`json
{"temp": 1.6, "sea": 0.4, "forest": 40, "grid": 5, "rationale": "one sentence"}
\`\`\`
- For regional assessments, reason from latitude/longitude, elevation, coastal status and known geography; name real places when the coordinates make that obvious, and say "approximately" when they do not.
- Do not include internal or system XML tags in your response.`;

  function langInstruction(sample) {
    const l = settings.lang;
    if (l === 'ar') return '\n\nAlways respond in Arabic (العربية), keeping technical terms and JSON keys in English.';
    if (l === 'en') return '\n\nAlways respond in English.';
    const isAr = /[؀-ۿ]/.test(sample || '');
    return isAr ? '\n\nRespond in Arabic (العربية), keeping technical terms and JSON keys in English.' : '\n\nRespond in the language of the user\'s message.';
  }

  function friendly(status, msg) {
    if (status === 401) return 'Invalid API key (401). Open Settings and check the key.';
    if (status === 403) return 'Forbidden (403): ' + msg;
    if (status === 429) return 'Rate limited (429). Wait a moment and retry.';
    if (status === 400) return 'Request rejected (400): ' + msg;
    if (status >= 500) return 'Anthropic API error (' + status + '). Retry shortly.';
    return msg;
  }

  /**
   * Stream a completion. Returns { text, stop }.
   * @param {{messages:Array, system?:string, maxTokens?:number, effort?:string, onText?:Function, signal?:AbortSignal, langSample?:string}} o
   */
  async function stream(o) {
    if (!available()) throw new Error('No API key configured.');
    const m = modelInfo();
    const headers = {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    const body = {
      model: m.id, max_tokens: o.maxTokens || 4000, stream: true,
      system: [{ type: 'text', text: (o.system || SYSTEM) + langInstruction(o.langSample), cache_control: { type: 'ephemeral' } }],
      messages: o.messages,
    };
    if (m.effort) body.output_config = { effort: o.effort || settings.effort || 'medium' };
    if (m.fallbacks && settings.fallbacks) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }

    let res;
    try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body), signal: o.signal }); }
    catch (e) { if (e.name === 'AbortError') throw e; throw new Error(navigator.onLine === false ? 'Offline — no network connection.' : 'Network error reaching api.anthropic.com: ' + e.message); }
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { const j = await res.json(); msg = (j.error && j.error.message) || msg; } catch (e) { /* ignore */ }
      throw new Error(friendly(res.status, msg));
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', full = '', stop = null, stopDetails = null;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (!data) continue;
        let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { full += ev.delta.text; o.onText && o.onText(ev.delta.text, full); }
        else if (ev.type === 'message_delta' && ev.delta) { stop = ev.delta.stop_reason || stop; stopDetails = ev.delta.stop_details || stopDetails; }
        else if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'stream error');
      }
    }
    if (stop === 'refusal') throw new Error('The model declined this request' + (stopDetails && stopDetails.category ? ' (' + stopDetails.category + ')' : '') + '.');
    return { text: full, stop };
  }

  async function test() {
    const r = await stream({ system: 'You are a connectivity probe for EarthOS.', messages: [{ role: 'user', content: 'Reply with exactly: EARTHOS ONLINE' }], maxTokens: 64, effort: 'low' });
    return r.text.trim();
  }

  function extractJson(text) {
    const m = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/(\{[^{}]*"temp"[^{}]*\})/);
    if (!m) return null;
    try { const j = JSON.parse(m[1]); if (typeof j.temp === 'number' || typeof j.sea === 'number' || typeof j.forest === 'number' || typeof j.grid === 'number') return j; } catch (e) { /* ignore */ }
    return null;
  }

  return { MODELS, DEFAULTS, get settings() { return settings; }, save, available, modelInfo, stream, test, extractJson, SYSTEM };
})();

/* ───────────── Offline analyst (no key) ───────────── */
EOS.LocalAnalyst = (function () {
  'use strict';
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  function lang(sample) {
    const l = EOS.AI.settings.lang;
    if (l === 'ar' || l === 'en') return l;
    return /[؀-ۿ]/.test(sample || '') ? 'ar' : 'en';
  }
  function severity(bio) { return bio > 85 ? 0 : bio > 70 ? 1 : bio > 40 ? 2 : bio > 15 ? 3 : 4; }
  const SEV = {
    en: ['stable and within the Holocene envelope', 'under accumulating stress with damped feedbacks', 'past multiple tipping thresholds', 'in cascading regime shifts', 'in terminal reorganisation'],
    ar: ['مستقرة ضمن نطاق الهولوسين', 'تحت ضغط متراكم مع تغذية راجعة مكبوحة', 'تجاوزت عدة عتبات انقلاب', 'في تحولات نظامية متسلسلة', 'في إعادة تنظيم نهائية'],
  };
  function briefing(ctx) {
    const s = ctx.scenario, r = ctx.impacts, L = lang();
    const sev = severity(r.bio);
    if (L === 'ar') return [
      `**الخلاصة:** في عام ${ctx.year} تكون المحيط الحيوي ${SEV.ar[sev]} (درجة ${Math.round(r.bio)}/100).`,
      `- شذوذ الحرارة ${f1(s.temp)}°م، ارتفاع البحر ${f1(s.sea)} م، الغطاء الحرجي ${s.forest}%، اضطراب الشبكة ${s.grid}%. تحقق ${Math.round(r.m * 100)}% من العواقب حتى الآن.`,
      `- النزوح المتوقع ${f1(r.displacement)} مليون شخص؛ عجز الأراضي الزراعية ${f1(r.arable)}%؛ ${f1(r.coastal)} مليون داخل نطاق الفيضان؛ ${r.lanes}% من الممرات التجارية تعمل.`,
      ctx.events.length ? `- أحداث نشطة: ${ctx.events.slice(0, 4).join('؛ ')}.` : '- لا توجد أحداث حرجة نشطة.',
      `**التوصية:** ${r.bio < 70 ? 'خفّض شذوذ الحرارة أولاً (أكبر رافعة في النموذج)، ثم استعد الغطاء الحرجي فوق 31%.' : 'حافظ على المسار الحالي وراقب عتبة +1.5°م.'}`,
      `_محلل محلي دون اتصال — أضف مفتاح Anthropic في الإعدادات لتحليل أعمق._`,
    ].join('\n');
    return [
      `**Bottom line:** in ${ctx.year} the biosphere is ${SEV.en[sev]} (score ${Math.round(r.bio)}/100).`,
      `- Forcing: +${f1(s.temp)}°C, ${f1(s.sea)} m sea-level rise, ${s.forest}% canopy, ${s.grid}% grid disruption. ${Math.round(r.m * 100)}% of consequences materialised so far.`,
      `- Displacement ${f1(r.displacement)} M people; arable deficit ${f1(r.arable)}%; ${f1(r.coastal)} M inside the flood zone; ${r.lanes}% of trade lanes online.`,
      ctx.events.length ? `- Active events: ${ctx.events.slice(0, 4).join('; ')}.` : '- No critical events active.',
      `**Recommendation:** ${r.bio < 70 ? 'cut the temperature anomaly first (largest lever in this model), then restore canopy above 31%.' : 'hold course and watch the +1.5 °C threshold.'}`,
      `_Offline local analyst — add an Anthropic API key in Settings for deeper analysis._`,
    ].join('\n');
  }
  function answer(q, ctx) {
    const L = lang(q), r = ctx.impacts, s = ctx.scenario;
    const head = L === 'ar' ? 'المحلل المحلي (دون اتصال) يرى الحالة التالية:' : 'The offline analyst sees the following state:';
    return `${head}\n\n${briefing(ctx)}\n\n${L === 'ar' ? 'سؤالك' : 'Your question'}: “${q}”\n${L === 'ar'
      ? `أقوى رافعة في هذا النموذج هي الحرارة (تأثير أُسّي ^1.5 على النزوح)، ثم مستوى البحر (^1.25). خفض الحرارة بمقدار 1°م يقلل النزوح بنحو ${f1(30 * Math.max(0, Math.pow(Math.max(0, s.temp * r.m - 1), 1.5) - Math.pow(Math.max(0, (s.temp - 1) * r.m - 1), 1.5)))} مليون.`
      : `The strongest lever in this model is temperature (exponent 1.5 on displacement), then sea level (1.25). Cutting 1 °C reduces displacement by about ${f1(30 * Math.max(0, Math.pow(Math.max(0, s.temp * r.m - 1), 1.5) - Math.pow(Math.max(0, (s.temp - 1) * r.m - 1), 1.5)))} M.`}`;
  }
  function region(info, ctx) {
    const L = lang(), r = ctx.impacts;
    if (L === 'ar') return `**تقييم إقليمي (محلي):** الموقع ${info.coords} — ${info.surface}. الارتفاع ${info.elev}. ${info.flood}. الشذوذ المحلي ${info.temp}. أقرب مركز لوجستي: ${info.hub}. ${r.bio < 40 ? 'تحت هذا السيناريو تكون المنطقة عرضة لضغط مركّب (حرارة + بنية تحتية).' : 'الضغط الإقليمي معتدل تحت هذا السيناريو.'}\n\n_أضف مفتاح Anthropic للحصول على تحليل جغرافي فعلي._`;
    return `**Regional assessment (local):** ${info.coords} — ${info.surface}. Elevation ${info.elev}. ${info.flood}. Local anomaly ${info.temp}. Nearest hub: ${info.hub}. ${r.bio < 40 ? 'Under this scenario the region faces compound stress (heat + infrastructure).' : 'Regional stress is moderate under this scenario.'}\n\n_Add an Anthropic API key for real geographic analysis._`;
  }
  function explain(text) {
    const L = lang();
    return L === 'ar' ? `**${text}** — عتبة نموذجية في المحاكاة: عند تجاوزها تتسارع الآثار الثانوية (نزوح، عجز غذائي، انخفاض درجة المحيط الحيوي). أضف مفتاح API لشرح علمي مفصل.`
      : `**${text}** — a sandbox threshold: once crossed, second-order effects accelerate (displacement, food deficit, lower biosphere score). Add an API key for a detailed scientific explanation.`;
  }
  function suggest(ctx) {
    const s = ctx.scenario, L = lang();
    const p = { temp: Math.max(1.3, Math.min(s.temp, 1.7)), sea: Math.min(s.sea, 0.5), forest: Math.max(s.forest, 42), grid: Math.min(s.grid, 8) };
    const j = JSON.stringify({ ...p, rationale: L === 'ar' ? 'خفض الحرارة تحت +1.7 واستعادة الغطاء فوق 42% يرفعان درجة المحيط الحيوي أكثر من أي رافعة أخرى في النموذج.' : 'Holding temperature under +1.7 and restoring canopy above 42% raises the biosphere score more than any other lever in this model.' });
    return (L === 'ar' ? '**اقتراح المحلل المحلي:**\n' : '**Local analyst proposal:**\n') + '```json\n' + j + '\n```';
  }
  return { briefing, answer, region, explain, suggest };
})();
