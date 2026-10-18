/* =====================================================================
   TOMBOLA – TIR AU PANIER, VUE DE FACE  (prototype)
   La caméra est derrière le tireur : le ballon part vers le panier en
   rapetissant (perspective 3D simplifiée, calculée à la main).

   - ENTRÉE (buzzer) ou toucher l'écran : 1er appui = lance le cadran,
     2e appui = tire.
   - Le geste n'influence que le SPECTACLE, jamais le numéro tiré.

   Branchement sur ton appli : cherche "BRANCHEMENT SQL" plus bas.
   ===================================================================== */
(() => {
'use strict';

/* ---------- Réglages ---------- */
const CONFIG = {
  mode: 'reussite',     // 'reussite': zone rouge = raté, on rejoue (dernier essai garanti)
                        // 'garanti' : un ticket sort toujours (seul le suspense change)
  essaisMax: 3,         // utilisé en mode 'reussite'
  vitesse: 1.3,         // vitesse de la bille au départ, en rayons de cadran par seconde
  vitesseMax: 3.6,      // vitesse atteinte au bout du délai : plus on attend, plus la bille s'affole
  delaiMax: 5,          // secondes : sans tir au bout de ce délai, le tir est raté
  nervosite: 0.5,       // 0 = oscillations calmes, 1 = changements de cap très fréquents
  zoneSwish: 0.11,      // rayon de la cible verte (fraction du rayon du cadran)
  zoneCercle: 0.27,     // rayon de la zone orange
  precision: 1.35,      // écart latéral du tir (en mètres) pour une bille décalée d'un rayon de cadran, à gauche ou à droite
  puissance: 0.255,     // erreur de puissance pour une bille décalée d'un rayon de cadran, en haut ou en bas (0.255 = 25,5 %)
  dureeVol: 1.05,       // durée du vol du ballon (s) : plus court = tir plus tendu
  antiRebond: 250       // ms minimum entre deux appuis du buzzer
};

/* ---------- Scène 3D (unités : mètres) et caméra ---------- */
const W = 1280, H = 720;
const F = 700, CX = 640, CY = 470, YC = 2.4;          // focale, centre d'écran, hauteur de caméra
const proj = (X, Y, Z) => {                           // point 3D -> écran
  const k = F / Math.max(Z, .2);
  return { x: CX + X * k, y: CY - (Y - YC) * k, k };
};
const RIM_Y = 3.05, RIM_Z = 3.2, RIM_R = .34;         // cercle (un peu agrandi pour le jeu)
const BALL_R = .12;
const BOARD_Z = RIM_Z + RIM_R + .15;                  // plan du panneau
const DEPART = { X: 0, Y: 2.1, Z: 1.1 };              // ballon devant le tireur
const GRAV = 9.8;
const DRIBBLE_BAS = 1.88, DRIBBLE_HAUT = .4;          // la balle rebondit en bas de l'écran, sans cacher le panier

/* =====================================================================
   BRANCHEMENT SQL
   Remplace piocherTicket() par l'appel à ton back-end, par exemple :
     const r = await fetch('/api/tirage', { method: 'POST' });
     return r.ok ? await r.json() : null;
   Elle doit renvoyer { numero, gagnant, lot } (lot peut être null),
   ou null s'il n'y a plus de tickets.
   Ici : simulation en mémoire, 200 tickets dont 24 gagnants.
   ===================================================================== */
const LOTS = ['Maillot du club', 'Ballon dédicacé', 'Place pour un match', 'Sweat du club', 'Bon d’achat 20 €', 'Panier garni'];
const pool = { restants: [], gagnants: new Map() };

function initPool() {
  pool.restants = Array.from({ length: 200 }, (_, i) => i + 1);
  pool.gagnants = new Map();
  const m = [...pool.restants];
  for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
  m.slice(0, 24).forEach((n, i) => pool.gagnants.set(n, LOTS[i % LOTS.length]));
}
async function piocherTicket() {
  if (!pool.restants.length) return null;
  const i = Math.floor(Math.random() * pool.restants.length);
  const numero = pool.restants.splice(i, 1)[0];
  const lot = pool.gagnants.get(numero) || null;
  return { numero, gagnant: !!lot, lot };
}
/* ================= fin du branchement SQL ================= */

/* ---------- DOM / canvas ---------- */
const $ = id => document.getElementById(id);
const wrap = $('wrap'), cv = $('cv'), ctx = cv.getContext('2d');
const elMsg = $('msg'), elFlash = $('flash'), elCard = $('card');
let echelle = 1;

function redimensionner() {
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  wrap.style.fontSize = (w / W) + 'px';
  wrap.style.setProperty('--u', (w / W) + 'px');
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(w * dpr * H / W);
  echelle = cv.width / W;
}
window.addEventListener('resize', redimensionner);

/* ---------- État du jeu ---------- */
const G = {
  etat: 'idle',            // idle | jauge | tir | resultat | rate
  jauge: { x: 0, y: 0, vx: 0, vy: 0, wx: 0, wy: 0, prochain: 0, temps: 0, hist: [] },
  gel: 0,
  essai: 0,
  balle: { X: DEPART.X, Y: DEPART.Y, Z: DEPART.Z, vX: 0, vY: 0, vZ: 0, rot: 0 },
  shot: null,
  reussi: true, scored: false, animFinie: false, revele: false,
  netT: 99, revealT: -1,
  ticketPromise: null,
  particules: [],
  dernierAppui: 0
};
let tAbs = 0;

function placerBalle() {
  Object.assign(G.balle, { X: DEPART.X, Y: DEPART.Y, Z: DEPART.Z, vX: 0, vY: 0, vZ: 0, rot: 0 });
}

/* ---------- Sons (WebAudio, aucun fichier) ---------- */
let AC = null, sonActif = true;
function initAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function bip(freq, dur, type = 'sine', vol = .15, vers = null, delai = 0) {
  if (!AC) return;
  const t0 = AC.currentTime + delai;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (vers) o.frequency.exponentialRampToValueAtTime(vers, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(AC.destination);
  o.start(t0); o.stop(t0 + dur + .02);
}
function bruit(dur, vol, fHaut) {
  if (!AC) return;
  const n = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = fHaut;
  const g = AC.createGain(); const t0 = AC.currentTime;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(f).connect(g).connect(AC.destination); s.start(t0);
}
function son(nom) {
  if (!AC || !sonActif) return;
  switch (nom) {
    case 'lancer': bip(300, .3, 'sine', .1, 800); break;
    case 'dribble': bip(150, .09, 'sine', .16, 70); break;
    case 'rim':    bip(1250, .35, 'sine', .16); bip(1870, .22, 'sine', .07); break;
    case 'board':  bip(190, .22, 'triangle', .3, 80); bruit(.08, .12, 1500); break;
    case 'filet':  bruit(.4, .2, 3500); break;
    case 'gagne':  [523, 659, 784, 1047].forEach((f, i) => bip(f, .35, 'triangle', .16, null, i * .12)); break;
    case 'neutre': bip(392, .3, 'triangle', .12); bip(330, .4, 'triangle', .12, null, .15); break;
    case 'rate':   bip(240, .4, 'sawtooth', .07, 130); break;
  }
}

/* ---------- Interface ---------- */
function setMsg(html, pulse) {
  if (html == null) { elMsg.classList.remove('on', 'pulse'); return; }
  elMsg.innerHTML = html;
  elMsg.classList.add('on');
  elMsg.classList.toggle('pulse', !!pulse);
}
function flash(texte, couleur) {
  elFlash.className = '';
  void elFlash.offsetWidth;            // relance l'animation
  elFlash.textContent = texte;
  elFlash.className = 'show ' + couleur;
}
function majStats() {
  $('restants').textContent = pool.restants.length;
  $('modeLabel').textContent = CONFIG.mode === 'garanti'
    ? 'Mode : tirage garanti'
    : `Mode : il faut marquer (${CONFIG.essaisMax} essais)`;
}

/* ---------- Cadran ---------- */
function demarrerJauge() {
  if (pool.restants.length === 0) {
    setMsg('Tombola terminée – <kbd>R</kbd> pour réinitialiser');
    return;
  }
  G.essai = (G.etat === 'rate') ? Math.min(CONFIG.essaisMax, G.essai + 1) : 1;   // après un délai dépassé au dernier essai, il reste « dernier »
  G.dribble = .1;                                      // phase du rebond de la balle
  G.etat = 'jauge';
  G.jauge = nouvelleBille();
  G.gel = 0;
  placerBalle();
  elFlash.className = '';
  const dernier = CONFIG.mode === 'reussite' && G.essai >= CONFIG.essaisMax;
  setMsg(dernier ? 'DERNIER ESSAI – <kbd>ENTRÉE</kbd> sur la cible !' : '<kbd>ENTRÉE</kbd> quand la bille est sur la cible !', true);
  son('lancer');
}

function nouvelleBille() {                            // la bille part d'un point au hasard, loin du centre
  const a = Math.random() * 2 * Math.PI, r = .6 + Math.random() * .3;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, wx: 0, wy: 0, prochain: 0, temps: 0, hist: [] };
}

/* ---------- Simulation physique du tir ----------
   (px, py) = position de la bille dans le cadran, en rayons (-1 à 1).
     px : décale la direction à gauche / à droite.
     py : erreur de puissance : sous le centre = lancer trop faible (trop court), au-dessus = trop fort.
   Pile au centre, le ballon est lancé pour arriver exactement dans le cercle. Avec une erreur, sa vitesse
   de lancer est multipliée (puissance) ou sa direction décalée (côté). Ensuite tout est physique :
   gravité, rebond sur la planche, choc contre le tube du cercle, filet qui freine.
   Le résultat (panier ou non, par la planche ou le cercle) sort de la simulation.      */
const PAS = 1 / 240, TUBE = .02, REST_CERCLE = .6, REST_PLANCHE = .7;

function simulerTir(px, py, Y0 = DEPART.Y) {
  const K = CONFIG.precision, T = CONFIG.dureeVol;
  const bruit = () => (Math.random() - .5) * .03;       // petite imprécision : deux tirs identiques ne sont jamais jumeaux
  const f = 1 - py * CONFIG.puissance + (Math.random() - .5) * .008;   // facteur de puissance
  const Xc = px * K + bruit();
  let X = DEPART.X, Y = Y0, Z = DEPART.Z;
  let vX = (Xc - X) / T, vZ = (RIM_Z - Z) / T * f, vY = (RIM_Y - Y + .5 * GRAV * T * T) / T * f;
  let rot = 0;
  const vr = (Math.random() < .5 ? -1 : 1) * (4 + Math.random() * 3);
  const traj = [[X, Y, Z, rot]], evts = [];
  let t = 0, ts = null, cercle = false, planche = false, dernierEvt = -1;
  const evt = type => { if (t - dernierEvt > .06) { evts.push({ t, type }); dernierEvt = t; } };

  while (t < 4) {
    const yPrev = Y;
    vY -= GRAV * PAS;
    if (ts !== null && Y < RIM_Y && Y > RIM_Y - .55 && Math.hypot(X, Z - RIM_Z) < RIM_R) {   // le filet freine la balle
      const q = Math.exp(-9 * PAS); vX *= q; vZ *= q; if (vY < 0) vY *= Math.exp(-1.6 * PAS);
    }
    X += vX * PAS; Y += vY * PAS; Z += vZ * PAS; rot += vr * PAS; t += PAS;

    // planche : plan vertical, rebond amorti
    if (vZ > 0 && Z + BALL_R > BOARD_Z && Z - BALL_R < BOARD_Z + .05 &&
        Math.abs(X) < .9 + BALL_R * .5 && Y > 2.9 - BALL_R * .5 && Y < 3.95 + BALL_R * .5) {
      Z = BOARD_Z - BALL_R; vZ = -vZ * (REST_PLANCHE + (Math.random() - .5) * .16);   // rebond jamais identique
      vX = vX * .9 + (Math.random() - .5) * .6; vY *= .9;
      if (ts === null) planche = true;
      evt('board');
    }
    // cercle : tube circulaire, on cherche son point le plus proche de la balle
    const dx = X, dz = Z - RIM_Z, hd = Math.hypot(dx, dz) || 1e-6;
    const ex = X - RIM_R * dx / hd, ey = Y - RIM_Y, ez = dz - RIM_R * dz / hd;
    const dist = Math.hypot(ex, ey, ez);
    if (dist < BALL_R + TUBE) {
      const nx = ex / dist, ny = ey / dist, nz = ez / dist, pen = BALL_R + TUBE - dist;
      X += nx * pen; Y += ny * pen; Z += nz * pen;
      const vn = vX * nx + vY * ny + vZ * nz;
      if (vn < 0) {
        const f = (1 + REST_CERCLE) * vn;
        vX = (vX - f * nx) * .97; vY = (vY - f * ny) * .97; vZ = (vZ - f * nz) * .97;
        if (ts === null) cercle = true;
        evt('rim');
      }
    }
    // panier : le centre de la balle traverse le plan du cercle en descendant, à l'intérieur
    if (ts === null && yPrev > RIM_Y && Y <= RIM_Y && Math.hypot(X, Z - RIM_Z) < RIM_R - .03) ts = t;

    traj.push([X, Y, Z, rot]);
    const p = proj(X, Y, Z);
    if ((p.y - BALL_R * p.k > H + 20 && vY < 0) || Z < .3 || Z > 12 || Math.abs(p.x) > W + 400) break;
  }
  return { traj, evts, ts, marque: ts !== null, cercle, planche };
}

function libelleTir(sim, j) {
  if (sim.marque) {
    if (sim.planche) return ['Par la planche !', 'orange'];
    if (sim.cercle) return ['Sur le cercle…', 'orange'];
    return ['SWISH !', 'or'];
  }
  if (Math.abs(j.x) > Math.abs(j.y)) return j.x < 0 ? ['Trop à gauche !', 'rouge'] : ['Trop à droite !', 'rouge'];
  return j.y > 0 ? ['Trop court !', 'rouge'] : ['Trop fort !', 'rouge'];
}

function lacher(delai = false) {                       // delai = true : 5 s écoulées sans appui
  const j = G.jauge, Y0 = G.balle.Y;                   // le tir part de là où se trouve la balle qui rebondit
  G.gel = .8;                                          // le cadran reste affiché un instant, figé
  const forcer = CONFIG.mode === 'garanti' || G.essai >= CONFIG.essaisMax;   // dernier essai ou mode garanti : le panier finit par rentrer
  let sim;
  if (delai) {                                         // lancer sans force : la balle retombe toujours courte
    sim = simulerTir(0, 1, Y0);
    for (let n = 0; n < 10 && sim.marque; n++) sim = simulerTir(0, 1, Y0);
  } else {
    sim = simulerTir(j.x, j.y, Y0);
    if (!sim.marque && forcer) {                       // la chance sourit : on ramène le tir vers le centre jusqu'à ce qu'il rentre
      for (let k = .85; k > 0 && !sim.marque; k -= .1) sim = simulerTir(j.x * k, j.y * k, Y0);
      if (!sim.marque) sim = simulerTir(0, 0, Y0);
    }
  }
  G.reussi = sim.marque;
  G.ticketPromise = G.reussi ? piocherTicket() : null;  // le numéro est fixé AVANT l'animation
  const [txt, col] = delai ? ['Temps écoulé !', 'rouge'] : libelleTir(sim, j);
  flash(txt, col);
  setMsg(null);
  son('lancer');
  G.shot = { sim, t: 0, e: 0, fini: false };
  G.scored = false; G.animFinie = false; G.revele = false; G.revealT = -1;
  G.etat = 'tir';
}

function marquer() {
  if (G.scored) return;
  G.scored = true; G.netT = 0; G.revealT = .85;
  son('filet');
}

function majTir(dt) {                                  // rejoue la trajectoire calculée, à vitesse réelle
  const s = G.shot, b = G.balle;
  if (!s || s.fini) return;
  const sim = s.sim;
  s.t += dt;
  while (s.e < sim.evts.length && sim.evts[s.e].t <= s.t) son(sim.evts[s.e++].type);
  if (!G.scored && sim.ts !== null && s.t >= sim.ts) marquer();
  const f = Math.min(sim.traj.length - 1, s.t / PAS), i = Math.floor(f), u = f - i;
  const A = sim.traj[i], B = sim.traj[Math.min(i + 1, sim.traj.length - 1)];
  b.X = A[0] + (B[0] - A[0]) * u; b.Y = A[1] + (B[1] - A[1]) * u;
  b.Z = A[2] + (B[2] - A[2]) * u; b.rot = A[3] + (B[3] - A[3]) * u;
  if (s.t >= (sim.traj.length - 1) * PAS) { s.fini = true; finTir(); }
}

function finTir() {
  G.animFinie = true;
  if (!G.reussi) {
    G.etat = 'rate';
    const reste = CONFIG.essaisMax - G.essai;
    son('rate');
    setMsg(reste > 0 ? `Raté ! Encore ${reste} essai${reste > 1 ? 's' : ''} – <kbd>ENTRÉE</kbd>`
                     : 'Raté ! Le prochain tir sera le bon – <kbd>ENTRÉE</kbd>', true);
    return;
  }
  if (!G.scored) marquer();                             // sécurité
  verifEtat();
}
function verifEtat() { if (G.animFinie && G.revele) G.etat = 'resultat'; }

async function reveler() {
  const t = await G.ticketPromise;
  const num = $('num'), verdict = $('verdict'), lot = $('lot');
  elCard.classList.remove('gagnant');
  if (!t) {
    num.textContent = '–'; verdict.textContent = 'Plus de tickets'; lot.textContent = '';
  } else {
    num.textContent = t.numero;
    if (t.gagnant) {
      elCard.classList.add('gagnant');
      verdict.textContent = 'GAGNANT !'; lot.textContent = t.lot || '';
    } else {
      verdict.textContent = 'Pas gagnant cette fois…'; lot.textContent = '';
    }
  }
  elCard.classList.add('visible');
  if (t && t.gagnant) { confettis(); son('gagne'); } else son('neutre');
  majStats();
  G.revele = true; verifEtat();
}

function retourIdle() {
  elCard.classList.remove('visible', 'gagnant');
  elFlash.className = '';
  G.etat = 'idle'; G.shot = null; G.essai = 0; G.gel = 0;
  G.scored = false; G.animFinie = false; G.revele = false; G.revealT = -1;
  G.particules = [];
  placerBalle();
  setMsg('<kbd>ENTRÉE</kbd> ou touche l’écran pour armer le tir', true);
}

/* ---------- Entrées ---------- */
function buzzer() {
  const now = performance.now();
  if (now - G.dernierAppui < CONFIG.antiRebond) return;
  G.dernierAppui = now;
  initAudio();
  switch (G.etat) {
    case 'idle': case 'rate': demarrerJauge(); break;
    case 'jauge': lacher(); break;
    case 'resultat': retourIdle(); break;
    case 'tir': if (G.revele) retourIdle(); break;
  }
}
function reinitialiser() { initPool(); majStats(); retourIdle(); }
function basculerMode() {
  if (G.etat !== 'idle' && G.etat !== 'resultat') return;
  CONFIG.mode = CONFIG.mode === 'garanti' ? 'reussite' : 'garanti';
  majStats();
  if (G.etat === 'resultat') retourIdle();
}
window.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) buzzer(); return; }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (k === 'm') basculerMode();
  else if (k === 's') sonActif = !sonActif;
  else if (k === 'r') reinitialiser();
  else if (k === 'f') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }
});
/* Toucher l'écran (téléphone, tablette, écran tactile) ou cliquer = même effet que ENTRÉE */
window.addEventListener('pointerdown', e => { e.preventDefault(); buzzer(); }, { passive: false });

