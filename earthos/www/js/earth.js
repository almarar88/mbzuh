/* EarthOS — globe renderer
 * Real imagery (NASA Blue Marble / Black Marble / GEBCO elevation) with a scenario shader:
 * sea-level flooding from elevation data, ice retreat, vegetation response, grid-driven night lights,
 * real-time solar terminator, and an online hi-res zoom patch (NASA GIBS or Google Map Tiles).
 */
window.EOS = window.EOS || {};
EOS.Earth = (function () {
  'use strict';
  const R = 1, D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function ll2v(lat, lon, r = R) {
    const phi = (90 - lat) * D2R, theta = (lon + 180) * D2R;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  function v2ll(v) {
    const p = v.clone().normalize();
    const lat = 90 - Math.acos(clamp(p.y, -1, 1)) / D2R;
    let lon = Math.atan2(p.z, -p.x) / D2R - 180; if (lon < -180) lon += 360;
    return { lat, lon };
  }

  /* ───────────── shaders ───────────── */
  const VERT = `
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main() {
      vUv = uv;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const FRAG = `
    precision highp float;
    uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D elevMap;
    uniform vec3 sunDir; uniform vec3 camPos;
    uniform float uSea, uHeat, uForest, uGrid, uClimate, uExag, uHasElev, uFlicker, uFade, uHasNight;
    uniform vec2 uUvOff, uUvScale, uElevTexel;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;

    float elevAt(vec2 uv) { return texture2D(elevMap, uv).r; }

    void main() {
      vec2 guv = uUvOff + vUv * uUvScale;              // global equirectangular uv
      vec3 day = texture2D(dayMap, vUv).rgb;
      float e = uHasElev > 0.5 ? elevAt(guv) : 0.0;
      float lat = (guv.y - 0.5) * 180.0; float alat = abs(lat);
      float lum = dot(day, vec3(0.299, 0.587, 0.114));

      // masks
      float water = uHasElev > 0.5 ? (1.0 - smoothstep(0.0, 0.006, e)) : clamp((day.b - day.r) * 4.0, 0.0, 1.0);
      float green = clamp((day.g - max(day.r, day.b)) * 6.0, 0.0, 1.0);
      float snow  = smoothstep(0.62, 0.85, lum) * (1.0 - green) * smoothstep(48.0, 60.0, alat);
      vec3 col = day;

      // vegetation response to canopy slider (baseline 31%)
      float loss = clamp((0.31 - uForest) / 0.31, 0.0, 1.0);
      float gain = clamp((uForest - 0.31) / 0.69, 0.0, 1.0);
      vec3 dead = vec3(0.45, 0.36, 0.22) * (lum + 0.35);
      col = mix(col, dead, green * loss * 0.85);
      col = mix(col, col * vec3(0.72, 1.12, 0.66) + vec3(0.0, 0.04, 0.0), (1.0 - water) * (1.0 - snow) * gain * 0.55);

      // heat browning + polar ice retreat (edges first, polar amplification)
      float heat = clamp(uHeat / 4.0, 0.0, 1.0);
      col = mix(col, vec3(0.62, 0.48, 0.28) * (lum + 0.4), green * heat * 0.6);
      float melt = clamp(heat * 1.5 * (1.0 - smoothstep(58.0, 88.0, alat)) - 0.05, 0.0, 1.0);
      vec3 meltTo = mix(vec3(0.36, 0.32, 0.27), vec3(0.05, 0.16, 0.30), water);
      col = mix(col, meltTo * (0.6 + 0.4 * lum), snow * melt);

      // sea-level flooding from elevation (visual exaggeration uExag)
      float elevM = e * 8848.0; float floodM = uSea * uExag;
      float flood = (1.0 - water) * step(0.5, floodM) * (1.0 - smoothstep(floodM - 30.0, floodM + 30.0, elevM)) * uHasElev;
      vec3 shallowCol = vec3(0.10, 0.40, 0.58) * (0.6 + 0.6 * lum);
      col = mix(col, shallowCol, flood);
      float wet = max(water, flood);

      // climate heat overlay
      if (uClimate > 0.5) {
        float amp = 1.0 + 1.3 * max(0.0, lat) / 90.0 + 0.4 * max(0.0, -lat) / 90.0;
        float h = clamp(uHeat * amp * mix(1.0, 0.6, water) / 5.0, 0.0, 1.0);
        vec3 hc = mix(vec3(0.96, 0.62, 0.04), vec3(0.94, 0.15, 0.45), h);
        col = mix(col, hc, h * 0.55);
      }

      // relief normal from elevation gradient
      vec3 N = normalize(vN);
      vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N)); vec3 B = cross(N, T);
      float ex = elevAt(guv + vec2(uElevTexel.x, 0.0)) - elevAt(guv - vec2(uElevTexel.x, 0.0));
      float ey = elevAt(guv + vec2(0.0, uElevTexel.y)) - elevAt(guv - vec2(0.0, uElevTexel.y));
      vec3 Nb = normalize(N - (T * ex + B * ey) * 5.0 * uHasElev * (1.0 - wet));

      // lighting
      vec3 L = normalize(sunDir);
      float ndl = max(dot(Nb, L), 0.0);
      float dayF = smoothstep(-0.12, 0.22, dot(N, L));
      vec3 V = normalize(camPos - vP); vec3 H = normalize(L + V);
      float spec = pow(max(dot(Nb, H), 0.0), 64.0) * wet * 0.55;
      vec3 lit = col * (0.10 + 0.95 * ndl) + vec3(0.9, 0.95, 1.0) * spec;

      // night side: city lights dim/redden with grid disruption, drowned coasts go dark
      vec3 lights = uHasNight > 0.5 ? texture2D(nightMap, guv).rgb : vec3(0.0);
      float health = (1.0 - uGrid * 0.85) * uFlicker;
      lights *= health * (1.0 - flood) * vec3(1.0, 0.85 + 0.15 * (1.0 - uGrid), 0.6 + 0.4 * (1.0 - uGrid));
      vec3 nightCol = col * 0.035 + lights * 1.5;
      vec3 outc = mix(nightCol, lit, dayF);

      // atmospheric rim
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      outc += vec3(0.0, 0.7, 1.0) * fres * 0.22;
      gl_FragColor = vec4(outc, uFade);
    }`;

  const ATMO_VERT = 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }';
  const ATMO_FRAG = 'uniform vec3 c; uniform float p; uniform float k; varying vec3 vN; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), p); gl_FragColor = vec4(c, 1.0) * f * k; }';

  /* ───────────── data for vector layers ───────────── */
  const CURRENTS = [
    [[-80,25],[-75,32],[-65,38],[-50,44],[-30,50],[-10,55],[5,60]],
    [[125,20],[130,28],[140,34],[155,38],[175,40],[-165,42],[-140,44]],
    [[-60,-55],[-20,-58],[20,-60],[60,-58],[100,-60],[140,-62],[180,-60],[-140,-60],[-100,-58]],
    [[-75,-45],[-75,-30],[-78,-15],[-84,-5],[-100,-2],[-130,0],[-160,0]],
    [[15,-32],[12,-20],[8,-8],[-5,-2],[-20,0],[-35,2]],
    [[42,-25],[40,-18],[45,-8],[50,5],[55,15]],
    [[-30,60],[-40,65],[-50,58],[-58,50]],
    [[155,-15],[152,-25],[150,-35],[160,-42]],
  ];
  const HUBS = [
    { n: 'Shanghai', ll: [31.2, 121.5] }, { n: 'Singapore', ll: [1.3, 103.8] }, { n: 'Rotterdam', ll: [51.9, 4.5] },
    { n: 'Los Angeles', ll: [33.7, -118.3] }, { n: 'Dubai', ll: [25.3, 55.3] }, { n: 'Santos', ll: [-23.9, -46.3] },
    { n: 'Mumbai', ll: [19.1, 72.9] }, { n: 'New York', ll: [40.7, -74] }, { n: 'Lagos', ll: [6.5, 3.4] },
    { n: 'Tokyo', ll: [35.7, 139.7] }, { n: 'Sydney', ll: [-33.9, 151.2] }, { n: 'Durban', ll: [-29.9, 31] },
    { n: 'Hamburg', ll: [53.5, 10] }, { n: 'Houston', ll: [29.8, -95.4] },
  ];
  const ROUTES = [[0,1],[1,4],[4,2],[0,3],[3,7],[7,2],[1,6],[6,4],[5,7],[5,8],[8,2],[0,9],[9,3],[1,10],[10,0],[11,4],[11,5],[12,2],[13,7],[13,5],[3,13],[9,7]];
  const EMITTERS = [[35,115],[40,-90],[52,10],[22,78],[35,50],[-23,-46],[56,60],[20,100],[-30,28],[30,-100]];

  /* ───────────── factory ───────────── */
  function create(container, opts = {}) {
    const assetBase = opts.assetBase || 'assets/';
    const onProgress = opts.onProgress || (() => {});
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    const caps = renderer.capabilities, isGL2 = !!caps.isWebGL2, maxTex = caps.maxTextureSize || 4096;
    const aniso = Math.min(8, caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    const world = new THREE.Group(); scene.add(world);

    /* uniforms shared by the globe and the hi-res patch */
    const U = {
      dayMap: { value: null }, nightMap: { value: null }, elevMap: { value: null },
      sunDir: { value: new THREE.Vector3(1, 0.3, 0.6).normalize() }, camPos: { value: new THREE.Vector3() },
      uSea: { value: 0 }, uHeat: { value: 0 }, uForest: { value: 0.31 }, uGrid: { value: 0 }, uClimate: { value: 0 },
      uExag: { value: 30 }, uHasElev: { value: 0 }, uHasNight: { value: 0 }, uFlicker: { value: 1 }, uFade: { value: 1 },
      uUvOff: { value: new THREE.Vector2(0, 0) }, uUvScale: { value: new THREE.Vector2(1, 1) }, uElevTexel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) },
    };
    const earthMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), earthMat); world.add(earth);

    /* placeholder texture until assets arrive */
    const placeholder = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 256); grad.addColorStop(0, '#0b2a4a'); grad.addColorStop(0.5, '#0a3d66'); grad.addColorStop(1, '#0b2a4a');
      g.fillStyle = grad; g.fillRect(0, 0, 512, 256); g.strokeStyle = 'rgba(0,240,255,0.25)';
      for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
      for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      return new THREE.CanvasTexture(c);
    })();
    U.dayMap.value = placeholder; U.nightMap.value = placeholder; U.elevMap.value = placeholder;

    /* atmosphere, clouds, stars, ring */
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.10, 64, 64), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0x00c8ff) }, p: { value: 3.2 }, k: { value: 1.4 } },
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    scene.add(atmo);
    const cloudMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 96), cloudMat); world.add(clouds);
    const cloudLight = new THREE.DirectionalLight(0xffffff, 1.1); scene.add(cloudLight);
    scene.add(new THREE.AmbientLight(0x4060a0, 0.15));
    (() => {
      const N = 2200, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = 40 + Math.random() * 20;
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.7 })));
    })();
    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.35, R * 1.36, 128), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
    ring.rotation.x = Math.PI / 2.4; scene.add(ring);

    /* ocean currents */
    const currents = (() => {
      const paths = CURRENTS.map(p => new THREE.CatmullRomCurve3(p.map(([lon, lat]) => ll2v(lat, lon, R * 1.016))));
      const PER = 90, N = paths.length * PER, pos = new Float32Array(N * 3), phase = new Float32Array(N);
      for (let i = 0; i < N; i++) phase[i] = (i % PER) / PER;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const obj = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x00f0ff, size: 0.012, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      const group = new THREE.Group(); group.add(obj); world.add(group);
      paths.forEach(c => group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(60)), new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.14 }))));
      return { group, update(t) {
        const a = g.attributes.position.array;
        for (let i = 0; i < N; i++) { const p = paths[(i / PER) | 0].getPointAt((phase[i] + t * 0.05) % 1); a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; }
        g.attributes.position.needsUpdate = true;
      } };
    })();

    /* supply chains */
    const supply = (() => {
      const group = new THREE.Group(); world.add(group);
      const arcs = ROUTES.map(([a, b]) => {
        const A = ll2v(HUBS[a].ll[0], HUBS[a].ll[1]), B = ll2v(HUBS[b].ll[0], HUBS[b].ll[1]);
        const mid = A.clone().add(B).multiplyScalar(0.5), dist = A.distanceTo(B);
        mid.normalize().multiplyScalar(R * (1 + dist * 0.28));
        const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(A, mid, B).getPoints(48));
        const mat = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.7 });
        group.add(new THREE.Line(geo, mat));
        return { mat, seed: Math.random() };
      });
      group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(HUBS.map(h => ll2v(h.ll[0], h.ll[1], R * 1.006))),
        new THREE.PointsMaterial({ color: 0xa7f3d0, size: 0.026, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      return { group, update(t, grid) {
        const g = grid / 100;
        arcs.forEach(a => {
          const dead = a.seed < g * 0.9;
          a.mat.opacity = dead ? (Math.sin(t * 9 + a.seed * 50) > 0.6 ? 0.25 : 0.04) : 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + a.seed * 20));
          a.mat.color.setRGB(lerp(0.06, 0.96, g), lerp(0.72, 0.27, g), lerp(0.5, 0.27, g));
        });
      } };
    })();

    /* carbon haze */
    const carbon = (() => {
      const N = 1400, pos = new Float32Array(N * 3), base = [];
      for (let i = 0; i < N; i++) { const e = EMITTERS[i % EMITTERS.length]; base.push({ lat: e[0] + (Math.random() - 0.5) * 18, lon: e[1] + (Math.random() - 0.5) * 26, h: Math.random(), s: Math.random() }); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xc084fc, size: 0.02, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      const obj = new THREE.Points(g, m); world.add(obj);
      return { obj, update(t, temp) {
        const lift = 0.02 + 0.06 * clamp(temp / 5, 0, 1), a = g.attributes.position.array;
        for (let i = 0; i < N; i++) { const b = base[i], h = (b.h + t * 0.03 * (0.5 + b.s)) % 1; const p = ll2v(b.lat + Math.sin(t + b.s * 9) * 1.2, b.lon + h * 12, R * (1.005 + h * lift)); a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; }
        g.attributes.position.needsUpdate = true; m.size = 0.014 + 0.02 * clamp(temp / 5, 0, 1);
      } };
    })();

    /* ───────────── asset loading ───────────── */
    const elevData = { w: 0, h: 0, data: null }, nightData = { w: 0, h: 0, data: null };
    const status = { ready: false, dayLoaded: false, source: 'NASA Blue Marble' };
    function loadImage(url) {
      return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('failed ' + url)); im.src = url; });
    }
    function texFromImage(im, opts = {}) {
      const t = new THREE.Texture(im); t.needsUpdate = true; t.anisotropy = aniso;
      const pot = (im.width & (im.width - 1)) === 0 && (im.height & (im.height - 1)) === 0;
      if (!isGL2 && !pot) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
      else { t.minFilter = THREE.LinearMipmapLinearFilter; }
      t.magFilter = THREE.LinearFilter;
      return t;
    }
    function readback(im, w, h) {
      try {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0, w, h); return g.getImageData(0, 0, w, h).data;
      } catch (e) { return null; } // tainted canvas under file:// — inspector falls back gracefully
    }
    async function loadAssets() {
      const useBig = isGL2 && maxTex >= 8192;
      const jobs = [
        ['day', useBig ? 'earth_day.jpg' : 'earth_day_4k.jpg'], ['elev', 'earth_elev.png'], ['night', 'earth_night.jpg'], ['clouds', 'earth_clouds.png'],
      ];
      let done = 0;
      const results = await Promise.all(jobs.map(async ([k, f]) => {
        try { const im = await loadImage(assetBase + f); done++; onProgress(`Loaded ${k} map (${done}/${jobs.length})`, done / jobs.length); return [k, im]; }
        catch (e) { done++; onProgress(`Missing ${k} map — using fallback`, done / jobs.length); return [k, null]; }
      }));
      for (const [k, im] of results) {
        if (!im) continue;
        if (k === 'day') { U.dayMap.value = texFromImage(im); status.dayLoaded = true; }
        if (k === 'night') { U.nightMap.value = texFromImage(im); U.uHasNight.value = 1; nightData.w = 1024; nightData.h = 512; nightData.data = readback(im, 1024, 512); }
        if (k === 'elev') {
          const t = texFromImage(im); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; U.elevMap.value = t; U.uHasElev.value = 1;
          U.uElevTexel.value.set(1 / im.width, 1 / im.height);
          elevData.w = 2048; elevData.h = 1024; elevData.data = readback(im, 2048, 1024);
        }
        if (k === 'clouds') { const t = texFromImage(im); cloudMat.map = t; cloudMat.needsUpdate = true; cloudMat.opacity = 0.6; }
      }
      status.ready = true;
    }

    /* ───────────── hi-res zoom patch ───────────── */
    const hires = { enabled: true, provider: 'gibs-bm', googleKey: '', mesh: null, mat: null, key: '', timer: null, token: 0, session: null, busy: false, attribution: '', fade: 0, lastRect: null };
    const patchU = Object.assign({}, U, { dayMap: { value: null }, uUvOff: { value: new THREE.Vector2() }, uUvScale: { value: new THREE.Vector2() }, uFade: { value: 0 } });
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pickNdc(x, y) {
      ndc.set(x, y); raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(earth)[0];
      return hit ? v2ll(world.worldToLocal(hit.point.clone())) : null;
    }
    function viewRect() {
      const cols = 9, rows = 7, hits = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const h = pickNdc(-0.92 + 1.84 * i / (cols - 1), -0.92 + 1.84 * j / (rows - 1)); if (h) hits.push(h); }
      if (hits.length < cols * rows * 0.55) return null;
      const c = pickNdc(0, 0); if (!c) return null;
      let minLat = 90, maxLat = -90, minDl = 180, maxDl = -180;
      for (const h of hits) { const dl = ((h.lon - c.lon + 540) % 360) - 180; minLat = Math.min(minLat, h.lat); maxLat = Math.max(maxLat, h.lat); minDl = Math.min(minDl, dl); maxDl = Math.max(maxDl, dl); }
      const padLat = (maxLat - minLat) * 0.12, padLon = (maxDl - minDl) * 0.12;
      const lat0 = clamp(minLat - padLat, -85, 85), lat1 = clamp(maxLat + padLat, -85, 85);
      const lon0 = clamp(c.lon + minDl - padLon, -180, 180), lon1 = clamp(c.lon + maxDl + padLon, -180, 180);
      if (lon1 - lon0 > 120 || lat1 - lat0 > 90 || lon1 - lon0 < 0.05 || lat1 - lat0 < 0.05) return null;
      return { lat0, lat1, lon0, lon1 };
    }
    function yesterdayUTC() { const d = new Date(Date.now() - 36 * 3600 * 1000); return d.toISOString().slice(0, 10); }
    function gibsUrl(layer, r, w, h, time) {
      return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&CRS=EPSG:4326&BBOX=${r.lat0},${r.lon0},${r.lat1},${r.lon1}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg${time ? '&TIME=' + time : ''}`;
    }
    function corsImage(url) {
      return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile fetch failed')); im.src = url; });
    }
    async function fetchGibs(r, w, h, layerId) {
      if (layerId === 'gibs-viirs') {
        try { const im = await corsImage(gibsUrl('VIIRS_SNPP_CorrectedReflectance_TrueColor', r, w, h, yesterdayUTC())); return { im, attribution: 'NASA GIBS · VIIRS ' + yesterdayUTC() }; }
        catch (e) { /* fall through to Blue Marble */ }
      }
      const im = await corsImage(gibsUrl('BlueMarble_ShadedRelief_Bathymetry', r, w, h));
      return { im, attribution: 'NASA GIBS · Blue Marble 500 m' };
    }
    async function googleSession() {
      if (hires.session && hires.session.expiry > Date.now() / 1000 + 60) return hires.session.token;
      const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(hires.googleKey)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US' }),
      });
      if (!res.ok) throw new Error('Google Map Tiles session failed (' + res.status + ')');
      const j = await res.json(); hires.session = { token: j.session, expiry: +j.expiry || (Date.now() / 1000 + 3600) };
      return j.session;
    }
    const mercY = lat => (1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2;
    async function fetchGoogle(r, w, h) {
      const session = await googleSession();
      const lonSpan = r.lon1 - r.lon0;
      const z = clamp(Math.ceil(Math.log2((360 / lonSpan) * (w / 256))), 1, 20), n = 2 ** z;
      const x0 = Math.floor((r.lon0 + 180) / 360 * n), x1 = Math.min(n - 1, Math.floor((r.lon1 + 180) / 360 * n));
      const y0 = Math.floor(mercY(r.lat1) * n), y1 = Math.min(n - 1, Math.floor(mercY(r.lat0) * n));
      const nx = x1 - x0 + 1, ny = y1 - y0 + 1;
      if (nx * ny > 64) throw new Error('view too large for tile compositing');
      const merc = document.createElement('canvas'); merc.width = nx * 256; merc.height = ny * 256; const mg = merc.getContext('2d');
      await Promise.all(Array.from({ length: nx * ny }, (_, i) => {
        const tx = x0 + (i % nx), ty = y0 + Math.floor(i / nx);
        return corsImage(`https://tile.googleapis.com/v1/2dtiles/${z}/${tx}/${ty}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(hires.googleKey)}`)
          .then(im => mg.drawImage(im, (tx - x0) * 256, (ty - y0) * 256)).catch(() => {});
      }));
      // reproject mercator strip → equirectangular rows
      const out = document.createElement('canvas'); out.width = w; out.height = h; const og = out.getContext('2d');
      const sx = ((r.lon0 + 180) / 360 * n - x0) * 256, sw = lonSpan / 360 * n * 256;
      for (let j = 0; j < h; j++) {
        const lat = r.lat1 - (j + 0.5) / h * (r.lat1 - r.lat0);
        const sy = (mercY(lat) * n - y0) * 256;
        og.drawImage(merc, sx, sy, sw, 1, 0, j, w, 1);
      }
      return { im: out, attribution: 'Imagery ©Google' };
    }
    function disposePatch() {
      if (hires.mesh) { world.remove(hires.mesh); hires.mesh.geometry.dispose(); if (patchU.dayMap.value) patchU.dayMap.value.dispose(); patchU.dayMap.value = null; hires.mesh = null; }
      hires.key = ''; hires.pendingKey = ''; clearTimeout(hires.timer); hires.attribution = ''; patchU.uFade.value = 0;
    }
    async function loadPatch(r) {
      const token = ++hires.token; hires.busy = true; opts.onHiresState && opts.onHiresState('loading');
      try {
        const w = isGL2 ? 2048 : 1024; const h = clamp(Math.round(w * (r.lat1 - r.lat0) / (r.lon1 - r.lon0)), 256, w);
        let res;
        if (hires.provider === 'google' && hires.googleKey) {
          try { res = await fetchGoogle(r, Math.min(w, 1024), Math.min(h, 1024)); }
          catch (e) { opts.onHiresState && opts.onHiresState('error', 'Google tiles: ' + e.message + ' — using NASA'); res = await fetchGibs(r, w, h, 'gibs-bm'); }
        } else res = await fetchGibs(r, w, h, hires.provider);
        if (token !== hires.token) return;
        const tex = new THREE.Texture(res.im); tex.needsUpdate = true; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = aniso;
        if (hires.mesh) { world.remove(hires.mesh); hires.mesh.geometry.dispose(); if (patchU.dayMap.value) patchU.dayMap.value.dispose(); }
        const geo = new THREE.SphereGeometry(R * 1.0015, 96, 96, (r.lon0 + 180) * D2R, (r.lon1 - r.lon0) * D2R, (90 - r.lat1) * D2R, (r.lat1 - r.lat0) * D2R);
        patchU.dayMap.value = tex; patchU.uUvOff.value.set((r.lon0 + 180) / 360, (r.lat0 + 90) / 180); patchU.uUvScale.value.set((r.lon1 - r.lon0) / 360, (r.lat1 - r.lat0) / 180);
        patchU.uFade.value = 0;
        if (!hires.mat) hires.mat = new THREE.ShaderMaterial({ uniforms: patchU, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        hires.mesh = new THREE.Mesh(geo, hires.mat); world.add(hires.mesh);
        hires.attribution = res.attribution; hires.lastRect = r;
        opts.onHiresState && opts.onHiresState('ready', res.attribution);
      } catch (e) {
        if (token === hires.token) opts.onHiresState && opts.onHiresState('error', e.message);
      } finally { if (token === hires.token) hires.busy = false; }
    }
    function hiresTick() {
      const online = navigator.onLine !== false;
      if (!hires.enabled || !online || !status.ready || dragging || Math.abs(camDist - targetDist) > 0.005 || camDist > 2.9) {
        if (camDist > 2.9 || !hires.enabled) { if (hires.mesh) disposePatch(); hires.key = ''; hires.pendingKey = ''; clearTimeout(hires.timer); }
        return;
      }
      const r = viewRect(); if (!r) return;
      const q = v => Math.round(v * 4) / 4;
      const key = [hires.provider, q(r.lat0), q(r.lat1), q(r.lon0), q(r.lon1)].join('|');
      if (key === hires.key || key === hires.pendingKey) return;   // already shown or already scheduled
      clearTimeout(hires.timer); hires.pendingKey = key;
      hires.timer = setTimeout(() => { hires.pendingKey = ''; hires.key = key; loadPatch({ lat0: q(r.lat0), lat1: q(r.lat1), lon0: q(r.lon0), lon1: q(r.lon1) }); }, 550);
    }

    /* ───────────── interaction ───────────── */
    const rot = { x: 0.35, y: -1.2, vx: 0, vy: 0, auto: 0.0009 };
    let camDist = 3.6, targetDist = 3.6, userZoomed = false, dragging = false, last = null, pinch = null, downPos = null, moved = 0;
    const fly = { active: false, t: 0, from: null, to: null, dist: 0 };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => { dragging = true; last = { x: e.clientX, y: e.clientY }; downPos = { x: e.clientX, y: e.clientY }; moved = 0; el.setPointerCapture(e.pointerId); rot.vx = rot.vy = 0; fly.active = false; });
    el.addEventListener('pointermove', e => {
      opts.onHover && opts.onHover(pick(e.clientX, e.clientY));
      if (!dragging || !last || pinch) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.0035 * clamp((camDist - 1) / 2.6, 0.12, 1);
      rot.vy = dx * k; rot.vx = dy * k; rot.y += rot.vy; rot.x = clamp(rot.x + rot.vx, -1.45, 1.45);
    });
    const endDrag = e => {
      if (dragging && downPos && moved < 6 && opts.onTap) { const ll = pick(e.clientX, e.clientY); if (ll) opts.onTap(ll, e); }
      dragging = false; last = null; downPos = null;
    };
    el.addEventListener('pointerup', endDrag); el.addEventListener('pointercancel', () => { dragging = false; last = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); userZoomed = true; targetDist = clamp(targetDist * (1 + e.deltaY * 0.0012), 1.18, 5); }, { passive: false });
    el.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = dist2(e.touches); }, { passive: true });
    el.addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch) { userZoomed = true; const d = dist2(e.touches); targetDist = clamp(targetDist * (pinch / d), 1.18, 5); pinch = d; } }, { passive: true });
    el.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });
    function dist2(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    function pick(clientX, clientY) {
      const rect = el.getBoundingClientRect();
      return pickNdc(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    }
    function flyTo(lat, lon, dist) {
      // rotate so that (lat, lon) faces the camera: rot.x = lat, rot.y such that lon is at front
      const targetY = -((lon + 180) * D2R) + Math.PI / 2;
      const ty = targetY - Math.round((targetY - rot.y) / (2 * Math.PI)) * 2 * Math.PI;   // shortest path
      fly.active = true; fly.t = 0; fly.from = { x: rot.x, y: rot.y }; fly.to = { x: lat * D2R, y: ty }; fly.dist = dist || targetDist; fly.startDist = targetDist; userZoomed = true;
    }

    function resize() {
      const w = container.clientWidth || 1, h = container.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      const narrow = w < 720;
      camera.fov = narrow ? 48 : 38; camera.updateProjectionMatrix();
      if (!userZoomed) { targetDist = narrow ? 4.6 : (w < 1100 ? 4.0 : 3.6); camDist = targetDist; }
    }
    window.addEventListener('resize', resize); resize();

    /* ───────────── sun ───────────── */
    const params = { sea: 0, heat: 0, temp: 1.2, forest: 31, grid: 0, climate: false, realSun: true };
    const layers = { currents: true, climate: false, supply: true, carbon: false, clouds: true };
    function sunLocal(date) {
      const start = Date.UTC(date.getUTCFullYear(), 0, 0), doy = (date - start) / 864e5;
      const decl = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365);
      const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
      let lon = 180 - h * 15; lon = ((lon + 540) % 360) - 180;
      return ll2v(decl, lon);
    }
    const sunWorld = new THREE.Vector3(), studioSun = new THREE.Vector3(0.55, 0.35, 1).normalize();

    /* ───────────── frame ───────────── */
    let fps = 0, frames = 0, fpsT = performance.now();
    function frame(now, dt, t) {
      if (fly.active) {
        fly.t = Math.min(1, fly.t + dt * 1.4); const s = fly.t * fly.t * (3 - 2 * fly.t);
        rot.x = lerp(fly.from.x, fly.to.x, s); rot.y = lerp(fly.from.y, fly.to.y, s); targetDist = lerp(fly.startDist, fly.dist, s);
        if (fly.t >= 1) { fly.active = false; targetDist = fly.dist; }
      } else if (!dragging) {
        const auto = camDist > 2.4 ? rot.auto : 0;
        const damp = Math.pow(0.92, dt * 60);   // frame-rate independent inertia
        rot.y += rot.vy + auto * dt * 60; rot.x += rot.vx; rot.vx *= damp; rot.vy *= damp; rot.x = clamp(rot.x, -1.45, 1.45);
      }
      world.rotation.set(rot.x, rot.y, 0); atmo.rotation.copy(world.rotation);
      clouds.rotation.y += 0.0003 * dt * 60;
      camDist += (targetDist - camDist) * (1 - Math.exp(-dt * 7));   // time-based easing
      if (Math.abs(targetDist - camDist) < 0.002) camDist = targetDist;
      camera.position.set(0, 0.25 * clamp((camDist - 1.2) / 2.4, 0, 1), camDist); camera.lookAt(0, 0, 0);
      ring.rotation.z += 0.0006 * dt * 60; ring.visible = camDist > 2.2;

      world.updateMatrixWorld();
      if (params.realSun) { sunWorld.copy(sunLocal(new Date())).applyQuaternion(world.quaternion); } else sunWorld.copy(studioSun);
      U.sunDir.value.copy(sunWorld); U.camPos.value.copy(camera.position);
      cloudLight.position.copy(sunWorld).multiplyScalar(10);
      U.uFlicker.value = params.grid > 30 ? 0.6 + 0.4 * Math.sin(t * 17) * Math.sin(t * 5.3) : 1;
      const heatT = clamp((params.temp - 1.5) / 3.5, 0, 1);
      atmo.material.uniforms.c.value.setRGB(lerp(0, 0.96, heatT), lerp(0.78, 0.5, heatT), lerp(1, 0.2, heatT));
      if (hires.mesh && patchU.uFade.value < 1) patchU.uFade.value = Math.min(1, patchU.uFade.value + dt * 2.5);

      if (layers.currents) currents.update(t);
      if (layers.supply) supply.update(t, params.grid);
      if (layers.carbon) carbon.update(t, params.temp);
      hiresTick();
      renderer.render(scene, camera);
      frames++; if (now - fpsT > 1000) { fps = frames; frames = 0; fpsT = now; }
    }

    /* ───────────── public API ───────────── */
    function setParams(p) {
      Object.assign(params, p);
      U.uSea.value = params.sea; U.uHeat.value = Math.max(0, params.temp - 1.0); U.uForest.value = params.forest / 100; U.uGrid.value = params.grid / 100;
      U.uClimate.value = layers.climate ? 1 : 0;
    }
    function setLayers(l) {
      Object.assign(layers, l);
      currents.group.visible = layers.currents; supply.group.visible = layers.supply; carbon.obj.visible = layers.carbon; clouds.visible = layers.clouds;
      U.uClimate.value = layers.climate ? 1 : 0;
      if (l.realsun !== undefined) params.realSun = !!l.realsun;
      if (l.hires !== undefined) { hires.enabled = !!l.hires; if (!hires.enabled) disposePatch(); }
    }
    function sample(store, lat, lon) {
      if (!store.data) return null;
      const x = clamp(Math.floor((lon + 180) / 360 * store.w), 0, store.w - 1), y = clamp(Math.floor((90 - lat) / 180 * store.h), 0, store.h - 1);
      const i = (y * store.w + x) * 4; return { r: store.data[i], g: store.data[i + 1], b: store.data[i + 2] };
    }
    function elevationAt(lat, lon) { const s = sample(elevData, lat, lon); return s ? s.r / 255 * 8848 : null; }
    function nightAt(lat, lon) { const s = sample(nightData, lat, lon); return s ? (0.299 * s.r + 0.587 * s.g + 0.114 * s.b) / 255 : null; }
    function isDaylit(lat, lon) { const v = ll2v(lat, lon); return v.dot(params.realSun ? sunLocal(new Date()) : studioSun.clone().applyQuaternion(world.quaternion.clone().invert())) > 0; }

    return {
      load: loadAssets, frame, resize, setParams, setLayers, flyTo, pick, elevationAt, nightAt, isDaylit, HUBS,
      setExag(v) { U.uExag.value = v; },
      setProvider(p, key) { if (p !== hires.provider || key !== hires.googleKey) { hires.provider = p; hires.googleKey = key || ''; hires.session = null; disposePatch(); } },
      get state() { return { fps, camDist, ready: status.ready, hires: hires.mesh ? hires.attribution : '', hiresBusy: hires.busy, isGL2, maxTex, dayLoaded: status.dayLoaded }; },
      get camDist() { return camDist; },
      debugHires() { return { enabled: hires.enabled, online: navigator.onLine, ready: status.ready, dragging, camDist, targetDist, rect: viewRect(), key: hires.key, busy: hires.busy, attribution: hires.attribution }; },
    };
  }

  return { create, ll2v, v2ll };
})();
