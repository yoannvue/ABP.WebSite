// Fonctions utilitaires pures, sans dépendance au DOM.

/** Mélange un tableau (Fisher-Yates) sans muter l'original. */
export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Formate un nombre de secondes en mm:ss */
export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Lit un paramètre entier depuis l'URL courante (ex: ?pairs=6) */
export function getIntParam(name, fallback) {
  const value = new URLSearchParams(window.location.search).get(name);
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Parse un CSV simple (tel qu'exporté par Google Sheets "Publier au format CSV").
 * Gère les champs entre guillemets contenant des virgules.
 * Retourne un tableau de tableaux de chaînes.
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n" || char === "\r") {
        if (field !== "" || row.length) { row.push(field); rows.push(row); }
        field = ""; row = [];
        if (char === "\r" && next === "\n") i++;
      } else { field += char; }
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
