import { CONFIG, W, H, DEPART, DRIBBLE_BAS, DRIBBLE_HAUT } from './js/config.js';
import { createAudio } from './js/audio.js';
import { createTicketPool } from './js/tickets.js';
import { PAS, simulerTir, libelleTir } from './js/physics.js';
import { createRenderer } from './js/renderer.js';
import { installerEntrees } from './js/input.js';

const $ = id => document.getElementById(id);
const elMsg = $('msg'), elFlash = $('flash'), elCard = $('card'), elAnnonce = $('annonce');
const elResultatPrecedent = $('resultatPrecedent');
const elTombolaToggle = $('tombolaToggle'), elTombolaStatus = $('tombolaStatus');
const { initAudio, son, toggle: toggleSound } = createAudio();
const tickets = createTicketPool();
let tombolaActive = false;

const G = {
  etat: 'suivant',         // suivant | prepare | jauge | tir | rate | tirage | resultat | resultatTir
  jauge: { x: 0, y: 0, vx: 0, vy: 0, wx: 0, wy: 0, prochain: 0, temps: 0, hist: [] },
  gel: 0,
  essai: 0,
  aMarque: false,
  balle: { X: DEPART.X, Y: DEPART.Y, Z: DEPART.Z, vX: 0, vY: 0, vZ: 0, rot: 0 },
  shot: null,
  reussi: true, scored: false, animFinie: false, tirageLance: false, verrou: 0,
  netT: 99, revealT: -1,
  particules: [],
  dernierAppui: 0,
  attenteConfirmation: false
};
let tAbs = 0;

function placerBalle() {
  Object.assign(G.balle, { X: DEPART.X, Y: DEPART.Y, Z: DEPART.Z, vX: 0, vY: 0, vZ: 0, rot: 0 });
}

const renderer = createRenderer({ wrap: $('wrap'), canvas: $('cv'), state: G, getTime: () => tAbs });

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
  $('restants').textContent = tombolaActive && tickets.restants !== null ? tickets.restants : '–';
  $('modeLabel').textContent = !tombolaActive
    ? G.essai > 0
      ? `Tombola désactivée · Tir ${G.essai} / ${CONFIG.essaisMax}`
      : `Tombola désactivée · ${CONFIG.essaisMax} tirs par joueur`
    : G.essai === 0
      ? '2 lancers · 3e si aucun panier'
      : G.essai === 1
        ? 'Lancer 1/2 · 2e garanti'
        : G.essai === 2
          ? G.aMarque ? 'Lancer 2/2 · tirage ensuite' : 'Lancer 2/2 · 3e si aucun panier'
          : '3e tentative · dernière chance';
}
function majTombolaToggle() {
  elTombolaToggle.textContent = tombolaActive ? 'Tombola activée' : 'Tombola désactivée';
  elTombolaToggle.setAttribute('aria-pressed', String(tombolaActive));
  majStats();
}
async function basculerTombola() {
  tombolaActive = !tombolaActive;
  majTombolaToggle();
  if (!tombolaActive) {
    elResultatPrecedent.classList.remove('visible');
    elResultatPrecedent.textContent = '';
    elTombolaStatus.textContent = 'Le jeu continue sans tirage.';
    return;
  }
  if (!elResultatPrecedent.textContent) {
    elResultatPrecedent.textContent = 'Résultat précédent : aucun tirage';
  }
  elResultatPrecedent.classList.add('visible');
  elTombolaStatus.textContent = 'Connexion à l’API…';
  try {
    await tickets.refresh();
    elTombolaStatus.textContent = '';
  } catch (e) {
    elTombolaStatus.textContent = `API indisponible : ${e.message}`;
  }
  majStats();
}
function annonce(titre, sous, classe) {                // grand message devant le panier
  elAnnonce.className = 'on ' + classe;
  elAnnonce.querySelector('.titre').textContent = titre;
  elAnnonce.querySelector('.sous').innerHTML = sous;
}
function annonceOff() { elAnnonce.className = ''; }

