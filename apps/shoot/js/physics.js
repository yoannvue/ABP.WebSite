import { CONFIG, W, H, proj, RIM_Y, RIM_Z, RIM_R, BALL_R, BOARD_Z, DEPART, GRAV } from './config.js';

export const PAS = 1 / 240, TUBE = .02, REST_CERCLE = .6, REST_PLANCHE = .7;

export function simulerTir(px, py, Y0 = DEPART.Y) {
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

export function libelleTir(sim, j) {
  if (sim.marque) {
    if (sim.planche) return ['Par la planche !', 'orange'];
    if (sim.cercle) return ['Sur le cercle…', 'orange'];
    return ['SWISH !', 'or'];
  }
  if (Math.abs(j.x) > Math.abs(j.y)) return j.x < 0 ? ['Trop à gauche !', 'rouge'] : ['Trop à droite !', 'rouge'];
  return j.y > 0 ? ['Trop court !', 'rouge'] : ['Trop fort !', 'rouge'];
}
