export const CONFIG = {
  essaisMax: 3,         // essais par joueur : tirage au premier panier, ou après le dernier essai même raté
  verrouApresTirage: 1200, // ms : juste après un tirage, ENTRÉE est ignorée (double appui du buzzer)
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
export const W = 1280, H = 720;
export const F = 700, CX = 640, CY = 470, YC = 2.4;          // focale, centre d'écran, hauteur de caméra
export const proj = (X, Y, Z) => {                           // point 3D -> écran
  const k = F / Math.max(Z, .2);
  return { x: CX + X * k, y: CY - (Y - YC) * k, k };
};
export const RIM_Y = 3.05, RIM_Z = 3.2, RIM_R = .34;         // cercle (un peu agrandi pour le jeu)
export const BALL_R = .12;
export const BOARD_Z = RIM_Z + RIM_R + .15;                  // plan du panneau
export const DEPART = { X: 0, Y: 2.1, Z: 1.1 };              // ballon devant le tireur
export const GRAV = 9.8;
export const DRIBBLE_BAS = 1.88, DRIBBLE_HAUT = .4;          // la balle rebondit en bas de l'écran, sans cacher le panier
