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
const boardEl = document.getElementById("board");
const timerEl = document.getElementById("timer");
const movesEl = document.getElementById("moves");
const restartBtn = document.getElementById("restart-btn");
const endModal = document.getElementById("end-modal");
const scoreForm = document.getElementById("score-form");
const pseudoInput = document.getElementById("pseudo");
const submitStatus = document.getElementById("submit-status");
const closeModalBtn = document.getElementById("close-modal-btn");
const refreshLeaderboardBtn = document.getElementById("refresh-leaderboard-btn");
const leaderboardStatus = document.getElementById("leaderboard-status");
const leaderboardTable = document.getElementById("leaderboard-table");
const leaderboardBody = document.getElementById("leaderboard-body");

const ui = new MemoryUI({ boardEl, timerEl, movesEl, columns });

let game = null;

function startNewGame() {
  ui.hideEndModal(endModal);
  submitStatus.textContent = "";
  scoreForm.reset();

  game = new MemoryGame({
    numPairs,
    imagePool: CONFIG.CARD_IMAGES,
    onWin: handleWin,
  });

  ui.renderBoard(game.cards, handleCardClick);
  ui.updateTimer(0);
  ui.updateMoves(0);
  game.startTimer(seconds => ui.updateTimer(seconds));
}

function handleCardClick(cardId) {
  const result = game.flipCard(cardId);

  if (result.action === "ignored") return;

  if (result.action === "flip") {
    ui.setCardState(result.card.id, "flipped");
    return;
  }

  if (result.action === "match") {
    result.cards.forEach(c => ui.setCardState(c.id, "matched"));
    ui.updateMoves(result.moves);
    return;
  }

  if (result.action === "mismatch") {
    result.cards.forEach(c => ui.setCardState(c.id, "flipped"));
    ui.updateMoves(result.moves);
    // Laisse les 2 cartes visibles un court instant avant de les cacher
    setTimeout(() => {
      game.resolveMismatch();
      result.cards.forEach(c => ui.setCardState(c.id, "hidden"));
    }, 800);
  }
}

function handleWin(elapsedSeconds, moves) {
  ui.showEndModal({
    modalEl: endModal,
    timeText: timerEl.textContent,
    movesText: String(moves),
  });
  endModal.dataset.elapsedSeconds = String(elapsedSeconds);
}

scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return;

  const elapsedSeconds = parseInt(endModal.dataset.elapsedSeconds, 10);
  const submitBtn = scoreForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitStatus.textContent = "Envoi en cours...";

  try {
    await submitScore({ pseudo, elapsedSeconds });
    submitStatus.textContent = "Score envoyé, merci !";
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    submitStatus.textContent = "Erreur lors de l'envoi, réessaie.";
  } finally {
    submitBtn.disabled = false;
  }
});

closeModalBtn.addEventListener("click", () => {
  startNewGame();
});

restartBtn.addEventListener("click", () => {
  if (game) game.stopTimer();
  startNewGame();
});


function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ------------------------------------------------------------------
// Démarrage
// ------------------------------------------------------------------
startNewGame();

