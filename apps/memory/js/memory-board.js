import { CONFIG } from "./memory-config.js";
import { getIntParam } from "./memory-utils.js";
import { MemoryGame } from "./memory-game.js";
import { MemoryUI } from "./memory-ui.js";
import { submitScore, fetchLeaderboard } from "./memory-forms.js";

// ------------------------------------------------------------------
// Config effective : NUM_PAIRS peut être surchargé via ?pairs=N
// (pratique pour tester avec peu de cartes sans toucher au code)
// ------------------------------------------------------------------
const numPairs = getIntParam("pairs", CONFIG.NUM_PAIRS);
const columns = CONFIG.columnsForPairs(numPairs);

// ------------------------------------------------------------------
// Références DOM
// ------------------------------------------------------------------

const refreshLeaderboardBtn = document.getElementById("refresh-leaderboard-btn");
const leaderboardStatus = document.getElementById("leaderboard-status");
const leaderboardTable = document.getElementById("leaderboard-table");
const leaderboardBody = document.getElementById("leaderboard-body");



refreshLeaderboardBtn.addEventListener("click", loadLeaderboard);

async function loadLeaderboard() {
  leaderboardStatus.textContent = "Chargement du classement...";
  leaderboardTable.classList.add("hidden");

  try {
    const entries = await fetchLeaderboard();

    if (entries.length === 0) {
      leaderboardStatus.textContent = "Aucun score enregistré pour le moment.";
      return;
    }

    leaderboardBody.innerHTML = entries.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(e.pseudo)}</td>
        <td>${e.timeText}</td>
        <td>${escapeHtml(e.date)}</td>
      </tr>
    `).join("");

    leaderboardStatus.textContent = "";
    leaderboardTable.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    leaderboardStatus.textContent =
      "Classement indisponible pour le moment (vérifie que la Google Sheet est bien publiée en CSV).";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ------------------------------------------------------------------
// Démarrage
// ------------------------------------------------------------------

loadLeaderboard();
