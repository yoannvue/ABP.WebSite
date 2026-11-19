import { API_URL } from './js/tickets.js';

const $ = id => document.getElementById(id);
const formatNumber = new Intl.NumberFormat('fr-FR');
const formatPercent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const status = $('status');
const refreshButton = $('refreshButton');
const lotsList = $('lotsList');
let loading = false;

function entierPositifOuNul(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`La statistique « ${label} » renvoyée par l’API est invalide.`);
  }
  return value;
}

function analyserStatistiques(data) {
  if (!data || !Array.isArray(data.lots)) {
    throw new Error('La réponse de l’API ne contient pas la liste des lots.');
  }

  const ticketsTotaux = entierPositifOuNul(data.ticketsTotaux, 'ticketsTotaux');
  const ticketsRestants = entierPositifOuNul(data.ticketsRestants, 'ticketsRestants');
  const ticketsGagnantsRestants = entierPositifOuNul(
    data.ticketsGagnantsRestants,
    'ticketsGagnantsRestants'
  );
  const lots = data.lots.map(lot => ({
    nom: typeof lot.nom === 'string' ? lot.nom : '',
    quantite: entierPositifOuNul(lot.quantite, 'quantite'),
    restants: entierPositifOuNul(lot.restants, 'restants')
  }));

  if (lots.some(lot => !lot.nom || lot.restants > lot.quantite)) {
    throw new Error('La réponse de l’API contient des données de lot incohérentes.');
  }

  const ticketsGagnants = lots.reduce((total, lot) => total + lot.quantite, 0);
  const ticketsGagnantsRestantsParLot = lots.reduce((total, lot) => total + lot.restants, 0);
  if (ticketsRestants > ticketsTotaux
      || ticketsGagnants > ticketsTotaux
      || ticketsGagnantsRestants !== ticketsGagnantsRestantsParLot
      || ticketsGagnantsRestants > ticketsRestants) {
    throw new Error('Les totaux de tickets renvoyés par l’API sont incohérents.');
  }

  const ticketsTires = ticketsTotaux - ticketsRestants;
  const ticketsGagnantsTires = ticketsGagnants - ticketsGagnantsRestants;
  const ticketsPerdants = ticketsTotaux - ticketsGagnants;
  const ticketsPerdantsRestants = ticketsRestants - ticketsGagnantsRestants;
  const ticketsPerdantsTires = ticketsTires - ticketsGagnantsTires;

  return {
    ticketsTotaux,
    ticketsRestants,
    ticketsTires,
    ticketsGagnants,
    ticketsGagnantsRestants,
    ticketsGagnantsTires,
    ticketsPerdants,
    ticketsPerdantsRestants,
    ticketsPerdantsTires,
    lots
  };
}

function afficherLot(lot) {
  const gagnes = lot.quantite - lot.restants;
  const ligne = document.createElement('article');
  ligne.className = 'lot-row';
  const nom = document.createElement('h3');
  nom.textContent = lot.nom;

  const progression = document.createElement('progress');
  progression.max = lot.quantite || 1;
  progression.value = gagnes;
  progression.setAttribute(
    'aria-label',
    `${formatNumber.format(gagnes)} exemplaire(s) gagné(s), ${formatNumber.format(lot.restants)} restant(s) sur ${formatNumber.format(lot.quantite)} pour ${lot.nom}`
  );

  const bilan = document.createElement('span');
  bilan.className = 'lot-count';
  const restants = document.createElement('strong');
  restants.textContent = formatNumber.format(lot.restants);
  bilan.append(
    restants,
    document.createTextNode(` restant(s) / ${formatNumber.format(lot.quantite)} exemplaires`)
  );

  ligne.append(nom, progression, bilan);
  return ligne;
}

function ajusterDensiteListe() {
  const nombreLots = lotsList.children.length;
  if (nombreLots === 0) return;

  const hauteurDisponible = window.innerHeight - lotsList.getBoundingClientRect().top - 8;
  const hauteurLigne = Math.max(12, Math.min(20, Math.floor(hauteurDisponible / nombreLots)));
  document.documentElement.style.setProperty('--lot-row-height', `${hauteurLigne}px`);
  document.documentElement.style.setProperty(
    '--lot-row-font-size',
    `${Math.max(10, Math.min(13, hauteurLigne - 4))}px`
  );
}

function afficherStatistiques(stats) {
  const progression = stats.ticketsTotaux === 0
    ? 0
    : (stats.ticketsTires / stats.ticketsTotaux) * 100;
  $('drawProgress').textContent = `${formatPercent.format(progression)} %`;
  $('drawProgressBar').value = progression;
  $('drawProgressDetail').textContent =
    `${formatNumber.format(stats.ticketsTires)} tickets tirés sur ${formatNumber.format(stats.ticketsTotaux)} · `
    + `${formatNumber.format(stats.ticketsRestants)} encore dans le pool`;

  $('ticketsTotal').textContent = formatNumber.format(stats.ticketsTotaux);
  $('ticketsDrawn').textContent = formatNumber.format(stats.ticketsTires);
  $('ticketsRemaining').textContent = formatNumber.format(stats.ticketsRestants);
  $('winnersDrawn').textContent = formatNumber.format(stats.ticketsGagnantsTires);
  $('winnersDetail').textContent =
    `sur ${formatNumber.format(stats.ticketsGagnants)} gagnants · `
    + `${formatNumber.format(stats.ticketsGagnantsRestants)} restant(s)`;
  $('losersDrawn').textContent = formatNumber.format(stats.ticketsPerdantsTires);
  $('losersDetail').textContent =
    `sur ${formatNumber.format(stats.ticketsPerdants)} perdants · `
    + `${formatNumber.format(stats.ticketsPerdantsRestants)} restant(s)`;

  const ratio = stats.ticketsGagnants === 0
    ? 0
    : stats.ticketsPerdants / stats.ticketsGagnants;
  $('poolRatio').textContent = `${formatPercent.format(ratio)} : 1`;
  $('prizeSummary').textContent =
    `${formatNumber.format(stats.lots.length)} lot(s) · `
    + `${formatNumber.format(stats.ticketsGagnantsTires)} / ${formatNumber.format(stats.ticketsGagnants)} gagnés`;

  lotsList.replaceChildren();
  if (stats.lots.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Aucun lot n’est enregistré dans la tombola.';
    lotsList.append(empty);
    return;
  }

  stats.lots.forEach(lot => lotsList.append(afficherLot(lot)));
  ajusterDensiteListe();
}

async function actualiser() {
  if (loading) return;
  loading = true;
  refreshButton.disabled = true;
  status.className = 'status';
  status.textContent = 'Actualisation des statistiques…';

  try {
    const response = await fetch(`${API_URL}/statistiques`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.title || `Erreur HTTP ${response.status}`);
    }

    afficherStatistiques(analyserStatistiques(data));
    status.className = 'status success';
    status.textContent = `Mis à jour à ${new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date())}.`;
  } catch (error) {
    status.className = 'status error';
    status.textContent = `Impossible de charger les statistiques : ${error.message}`;
  } finally {
    loading = false;
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', actualiser);
actualiser();
window.addEventListener('resize', ajusterDensiteListe);
window.setInterval(actualiser, 10_000);