/* ---------- Cadran ---------- */
function demarrerJauge() {                            // début d'un essai : le cadran démarre, la balle rebondit
  G.essai++;
  annonceOff();
  elCard.classList.remove('visible', 'gagnant');
  G.dribble = .1;                                      // phase du rebond de la balle
  G.etat = 'jauge';
  G.jauge = nouvelleBille();
  G.gel = 0;
  placerBalle();
  elFlash.className = '';
  const instruction = '<kbd>ENTRÉE</kbd> quand la bille est sur la cible !';
  const consigne = !tombolaActive
    ? G.essai >= CONFIG.essaisMax ? 'DERNIER ESSAI' : ''
    : G.essai === 1 ? '1er lancer · un 2e est garanti'
      : G.essai === 2 ? G.aMarque ? '2e et dernier lancer' : '2e lancer · 3e si aucun panier'
        : '3e et dernière tentative';
  setMsg(`${consigne ? `${consigne} – ` : ''}${instruction}`, true);
  son('lancer');
  majStats();
}

function nouvelleBille() {                            // la bille part d'un point au hasard, loin du centre
  const a = Math.random() * 2 * Math.PI, r = (.6 + Math.random() * .3) * CONFIG.amplitudeVisee;
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

function lacher(delai = false) {                       // delai = true : 5 s écoulées sans appui
  const j = G.jauge, Y0 = G.balle.Y;                   // le tir part de là où se trouve la balle qui rebondit
  G.gel = .8;                                          // le cadran reste affiché un instant, figé
  let sim;
  if (delai) {                                         // lancer sans force : la balle retombe toujours courte
    sim = simulerTir(0, 1, Y0);
    for (let n = 0; n < 10 && sim.marque; n++) sim = simulerTir(0, 1, Y0);
  } else {
    sim = simulerTir(j.x, j.y, Y0);                    // aucun coup de pouce : un tir raté reste raté
  }
  G.reussi = sim.marque;
  const [txt, col] = delai ? ['Temps écoulé !', 'rouge'] : libelleTir(sim, j);
  flash(txt, col);
  setMsg(null);
  son('lancer');
  G.shot = { sim, t: 0, e: 0, fini: false };
  G.scored = false; G.animFinie = false; G.revealT = -1;
  G.etat = 'tir';
}

function marquer() {
  if (G.scored) return;
  G.scored = true; G.netT = 0;
  G.aMarque = true;
  son('filet');
  son('applaudissements');
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

function finTir() {                                    // le ballon a fini son vol
  G.animFinie = true;
  if (G.reussi) {
    if (!G.scored) marquer();
    if (doitContinuerApresTir()) {
      attendreEssaisRestants();
    } else if (tombolaActive) {
      setMsg('Fin des lancers – place au tirage !', false);
      G.revealT = .85;
    } else {
      G.etat = 'resultatTir';
      G.attenteConfirmation = true;
      G.verrou = performance.now() + CONFIG.verrouApresTirage;
      setMsg('Panier marqué – <kbd>ENTRÉE</kbd> pour le joueur suivant', true);
    }
    return;
  }
  son('rate');
  if (doitContinuerApresTir()) {                       // il reste des essais : on attend ENTRÉE
    G.etat = 'rate';
    attendreEssaisRestants();
  } else {                                             // tous les lancers sont terminés
    setMsg(tombolaActive ? 'Fin des lancers – place au tirage !' : 'Dernier essai raté.', false);
    G.revealT = .9;
  }
}

function doitContinuerApresTir() {
  return tombolaActive
    ? G.essai < 2 || (G.essai === 2 && !G.aMarque)
    : G.essai < CONFIG.essaisMax;
}

function attendreEssaisRestants() {
  G.revealT = -1;
  G.etat = 'rate';
  if (tombolaActive) {
    const suite = G.essai === 1
      ? 'Un 2e lancer est garanti'
      : 'Aucun panier sur les 2 premiers : 3e tentative';
    setMsg(`${G.scored ? 'Panier marqué !' : 'Raté !'} ${suite} – <kbd>ENTRÉE</kbd>`, true);
    return;
  }

  const reste = CONFIG.essaisMax - G.essai;
  setMsg(`${G.scored ? 'Panier marqué !' : 'Raté !'} Encore ${reste} tir${reste > 1 ? 's' : ''} – <kbd>ENTRÉE</kbd>`, true);
}

async function reveler() {                             // LE tirage de la tombola : une seule fois par joueur, à la fin
  G.revealT = -1;                                      // stoppe définitivement le timer dès le premier appel
  G.attenteConfirmation = false;
  if (!tombolaActive) {
    if (!G.animFinie) {
      G.revealT = .15;
      return;
    }
    if (G.essai < CONFIG.essaisMax) {
      attendreEssaisRestants();
      return;
    }
    const note = G.scored
      ? 'Panier marqué – <kbd>ENTRÉE</kbd> pour le joueur suivant'
      : 'Essais terminés – <kbd>ENTRÉE</kbd> pour le joueur suivant';
    G.revealT = -1;
    G.etat = 'resultatTir';
    G.attenteConfirmation = true;
    G.verrou = performance.now() + CONFIG.verrouApresTirage;
    setMsg(note, true);
    return;
  }
  if (G.tirageLance) return;                           // évite un second tirage si l'appel arrive deux fois
  G.tirageLance = true;                                // à partir d'ici il est irréversible : Échap n'a plus d'effet
  G.revealT = -1;
  G.etat = 'tirage';
  setMsg(null);
  annonceOff();
  let t = null, erreur = null;
  try { t = await tickets.draw(); } catch (e) { erreur = e; console.error(e); }
  const num = $('num'), verdict = $('verdict'), lot = $('lot');
  elCard.classList.remove('gagnant');
  if (erreur) {
    num.textContent = '!'; verdict.textContent = 'Erreur de tirage'; lot.textContent = erreur.message;
    elResultatPrecedent.textContent = `Résultat précédent : erreur de tirage — ${erreur.message}`;
  } else if (!t) {
    num.textContent = '–'; verdict.textContent = 'Plus de tickets'; lot.textContent = '';
    elResultatPrecedent.textContent = 'Résultat précédent : plus de tickets disponibles';
  } else {
    num.textContent = String(t.numero).padStart(3, '0');
    if (t.gagnant) {
      elCard.classList.add('gagnant');
      verdict.textContent = 'GAGNANT !'; lot.textContent = t.lot || '';
      elResultatPrecedent.textContent = `Résultat précédent : ticket ${t.numero} — GAGNANT !${t.lot ? ` — ${t.lot}` : ''}`;
    } else {
      verdict.textContent = 'Pas gagnant'; lot.textContent = '';
      elResultatPrecedent.textContent = `Résultat précédent : ticket ${t.numero} — pas gagnant`;
    }
  }
  elResultatPrecedent.classList.add('visible');
  elCard.classList.add('visible');
  if (t && t.gagnant) { confettis(); son('gagne'); } else son('neutre');
  G.verrou = performance.now() + CONFIG.verrouApresTirage;
  G.revealT = -1;
  G.etat = 'resultat';
  G.attenteConfirmation = true;
  G.shot = null;
  setMsg(null);
  annonceOff();
}


/* ---------- Les étapes : Joueur suivant -> On se prépare -> On joue ---------- */
function afficherSuivant(note) {                       // étape « Joueur suivant » (aussi l'état de départ)
  G.etat = 'suivant'; G.shot = null; G.essai = 0; G.gel = 0;
  G.scored = false; G.aMarque = false; G.animFinie = false; G.revealT = -1; G.tirageLance = false;
  G.attenteConfirmation = false;
  elFlash.className = '';
  setMsg(null);
  placerBalle();
  annonce('Joueur suivant', note || '<kbd>ENTRÉE</kbd> pour continuer', 'suivant');
  majStats();
}

function confirmerResultat() {
  if (!G.attenteConfirmation) return;
  elCard.classList.remove('visible', 'gagnant');
  G.particules = [];
  G.revealT = -1;
  afficherSuivant();
}
function preparer() {                                  // étape « On se prépare » : la balle attend dans les mains du joueur
  if (tombolaActive && tickets.restants === 0) {
    annonce('Tombola terminée', '<kbd>R</kbd> pour réinitialiser', 'suivant');
    return;
  }
  G.particules = [];
  G.etat = 'prepare'; G.essai = 0; G.aMarque = false;
  placerBalle();
  const consigne = tombolaActive
    ? '2 lancers garantis · 3e tentative si aucun panier'
    : `${CONFIG.essaisMax} essais pour marquer`;
  annonce('On se prépare', `<kbd>ENTRÉE</kbd> quand le joueur est prêt<br>${consigne}`, 'prepare');
  majStats();
}
function annuler() {                                   // ÉCHAP remet le jeu à « Joueur suivant »
  if (G.etat === 'suivant') return;
  if (G.etat === 'tirage') return;                    // le tirage déjà envoyé à l'API ne peut pas être annulé
  elCard.classList.remove('visible', 'gagnant');
  G.particules = [];
  G.verrou = 0;
  G.dernierAppui = 0;
  afficherSuivant();
}

/* ---------- Entrées ---------- */
function buzzer() {
  const now = performance.now();
  if (now - G.dernierAppui < CONFIG.antiRebond) return;
  if ((G.etat === 'suivant' || G.etat === 'resultat' || G.etat === 'resultatTir') && now < G.verrou) return;  // laisse voir le résultat avant toute action
  G.dernierAppui = now;
  initAudio();
  switch (G.etat) {
    case 'suivant': preparer(); break;                 // -> On se prépare
    case 'prepare': demarrerJauge(); break;            // -> On joue (essai 1)
    case 'jauge': lacher(); break;                     // le tir part
    case 'rate': demarrerJauge(); break;               // essai suivant
    case 'resultat':
    case 'resultatTir':
      confirmerResultat();
      break;
    // 'tir' : on laisse finir le vol, puis le tirage éventuel, puis « Joueur suivant »
  }
}
function reinitialiser() {                             // touche R : remet la tombola à zéro (seulement entre deux joueurs)
  if (G.etat !== 'suivant') return;
  if (!tombolaActive) return;
  const saisieRatio = window.prompt('Tickets perdants par ticket gagnant ?', '1');
  if (saisieRatio === null) return;
  const perdantsParGagnant = Number(saisieRatio);
  if (!Number.isSafeInteger(perdantsParGagnant) || perdantsParGagnant < 0) {
    elTombolaStatus.textContent = 'Saisissez un nombre entier positif ou nul pour le ratio.';
    return;
  }
  elTombolaStatus.textContent = 'Réinitialisation des tickets…';
  tickets.reset(perdantsParGagnant).then(() => {
    elTombolaStatus.textContent = '';
    majStats();
    elCard.classList.remove('visible', 'gagnant');
    afficherSuivant();
  }).catch(e => {
    elTombolaStatus.textContent = `Impossible d’actualiser les tickets : ${e.message}`;
  });
}

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
  if (G.etat === 'suivant' || G.etat === 'prepare') {  // balle tenue en main, qui respire à peine
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
      const r = (.55 + Math.random() * .4) * CONFIG.amplitudeVisee, n = Math.min(1, CONFIG.nervosite + .4 * p);   // et change de cap de plus en plus souvent
      j.wx = Math.cos(ang) * r; j.wy = Math.sin(ang) * r;
      j.prochain = (.9 - .6 * n) + Math.random() * (.7 - .4 * n);
      dx = j.wx - j.x; dy = j.wy - j.y; dist = Math.hypot(dx, dy) || 1;
    }
    const k = Math.min(1, dt * 6);                     // la bille prend de l'élan : trajectoires arrondies, pas de virage sec
    j.vx += (dx / dist * v - j.vx) * k;
    j.vy += (dy / dist * v - j.vy) * k;
    j.x += j.vx * dt; j.y += j.vy * dt;
    const m = Math.hypot(j.x, j.y);
    if (m > CONFIG.amplitudeVisee) { j.x *= CONFIG.amplitudeVisee / m; j.y *= CONFIG.amplitudeVisee / m; }
    j.hist.push([j.x, j.y]); if (j.hist.length > 9) j.hist.shift();
    if (j.temps >= CONFIG.delaiMax) {                  // temps écoulé
      lacher(true);                                    // 5 s sans tirer : le tir est raté
    }
  }
  if (G.gel > 0) G.gel -= dt;
  if (G.shot && (G.etat === 'tir' || G.etat === 'rate')) majTir(dt);
  G.netT += dt;
  if (G.revealT > 0 && (G.etat === 'tir' || G.etat === 'rate')) {
    G.revealT -= dt;
    if (G.revealT <= 0) reveler();
  }
  for (const p of G.particules) { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx += Math.sin(tAbs * 3 + p.rot) * 20 * dt; }
  G.particules = G.particules.filter(p => p.y < H + 30);
}



let dernier = performance.now();
function boucle(now) {
  const dt = Math.min(.05, (now - dernier) / 1000);
  dernier = now;
  maj(dt); renderer.dessiner();
  requestAnimationFrame(boucle);
}
elTombolaToggle.addEventListener('click', e => {
  if (e.detail === 0) return;
  basculerTombola();
});
installerEntrees({ buzzer, annuler, reinitialiser, initAudio, toggleSound });
renderer.redimensionner();
majStats();
afficherSuivant();
if (tombolaActive) {
  elTombolaStatus.textContent = 'Connexion à l’API…';
  tickets.refresh().then(() => {
    elTombolaStatus.textContent = '';
    majStats();
  }).catch(e => {
    elTombolaStatus.textContent = `API indisponible : ${e.message}`;
  });
}
requestAnimationFrame(boucle);
