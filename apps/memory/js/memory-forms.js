import { CONFIG } from "./memory-config.js";
import { parseCSV, formatTime } from "./memory-utils.js";

/**
 * Envoie un score vers le Google Forms configuré.
 * En mode "no-cors", la réponse est opaque (impossible de lire le
 * statut HTTP) : c'est une limitation connue de l'intégration
 * Google Forms côté client. On considère l'envoi réussi si aucune
 * exception réseau n'est levée.
 */
export async function submitScore({ pseudo, elapsedSeconds }) {
  const { ACTION_URL, ENTRY_IDS } = CONFIG.GOOGLE_FORM;

  const body = new URLSearchParams();
  body.append(ENTRY_IDS.pseudo, pseudo);
  body.append(ENTRY_IDS.score, String(elapsedSeconds));

  await fetch(ACTION_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  // mode "no-cors" : pas de garantie de succès lisible, on suppose OK
  // si fetch ne lève pas d'exception.
}

/**
 * Récupère et parse le classement depuis la Google Sheet publiée en CSV.
 * Colonnes attendues : Horodatage, Pseudo, Temps (secondes), Date
 * Retourne un tableau trié par temps croissant, limité à LEADERBOARD_MAX_ROWS.
 */
export async function fetchLeaderboard() {
  const response = await fetch(CONFIG.LEADERBOARD_CSV_URL, { cache: "reload" });
  if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

  const text = await response.text();
  const rows = parseCSV(text);

  // La première ligne est l'entête (Horodatage, Pseudo, Temps, Date)
  const dataRows = rows.slice(1);

  const entries = dataRows.map(r => ({
    pseudo: r[1].trim(),
    seconds: parseInt(r[2]),
    date: r[0].trim(),
  }));

  entries.sort((a, b) => a.seconds - b.seconds);

  return entries.slice(0, CONFIG.LEADERBOARD_MAX_ROWS).map(e => ({
    ...e,
    timeText: formatTime(e.seconds),
  }));
}
