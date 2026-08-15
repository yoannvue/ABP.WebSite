import { formatTime } from "./memory-utils.js";

export class MemoryUI {
  constructor({ boardEl, timerEl, movesEl, columns }) {
    this.boardEl = boardEl;
    this.timerEl = timerEl;
    this.movesEl = movesEl;
    this.boardEl.style.setProperty("--cols", columns);
  }

  renderBoard(cards, onCardClick) {
    this.boardEl.innerHTML = "";
    cards.forEach(card => {
      const cardEl = document.createElement("div");
      cardEl.className = "memory-card";
      cardEl.dataset.id = card.id;
      cardEl.innerHTML = `
        <div class="memory-card-inner">
          <div class="memory-card-face memory-card-back">
            <img src="/ressources/logo-abp.png" style="width:60px" alt="ABP">
          </div>
          <div class="memory-card-face memory-card-front">
            <img src="${card.image}" alt="Carte">
          </div>
        </div>
      `;
      cardEl.addEventListener("click", () => onCardClick(card.id));
      this.boardEl.appendChild(cardEl);
    });
  }

  setCardState(cardId, state) {
    const el = this.boardEl.querySelector(`.memory-card[data-id="${cardId}"]`);
    if (!el) return;
    el.classList.remove("flipped", "matched");
    if (state === "flipped") el.classList.add("flipped");
    if (state === "matched") el.classList.add("matched");
  }

  updateTimer(seconds) {
    this.timerEl.textContent = formatTime(seconds);
  }

  updateMoves(moves) {
    this.movesEl.textContent = moves;
  }

  showEndModal({ modalEl, timeText, movesText }) {
    modalEl.querySelector("#end-time").textContent = timeText;
    modalEl.querySelector("#end-moves").textContent = movesText;
    modalEl.classList.remove("hidden");
  }

  hideEndModal(modalEl) {
    modalEl.classList.add("hidden");
  }
}
