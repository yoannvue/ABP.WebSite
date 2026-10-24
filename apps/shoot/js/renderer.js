import { CONFIG, W, H, F, CX, CY, RIM_Y, RIM_Z, RIM_R, BALL_R, BOARD_Z, proj } from './config.js';

export function createRenderer({ wrap, canvas, state, getTime }) {
  const cv = canvas, ctx = cv.getContext('2d'), G = state;
  let echelle = 1;
  function redimensionner() {
    const dpr = window.devicePixelRatio || 1, w = wrap.clientWidth;
    wrap.style.fontSize = (w / W) + 'px';
    wrap.style.setProperty('--u', (w / W) + 'px');
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * H / W);
    echelle = cv.width / W; decorFond = null;
  }
  window.addEventListener('resize', redimensionner);

  /* ---------- Dessin ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- Décor : salle de basket en soirée, éclairage néon ----------
     Deux calques fixes dessinés une seule fois (fond : murs, charpente, parquet ; avant : public, brume,
     vignette) et, entre les deux, ce qui bouge : faisceaux des projecteurs, bokeh, enseigne qui crépite. */
  const NEON = { m: '#ff2bd6', c: '#28e7ff', v: '#8a5cff', o: '#ff8a2b' };
  const LAMPES = [{ x: 160, c: NEON.m }, { x: 330, c: NEON.c }, { x: 500, c: NEON.v },
                  { x: 780, c: NEON.o }, { x: 950, c: NEON.m }, { x: 1120, c: NEON.c }];
  const logoClub = new Image();
  logoClub.src = new URL('../resources/logo-abp.png', import.meta.url);
  let decorFond = null, decorAvant = null, bokeh = [];

  function alea(graine) {                                // petit générateur pseudo-aléatoire : le décor est toujours identique
    return () => {
      graine |= 0; graine = graine + 0x6D2B79F5 | 0;
      let t = Math.imul(graine ^ graine >>> 15, 1 | graine);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const cheminRR = (g, x, y, w, h, r) => {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  const ligne = (x1, y1, x2, y2) => g => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); };
  const balleNeon = (cx, cy, r) => g => {
    g.beginPath(); g.arc(cx, cy, r, 0, 7);
    g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
    g.moveTo(cx - r * 1.15 + r * .92 * Math.cos(.95), cy - r * .92 * Math.sin(.95)); g.arc(cx - r * 1.15, cy, r * .92, -.95, .95);
    g.moveTo(cx + r * 1.15 + r * .92 * Math.cos(Math.PI - .95), cy - r * .92 * Math.sin(.95)); g.arc(cx + r * 1.15, cy, r * .92, Math.PI - .95, Math.PI + .95);
  };

  function neonTrait(g, couleur, largeur, tracer) {      // tube néon : halo large et doux + cœur presque blanc
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
    for (const [k, a] of [[8, .05], [4.5, .1], [2.4, .22]]) { g.globalAlpha = a; g.lineWidth = largeur * k; g.strokeStyle = couleur; tracer(g); g.stroke(); }
    g.globalAlpha = 1; g.lineWidth = largeur; g.strokeStyle = couleur; tracer(g); g.stroke();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = .85; g.lineWidth = largeur * .38; g.strokeStyle = '#fff'; tracer(g); g.stroke();
    g.restore();
  }
  function neonTexte(g, txt, x, y, couleur, taille, alpha) {
    g.save(); g.font = `800 ${taille}px "Segoe UI", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = Math.round(taille * .16) + 'px';
    g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[taille * .5, .05], [taille * .3, .1], [taille * .14, .22]]) { g.globalAlpha = a * alpha; g.lineWidth = w; g.strokeStyle = couleur; g.strokeText(txt, x, y); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = alpha;
    g.lineWidth = taille * .05; g.strokeStyle = couleur; g.fillStyle = '#fff'; g.strokeText(txt, x, y); g.fillText(txt, x, y);
    g.restore();
  }

  function peindreFond(g) {
    let d = g.createLinearGradient(0, 0, 0, H);
    d.addColorStop(0, '#04050d'); d.addColorStop(.55, '#090e29'); d.addColorStop(1, '#10143a');
    g.fillStyle = d; g.fillRect(0, 0, W, H);

    // murs latéraux, en perspective vers le point de fuite
    for (const cote of [-1, 1]) {
      const X = x => cote < 0 ? x : W - x;
      const m = g.createLinearGradient(X(0), 0, X(120), 0);
      m.addColorStop(0, '#05071a'); m.addColorStop(1, '#0b1133');
      g.fillStyle = m; g.beginPath(); g.moveTo(X(0), 2); g.lineTo(X(120), 90); g.lineTo(X(120), 640); g.lineTo(X(0), 679); g.closePath(); g.fill();
    }
    // mur du fond : panneaux acoustiques + protège-mur matelassé
    d = g.createLinearGradient(0, 90, 0, 640); d.addColorStop(0, '#0c1235'); d.addColorStop(1, '#131b4a');
    g.fillStyle = d; g.fillRect(120, 90, 1040, 550);
    for (let x = 120, k = 0; x < 1160; x += 52, k++) {
      g.fillStyle = k % 2 ? 'rgba(255,255,255,.022)' : 'rgba(0,0,0,.12)'; g.fillRect(x, 90, 52, 550);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 90, 1.5, 550);
    }
    g.fillStyle = 'rgba(6,8,26,.75)'; g.fillRect(120, 575, 1040, 65);
    g.fillStyle = 'rgba(138,92,255,.25)'; g.fillRect(120, 575, 1040, 2);

    // lumières d'ambiance colorées
    g.save(); g.globalCompositeOperation = 'lighter';
    const lueur = (x, y, r, c) => {
      const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, c); q.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    lueur(150, 330, 540, 'rgba(255,43,214,.17)');
    lueur(1130, 330, 540, 'rgba(40,231,255,.16)');
    lueur(640, 0, 520, 'rgba(138,92,255,.2)');
    lueur(640, 305, 360, 'rgba(255,70,220,.28)');        // halo derrière la planche
    lueur(640, 305, 220, 'rgba(120,200,255,.14)');
    g.restore();

    // plafond : charpente en perspective, croisillons, tubes néon
    const kc = 90 / 470;
    g.save();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 2); g.lineTo(1160, 90); g.lineTo(120, 90); g.lineTo(0, 2); g.closePath(); g.clip();
    g.fillStyle = '#03040b'; g.fillRect(0, 0, W, 92);
    g.strokeStyle = 'rgba(130,150,230,.2)'; g.lineWidth = 2;
    for (let xt = -420; xt <= 1700; xt += 150) { g.beginPath(); g.moveTo(xt, 0); g.lineTo(xt + (640 - xt) * kc, 90); g.stroke(); }
    for (const y of [14, 36, 62]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.lineWidth = 1; g.strokeStyle = 'rgba(130,150,230,.12)';
    for (let x = -40; x < W + 80; x += 60) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 30, 36); g.lineTo(x + 60, 14); g.stroke(); }
    g.restore();
    neonTrait(g, NEON.c, 2.2, ligne(290, 0, 290 + (640 - 290) * kc, 90));
    neonTrait(g, NEON.m, 2.2, ligne(990, 0, 990 + (640 - 990) * kc, 90));

    // néons des murs latéraux, cadre lumineux autour de la planche, décor mural
    neonTrait(g, NEON.m, 2.4, ligne(120, 300, 0, 261)); neonTrait(g, NEON.m, 2.4, ligne(120, 560, 0, 581));
    neonTrait(g, NEON.c, 2.4, ligne(1160, 300, 1280, 261)); neonTrait(g, NEON.c, 2.4, ligne(1160, 560, 1280, 581));
    neonTrait(g, NEON.c, 3.2, g2 => cheminRR(g2, 392, 98, 496, 502, 70));
    neonTrait(g, NEON.o, 3.2, balleNeon(250, 300, 46));
    neonTrait(g, NEON.c, 2, ligne(930, 246, 1130, 246));

    // parquet de nuit, reflets des néons
    d = g.createLinearGradient(0, 640, 0, H); d.addColorStop(0, '#8a5a2c'); d.addColorStop(1, '#3b220e');
    g.fillStyle = d; g.fillRect(0, 640, W, H - 640);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
    const t = (H - 640) / (H - CY);
    for (let x = -600; x <= W + 600; x += 130) { g.beginPath(); g.moveTo(x + (CX - x) * t, 640); g.lineTo(x, H); g.stroke(); }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [x, c, rx] of [[190, 'rgba(255,43,214,.34)', 420], [1090, 'rgba(40,231,255,.32)', 420], [640, 'rgba(138,92,255,.16)', 380]]) {
      g.save(); g.translate(x, 668); g.scale(1, .2);
      const q = g.createRadialGradient(0, 0, 0, 0, 0, rx); q.addColorStop(0, c); q.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = q; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore();
    }
    g.restore();
    neonTrait(g, NEON.m, 2.6, ligne(0, 641, 430, 641)); neonTrait(g, NEON.v, 2.6, ligne(430, 641, 850, 641)); neonTrait(g, NEON.c, 2.6, ligne(850, 641, W, 641));

    // projecteurs au plafond
    for (const l of LAMPES) {
      g.fillStyle = '#11152e'; g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(l.x - 16, 34); g.lineTo(l.x + 16, 34); g.lineTo(l.x + 10, 58); g.lineTo(l.x - 10, 58); g.closePath(); g.fill(); g.stroke();
      g.save(); g.globalCompositeOperation = 'lighter';
      const q = g.createRadialGradient(l.x, 60, 0, l.x, 60, 34);
      q.addColorStop(0, l.c + 'cc'); q.addColorStop(.3, l.c + '55'); q.addColorStop(1, l.c + '00');
      g.fillStyle = q; g.fillRect(l.x - 34, 26, 68, 68); g.restore();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(l.x, 58, 4, 0, 7); g.fill();
    }
  }

  function peindrePublic(g, cote, graine) {              // cote : -1 = gradins de gauche, 1 = de droite
    const A = alea(graine), rim = cote < 0 ? NEON.m : NEON.c, rim2 = cote < 0 ? NEON.v : NEON.o;
    const X = x => cote < 0 ? x : W - x;
    for (let i = 0; i < 5; i++) {                        // du fond vers l'avant
      const base = 452 + i * 38, s = .8 + i * .13, bord = 250 + i * 30;
      const gr = g.createLinearGradient(X(0), 0, X(bord), 0);
      gr.addColorStop(0, 'rgba(10,13,40,1)'); gr.addColorStop(.7, 'rgba(10,13,40,.92)'); gr.addColorStop(1, 'rgba(10,13,40,0)');
      g.fillStyle = gr; g.fillRect(cote < 0 ? 0 : W - bord, base - 4, bord, 44);
      const lisere = g.createLinearGradient(X(0), 0, X(bord), 0);
      lisere.addColorStop(0, rim + '90'); lisere.addColorStop(1, rim + '00');
      g.fillStyle = lisere; g.fillRect(cote < 0 ? 0 : W - bord, base - 4, bord, 2);
      for (let x = 14 + A() * 16; x < bord - 22; x += (24 + i * 5) * (.85 + A() * .5)) {
        const hx = X(x), sc = s * (.9 + A() * .2), hy = base - 16 * s, r = 8 * sc;
        const a = Math.min(1, .3 + (Math.abs(hx - 640) - 190) / 170);
        const [a0, a1] = cote < 0 ? [-1.3, .4] : [Math.PI - .4, Math.PI + 1.3];
        g.globalAlpha = a;
        g.fillStyle = '#04060d'; g.beginPath(); g.ellipse(hx, base + 8 * s, 15 * sc, 15 * sc, 0, 0, 7); g.fill();
        if (A() < .12) { g.strokeStyle = '#04060d'; g.lineWidth = 4 * sc; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx + 11 * sc, base - 2); g.lineTo(hx + 17 * sc, base - 32 * s); g.stroke(); }
        g.beginPath(); g.arc(hx, hy, r, 0, 7); g.fillStyle = '#080b1c'; g.fill();
        g.lineWidth = 1.6; g.strokeStyle = A() < .5 ? rim : rim2;
        g.globalAlpha = a * .75; g.beginPath(); g.arc(hx, hy, r, a0, a1); g.stroke();
        g.beginPath(); g.ellipse(hx, base + 8 * s, 15 * sc, 15 * sc, 0, cote < 0 ? -1.4 : Math.PI + .2, cote < 0 ? -.2 : Math.PI + 1.4); g.stroke();
        if (A() < .07) {                                 // un téléphone allumé dans la foule
          g.globalAlpha = a; g.fillStyle = '#d8f0ff'; g.fillRect(hx + 11 * sc, base - 30 * s, 5, 8);
          const q = g.createRadialGradient(hx + 13 * sc, base - 26 * s, 0, hx + 13 * sc, base - 26 * s, 16);
          q.addColorStop(0, 'rgba(180,225,255,.45)'); q.addColorStop(1, 'rgba(180,225,255,0)');
          g.fillStyle = q; g.fillRect(hx + 13 * sc - 16, base - 26 * s - 16, 32, 32);
        }
        g.globalAlpha = 1;
      }
    }
  }

  function peindreAvant(g) {
    const b = g.createLinearGradient(0, 500, 0, 640); b.addColorStop(0, 'rgba(120,90,255,0)'); b.addColorStop(1, 'rgba(120,90,255,.12)');
    g.fillStyle = b; g.fillRect(0, 500, W, 140);       // brume au ras du sol
    peindrePublic(g, -1, 11); peindrePublic(g, 1, 29);
    const v = g.createRadialGradient(640, 330, 260, 640, 330, 860);   // vignette : on regarde le panier
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  function construireDecor() {
    const mk = () => {
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
      const g = c.getContext('2d'); g.setTransform(echelle, 0, 0, echelle, 0, 0); return { c, g };
    };
    const f = mk(), a = mk();
    peindreFond(f.g); peindreAvant(a.g);
    decorFond = f.c; decorAvant = a.c;
    const R = alea(7), cols = [NEON.m, NEON.c, NEON.v, NEON.o];
    bokeh = Array.from({ length: 30 }, () => ({ x: 40 + R() * 1200, y: 110 + R() * 330, r: 5 + R() * 14, c: cols[Math.floor(R() * 4)], ph: R() * 6.28 }));
  }

  function dessinerAnimDecor() {                         // ce qui bouge dans la salle
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    LAMPES.forEach((l, i) => {                           // faisceaux qui balaient la salle
      const xb = l.x + Math.sin(getTime() * .55 + i * 1.7) * 260 + (640 - l.x) * .25;
      const q = ctx.createLinearGradient(l.x, 58, xb, 640);
      q.addColorStop(0, l.c + '55'); q.addColorStop(.6, l.c + '18'); q.addColorStop(1, l.c + '00');
      ctx.fillStyle = q; ctx.beginPath(); ctx.moveTo(l.x - 6, 58); ctx.lineTo(l.x + 6, 58); ctx.lineTo(xb + 80, 640); ctx.lineTo(xb - 80, 640); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(xb, 662); ctx.scale(1, .16);          // tache de lumière sur le parquet
      const p = ctx.createRadialGradient(0, 0, 0, 0, 0, 95); p.addColorStop(0, l.c + '66'); p.addColorStop(1, l.c + '00');
      ctx.fillStyle = p; ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.fill(); ctx.restore();
    });
    for (const b of bokeh) {                             // bokeh : points lumineux qui respirent
      const a = .1 + .09 * Math.sin(getTime() * .8 + b.ph), y = b.y + Math.sin(getTime() * .3 + b.ph) * 6;
      ctx.globalAlpha = a; ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, 7); ctx.fill();
      ctx.globalAlpha = a * 1.6; ctx.lineWidth = 1.5; ctx.strokeStyle = b.c; ctx.stroke();
    }
    ctx.restore();
    const flick = Math.sin(getTime() * 3.1) * Math.sin(getTime() * 5.3) > .93 ? .35 : 1;   // l'enseigne crépite de temps en temps
    neonTexte(ctx, 'BASKET', 250, 205, NEON.m, 42, flick);
    if (logoClub.complete && logoClub.naturalWidth) {
      const x = 970, y = 106, hauteur = 240;
      const largeur = hauteur * logoClub.naturalWidth / logoClub.naturalHeight;
      ctx.save();
      ctx.globalAlpha = .7;
      ctx.shadowColor = NEON.o;
      ctx.shadowBlur = 28;
      ctx.drawImage(logoClub, x, y, largeur, hauteur);
      ctx.restore();
      ctx.drawImage(logoClub, x, y, largeur, hauteur);
    }
  }

  function dessinerDecor() {
    if (!decorFond) construireDecor();
    ctx.drawImage(decorFond, 0, 0, W, H);
    dessinerAnimDecor();
    ctx.drawImage(decorAvant, 0, 0, W, H);
  }

  function dessinerFlammes() {
    const duree = 2.4;
    if (G.netT >= duree) return;

    const intensite = 1 - G.netT / duree;
    const temps = getTime();
    const x = 392, y = 98, largeur = 496, hauteur = 502, rayon = 70;
    const cotes = [
      { x: x + rayon, y, dx: 1, dy: 0, nx: 0, ny: 1, longueur: largeur - rayon * 2 },
      { x: x + largeur - rayon, y: y + hauteur, dx: -1, dy: 0, nx: 0, ny: -1, longueur: largeur - rayon * 2 },
      { x, y: y + rayon, dx: 0, dy: 1, nx: 1, ny: 0, longueur: hauteur - rayon * 2 },
      { x: x + largeur, y: y + hauteur - rayon, dx: 0, dy: -1, nx: -1, ny: 0, longueur: hauteur - rayon * 2 }
    ];

    ctx.save();
    rr(x, y, largeur, hauteur, rayon);
    ctx.globalAlpha = intensite * .9;
    ctx.strokeStyle = '#ff8a2b';
    ctx.lineWidth = 18;
    ctx.shadowColor = '#ff4b12';
    ctx.shadowBlur = 34;
    ctx.stroke();

    ctx.shadowBlur = 0;
    cotes.forEach((cote, coteIndex) => {
      for (let position = 0, index = 0; position < cote.longueur; position += 17, index++) {
        const phase = temps * 11 + index * 2.13 + coteIndex * 3.7;
        const longueur = (24 + (Math.sin(phase) * .5 + .5) * 42) * intensite;
        const demiLargeur = 5 + (Math.sin(phase * .73) * .5 + .5) * 6;
        const bx = cote.x + cote.dx * position, by = cote.y + cote.dy * position;
        const px = bx + cote.dx * demiLargeur, py = by + cote.dy * demiLargeur;
        const qx = bx + cote.nx * (longueur * .7) + cote.dx * Math.sin(phase) * 7;
        const qy = by + cote.ny * (longueur * .7) + cote.dy * Math.sin(phase) * 7;
        const tipX = bx + cote.nx * longueur, tipY = by + cote.ny * longueur;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(qx - cote.dx * demiLargeur, qy - cote.dy * demiLargeur, tipX, tipY);
        ctx.quadraticCurveTo(qx + cote.dx * demiLargeur, qy + cote.dy * demiLargeur, bx - cote.dx * demiLargeur, by - cote.dy * demiLargeur);
        ctx.closePath();
        ctx.fillStyle = index % 3 === 0 ? '#ffdf70' : '#ff7024';
        ctx.globalAlpha = intensite * (.65 + (Math.sin(phase * 1.4) * .5 + .5) * .35);
        ctx.shadowColor = '#ff4b12';
        ctx.shadowBlur = 14;
        ctx.fill();
      }
    });
    ctx.restore();
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
    dessinerFlammes();
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

  return { redimensionner, dessiner };
}