/* ---------- Confettis ---------- */
const COULEURS = ['#f58220', '#ffd166', '#3ddc84', '#4da3ff', '#ff5d8f', '#ffffff'];
function confettis() {
  for (let i = 0; i < 180; i++) {
    G.particules.push({
      x: Math.random() * W, y: -20 - Math.random() * 320,
      vx: (Math.random() - .5) * 120, vy: 140 + Math.random() * 220,
      rot: Math.random() * 6, vr: (Math.random() - .5) * 10,
      c: COULEURS[Math.floor(Math.random() * COULEURS.length)]
    });
  }
}

/* ---------- Mise à jour ---------- */
function maj(dt) {
  tAbs += dt;
  const b = G.balle;
  if (G.etat === 'idle') {                             // balle tenue en main, qui respire à peine
    b.X = DEPART.X; b.Y = DEPART.Y + Math.sin(tAbs * 3) * .03; b.Z = DEPART.Z; b.rot += dt * .5;
  } else if (G.etat === 'jauge') {                     // dès le premier appui : la balle rebondit, de plus en plus vite
    const p = Math.min(1, G.jauge.temps / CONFIG.delaiMax);
    const avant = G.dribble;
    G.dribble = (G.dribble + dt / (.62 - .3 * p)) % 1;
    if (G.dribble < avant) son('dribble');             // un « toc » à chaque rebond
    b.X = DEPART.X; b.Z = DEPART.Z;
    b.Y = DRIBBLE_BAS + DRIBBLE_HAUT * 4 * G.dribble * (1 - G.dribble);
    b.rot += dt * (2 + 5 * p);
  }
  if (G.etat === 'jauge') {
    const j = G.jauge;
    j.temps += dt;
    const p = Math.min(1, j.temps / CONFIG.delaiMax);   // 0 au départ, 1 à la fin du délai
    const v = CONFIG.vitesse + (CONFIG.vitesseMax - CONFIG.vitesse) * p;
    j.prochain -= dt;
    let dx = j.wx - j.x, dy = j.wy - j.y, dist = Math.hypot(dx, dy);
    if (j.prochain <= 0 || dist < .08) {               // nouveau point visé : de l'autre côté du centre, angle au hasard
      const ang = Math.atan2(-j.y, -j.x) + (Math.random() - .5) * 1.8;
      const r = .55 + Math.random() * .4, n = Math.min(1, CONFIG.nervosite + .4 * p);   // et change de cap de plus en plus souvent
      j.wx = Math.cos(ang) * r; j.wy = Math.sin(ang) * r;
      j.prochain = (.9 - .6 * n) + Math.random() * (.7 - .4 * n);
      dx = j.wx - j.x; dy = j.wy - j.y; dist = Math.hypot(dx, dy) || 1;
    }
    const k = Math.min(1, dt * 6);                     // la bille prend de l'élan : trajectoires arrondies, pas de virage sec
    j.vx += (dx / dist * v - j.vx) * k;
    j.vy += (dy / dist * v - j.vy) * k;
    j.x += j.vx * dt; j.y += j.vy * dt;
    const m = Math.hypot(j.x, j.y);
    if (m > 1) { j.x /= m; j.y /= m; }
    j.hist.push([j.x, j.y]); if (j.hist.length > 9) j.hist.shift();
    if (j.temps >= CONFIG.delaiMax) {                  // temps écoulé
      if (CONFIG.mode === 'garanti') lacher(); else lacher(true);   // garanti : le tir part où est la bille ; sinon : raté
    }
  }
  if (G.gel > 0) G.gel -= dt;
  if (G.shot && (G.etat === 'tir' || G.etat === 'rate' || G.etat === 'resultat')) majTir(dt);
  G.netT += dt;
  if (G.revealT > 0) { G.revealT -= dt; if (G.revealT <= 0) reveler(); }
  for (const p of G.particules) { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx += Math.sin(tAbs * 3 + p.rot) * 20 * dt; }
  G.particules = G.particules.filter(p => p.y < H + 30);
}

/* ---------- Dessin ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function dessinerDecor() {
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#08121f'); g.addColorStop(1, '#17375f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // gradins du fond
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < W / 40; i += 2) ctx.fillRect(i * 40, 300, 40, 340);
  // projecteurs
  for (const x of [260, 1020]) {
    const r = ctx.createRadialGradient(x, -40, 10, x, -40, 600);
    r.addColorStop(0, 'rgba(255,255,255,.16)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, 640);
  }
  // parquet en perspective
  g = ctx.createLinearGradient(0, 640, 0, H);
  g.addColorStop(0, '#d29150'); g.addColorStop(1, '#9c6230');
  ctx.fillStyle = g; ctx.fillRect(0, 640, W, H - 640);
  ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 2;
  const t = (H - 640) / (H - CY);
  for (let x = -600; x <= W + 600; x += 130) {
    ctx.beginPath(); ctx.moveTo(x + (CX - x) * t, 640); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, 645, W, 4);
}

function dessinerPlanche() {
  const a = proj(-.9, 3.95, BOARD_Z), b = proj(.9, 2.9, BOARD_Z);
  // suspension au plafond
  ctx.fillStyle = '#2b3a4f'; ctx.fillRect(CX - 10, 0, 20, a.y + 4);
  // panneau
  rr(a.x, a.y, b.x - a.x, b.y - a.y, 8);
  ctx.fillStyle = 'rgba(235,245,255,.92)'; ctx.fill();
  ctx.strokeStyle = '#9fb4cc'; ctx.lineWidth = 3; ctx.stroke();
  // carré peint
  const c = proj(-.3, 3.5, BOARD_Z), d = proj(.3, RIM_Y, BOARD_Z);
  ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 4;
  ctx.strokeRect(c.x, c.y, d.x - c.x, d.y - c.y);
  // attache du cercle
  const r0 = proj(0, RIM_Y, RIM_Z + RIM_R), r1 = proj(0, RIM_Y, BOARD_Z);
  ctx.strokeStyle = '#d14a1a'; ctx.lineWidth = r1.k * .05; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.stroke();
}

function dessinerCercle(partie) {                      // 'arriere' (derrière la balle) ou 'avant' (devant)
  const t0 = partie === 'arriere' ? 0 : Math.PI, n = 28;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = t0 + Math.PI * i / n;
    const p = proj(RIM_R * Math.cos(th), RIM_Y, RIM_Z + RIM_R * Math.sin(th));
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  }
  ctx.strokeStyle = partie === 'arriere' ? '#c9461a' : '#ff5a1f';
  ctx.lineWidth = .035 * F / RIM_Z; ctx.lineCap = 'round';
  ctx.stroke();
}

function dessinerFilet(partie) {
  const N = 12, L = 5;
  const sway = Math.sin(G.netT * 20) * Math.exp(-G.netT * 3.5) * .07;
  const bulge = Math.exp(-G.netT * 6) * .25;
  const brins = [];
  for (let i = 0; i < N; i++) {
    const th = 2 * Math.PI * i / N, row = [];
    for (let j = 0; j < L; j++) {
      const f = j / (L - 1);
      const rad = (RIM_R + (.2 - RIM_R) * f) * (1 + bulge * Math.sin(Math.PI * f));
      row.push(proj(rad * Math.cos(th) + sway * f, RIM_Y - .5 * f, RIM_Z + rad * Math.sin(th)));
    }
    brins.push({ row, s: Math.sin(th) });
  }
  const dedans = s => partie === 'arriere' ? s >= 0 : s < 0;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.7; ctx.lineCap = 'butt';
  for (const br of brins) {
    if (!dedans(br.s)) continue;
    ctx.beginPath(); br.row.forEach((p, j) => j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  }
  for (let i = 0; i < N; i++) {
    const A = brins[i], B = brins[(i + 1) % N];
    if (!dedans((A.s + B.s) / 2)) continue;
    ctx.beginPath();
    for (let j = 0; j < L - 1; j++) {
      ctx.moveTo(A.row[j].x, A.row[j].y); ctx.lineTo(B.row[j + 1].x, B.row[j + 1].y);
      ctx.moveTo(B.row[j].x, B.row[j].y); ctx.lineTo(A.row[j + 1].x, A.row[j + 1].y);
    }
    ctx.stroke();
  }
}

function dessinerBalle() {
  const b = G.balle, p = proj(b.X, b.Y, b.Z), r = BALL_R * p.k;
  if (p.y - r > H + 20 || r > 1200) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.rotate(b.rot);
  const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r);
  g.addColorStop(0, '#ffa04d'); g.addColorStop(1, '#d95f10');
  ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.strokeStyle = '#3a1805'; ctx.lineWidth = Math.max(1.5, r * .08);
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  ctx.beginPath(); ctx.arc(-r * 1.15, 0, r * .92, -.95, .95); ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 1.15, 0, r * .92, Math.PI - .95, Math.PI + .95); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, r * .06);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke();
}

function dessinerJauge() {
  const actif = G.etat === 'jauge';
  if (!actif && G.gel <= 0) return;
  const hg = proj(-.3, 3.5, BOARD_Z), bd = proj(.3, RIM_Y, BOARD_Z);       // coins du rectangle orange peint sur la planche
  const j = G.jauge, cx = (hg.x + bd.x) / 2, cy = (hg.y + bd.y) / 2, R = 175;   // cadran centré sur ce rectangle, en surimpression
  const disque = (r, fill) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); };
  ctx.save();
  ctx.globalAlpha = actif ? 1 : Math.min(1, G.gel / .4) * .8;           // après le tir : reste un instant, puis s'efface
  disque(R + 16, 'rgba(8,16,28,.4)');                                   // fond translucide : le panier reste visible dessous
  const reste = Math.max(0, 1 - j.temps / CONFIG.delaiMax);             // temps restant : 1 -> 0
  if (reste > .004) {
    ctx.beginPath(); ctx.arc(cx, cy, R + 8, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * reste);
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = `hsl(${Math.round(120 * reste)}, 85%, 55%)`; ctx.stroke();
    ctx.lineCap = 'butt';
  }
  disque(R, 'rgba(160,62,62,.22)');                                     // zone ratée
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  disque(R * CONFIG.zoneCercle, 'rgba(242,163,58,.42)');                // zone orange
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
  disque(R * CONFIG.zoneSwish, 'rgba(61,220,132,.65)');                 // cible verte, sur le panier
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5;        // viseur
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  j.hist.forEach(([hx, hy], i) => {                                     // traînée
    ctx.beginPath(); ctx.arc(cx + hx * R, cy + hy * R, 4 + i * .9, 0, 7);
    ctx.fillStyle = `rgba(255,255,255,${(i + 1) / j.hist.length * .3})`; ctx.fill();
  });
  const bx = cx + j.x * R, by = cy + j.y * R;                           // la bille
  ctx.beginPath(); ctx.arc(bx, by, 13, 0, 7);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#0d1b2a'; ctx.stroke();
  ctx.restore();
}

function dessinerConfettis() {
  for (const p of G.particules) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.c; ctx.fillRect(-6, -3, 12, 6); ctx.restore();
  }
}

function dessiner() {
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  dessinerDecor();
  const derriere = G.balle.Z > BOARD_Z + BALL_R * .5;     // balle passée derrière la planche
  if (derriere) dessinerBalle();
  dessinerPlanche();
  dessinerCercle('arriere');
  dessinerFilet('arriere');
  // la balle passe devant le cercle tant qu'elle est plus proche de la caméra que lui
  const devant = G.balle.Z < RIM_Z - RIM_R - BALL_R * .5;
  if (!devant && !derriere) dessinerBalle();
  dessinerFilet('avant');
  dessinerCercle('avant');
  if (devant && !derriere) dessinerBalle();
  dessinerJauge();
  dessinerConfettis();
}

/* ---------- Démarrage ---------- */
let dernier = performance.now();
function boucle(now) {
  const dt = Math.min(.05, (now - dernier) / 1000);
  dernier = now;
  maj(dt); dessiner();
  requestAnimationFrame(boucle);
}
initPool();
redimensionner();
majStats();
retourIdle();
requestAnimationFrame(boucle);
})();
